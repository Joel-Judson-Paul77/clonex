import { NextResponse } from "next/server";
import { ApiError, errorResponse, rateLimit, readJson, str } from "@/lib/api-guard";
import { ABUSE_DESKS, cleanEmail, describeDispatch } from "@/lib/takedown";
import type { TakedownConfig, TakedownMode, TakedownPayload, TakedownResponse } from "@/lib/takedown";
import type { Platform } from "@/lib/types";

// Bridge from the dashboard to the n8n takedown workflow (webhook -> notice -> email -> team alert).
// It sends email, so: the recipient is chosen HERE (never by the browser), demo mode redirects every notice
// to your own test inbox, live mode must be switched on explicitly, and the route is rate limited.

const PLATFORMS = Object.keys(ABUSE_DESKS) as Platform[];

function mode(): TakedownMode {
  return process.env.CLONEX_TAKEDOWN_MODE === "live" ? "live" : "demo";
}
function webhookUrl(): string | undefined {
  return process.env.N8N_TAKEDOWN_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL || undefined;
}

/** What the server is set up to do, for the confirmation dialog. */
export async function GET() {
  const cfg: TakedownConfig = { mode: mode(), connected: !!webhookUrl() };
  return NextResponse.json(cfg, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  try {
    rateLimit(req, "takedown", 8);
    const b = await readJson(req, 20_000);

    if (b.authorised !== true) throw new ApiError(400, "You must confirm you are authorised to act for the brand");
    const platform = str(b.platform, "platform", { min: 1, max: 20 }) as Platform;
    if (!PLATFORMS.includes(platform)) throw new ApiError(400, `"platform" must be one of: ${PLATFORMS.join(", ")}`);
    const riskScore = Number(b.riskScore);
    if (!Number.isFinite(riskScore) || riskScore < 0 || riskScore > 100) throw new ApiError(400, '"riskScore" must be a number from 0 to 100');
    const findingSource = b.findingSource === "simulated" ? "simulated" : b.findingSource === "live" ? "live" : null;
    if (!findingSource) throw new ApiError(400, '"findingSource" must be "live" or "simulated"');
    const evidenceUrl = str(b.evidenceUrl, "evidenceUrl", { max: 500, optional: true });
    if (evidenceUrl && !/^https?:\/\//i.test(evidenceUrl)) throw new ApiError(400, '"evidenceUrl" must be an http(s) link');

    const m = mode();
    // simulated demo items are not real accounts: only allow them in demo mode, where nothing reaches a platform
    if (findingSource === "simulated" && m === "live") throw new ApiError(400, "Simulated demo items cannot be reported in live mode");

    const desk = ABUSE_DESKS[platform];
    // Optional copies for the analyst and the brand's own security team. n8n only emails addresses on its approved list.
    const copies: string[] = [];
    for (const [field, label] of [["analystEmail", "Your email"], ["companyEmail", "Brand security team email"]] as const) {
      if (b[field] === undefined || b[field] === "") continue;
      const email = cleanEmail(b[field]);
      if (!email) throw new ApiError(400, `${label} is not a valid email address`);
      if (!copies.includes(email)) copies.push(email);
    }
    const payload: TakedownPayload = {
      event: "clonex.takedown",
      requestedAt: new Date().toISOString(),
      mode: m,
      brandName: str(b.brandName, "brandName", { min: 1, max: 80 })!,
      threatTitle: str(b.threatTitle, "threatTitle", { min: 1, max: 200 })!,
      platform,
      riskScore: Math.round(riskScore),
      severity: str(b.severity, "severity", { min: 1, max: 20 })!,
      evidenceUrl,
      detectedArtifact: str(b.detectedArtifact, "detectedArtifact", { max: 200, optional: true }),
      findingSource,
      findingId: str(b.findingId, "findingId", { min: 1, max: 200 })!,
      noticeText: str(b.noticeText, "noticeText", { min: 20, max: 6000 })!,
      // demo: your own inbox (may be empty: the workflow then falls back to a Gmail draft). live: the platform desk, if it has an email.
      to: m === "demo" ? process.env.CLONEX_DEMO_INBOX || undefined : desk.email,
      intendedDesk: desk,
      copies,
    };

    const url = webhookUrl();
    if (!url) {
      const res: TakedownResponse = {
        ok: true, status: "dry-run", mode: m, desk,
        message: "n8n is not connected (set N8N_TAKEDOWN_WEBHOOK_URL), so nothing was sent. This was a dry run.",
      };
      return NextResponse.json(res);
    }

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20_000);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (process.env.N8N_WEBHOOK_SECRET) headers["x-clonex-secret"] = process.env.N8N_WEBHOOK_SECRET;
      const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload), signal: ctl.signal });
      if (!r.ok) {
        const res: TakedownResponse = { ok: false, status: "failed", mode: m, desk, message: `n8n answered with HTTP ${r.status}. The notice was not confirmed as sent.` };
        return NextResponse.json(res, { status: 502 });
      }
      // What n8n actually did: "emailed" (with the addresses), or "logged" when no email went out.
      const answer = (await r.json().catch(() => null)) as { action?: string; sentTo?: string[]; blocked?: string[] } | null;
      const res: TakedownResponse = { ok: true, status: "dispatched", mode: m, desk, message: describeDispatch(m, answer) };
      return NextResponse.json(res);
    } catch {
      const res: TakedownResponse = { ok: false, status: "failed", mode: m, desk, message: "Could not reach n8n. Check the webhook URL and that the workflow is published." };
      return NextResponse.json(res, { status: 502 });
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    return errorResponse(e);
  }
}
