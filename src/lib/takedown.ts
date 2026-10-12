import type { Platform } from "./types";

/** Where a takedown notice for each platform should go. Shown to the user and used by the server; never taken from the client. */
export interface AbuseDesk {
  desk: string;
  email?: string; // platforms that take reports by email
  formUrl?: string; // platforms that only take reports through a web form
}

// Verify every entry before switching to live mode: platforms change these channels. Google Play and Apple
// have no abuse email, so for them the notice goes to the security team together with the form link.
export const ABUSE_DESKS: Record<Platform, AbuseDesk> = {
  telegram: { desk: "Telegram Abuse", email: "abuse@telegram.org" },
  bluesky: { desk: "Bluesky Trust & Safety", email: "support@bsky.app" },
  "play-store": { desk: "Google Play Abuse Desk", formUrl: "https://support.google.com/legal/troubleshooter/1114905" },
  "app-store": { desk: "Apple App Store Content Disputes", formUrl: "https://www.apple.com/legal/internet-services/itunes/appstorenotices/" },
  instagram: { desk: "Instagram Impersonation Report", formUrl: "https://help.instagram.com/contact/636276399721841" },
  x: { desk: "X Impersonation Report", formUrl: "https://help.x.com/forms/impersonation" },
  youtube: { desk: "YouTube Impersonation Report", formUrl: "https://support.google.com/youtube/answer/2801947" },
  domain: { desk: "Domain registrar abuse contact (look up via WHOIS)" },
};

export type TakedownMode = "demo" | "live";

/** What the browser sends to /api/trigger-takedown. Recipient and mode are decided on the server, not here. */
export interface TakedownRequest {
  brandName: string;
  threatTitle: string;
  platform: Platform;
  riskScore: number;
  severity: string;
  evidenceUrl?: string;
  detectedArtifact?: string;
  findingSource: "live" | "simulated";
  findingId: string;
  noticeText: string;
  authorised: true;
}

/** The JSON body n8n receives (the webhook node starts the workflow with this). */
export interface TakedownPayload extends Omit<TakedownRequest, "authorised"> {
  event: "clonex.takedown";
  requestedAt: string;
  mode: TakedownMode;
  /** The inbox the email node should send to: your test inbox in demo mode, the platform desk in live mode. */
  to?: string;
  /** The real desk this notice is meant for, even when demo mode redirects it. */
  intendedDesk: AbuseDesk;
}

export type TakedownStatus = "dispatched" | "dry-run" | "failed";
export interface TakedownResponse {
  ok: boolean;
  status: TakedownStatus;
  mode: TakedownMode;
  message: string;
  desk: AbuseDesk;
}
/** Status of the server's takedown set-up, so the modal can say what will happen before the user confirms. */
export interface TakedownConfig {
  mode: TakedownMode;
  connected: boolean;
}

/** Saved per finding in the browser so the dashboard keeps the status after a refresh. */
export type TakedownRecord = { status: "pending"; at: string; mode: TakedownMode };
