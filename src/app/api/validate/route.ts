import { NextResponse } from "next/server";
import { ApiError, errorResponse, rateLimit, readJson, str } from "@/lib/api-guard";

// Verifies that an "official" asset the user entered really exists, and returns
// details we use to auto-fill the profile (e.g. publisher name from an app).

type Kind = "bluesky" | "telegram" | "youtube" | "app-store" | "play-store" | "domain" | "phone";
interface Out { ok: boolean; message: string; detail?: Record<string, string> }

async function timed(url: string, ms = 9000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0 Clonex/0.1" } });
  } finally {
    clearTimeout(t);
  }
}

async function check(kind: Kind, raw: string): Promise<Out> {
  const value = raw.trim().replace(/^@/, "");
  if (!value) return { ok: false, message: "Enter a value" };

  switch (kind) {
    case "bluesky": {
      if (!/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) return { ok: false, message: "Use the full handle, e.g. name.bsky.social" };
      const r = await timed(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(value)}`);
      if (!r.ok) return { ok: false, message: "Profile not found on Bluesky" };
      const j = await r.json();
      return { ok: true, message: `Found: ${j.displayName || j.handle}`, detail: { name: j.displayName ?? "", avatar: j.avatar ?? "" } };
    }
    case "telegram": {
      if (!/^[a-z][a-z0-9_]{3,31}$/i.test(value)) return { ok: false, message: "Telegram usernames are 4-32 letters, digits or _" };
      const r = await timed(`https://t.me/${value}`);
      const html = await r.text();
      const title = html.match(/<meta property="og:title" content="([^"]*)"/i)?.[1] ?? "";
      if (!title || /^Telegram: (Contact|Launch)/i.test(title)) return { ok: false, message: "Channel or account not found on Telegram" };
      return { ok: true, message: `Found: ${title}`, detail: { name: title } };
    }
    case "youtube": {
      if (!/^[\w.-]{3,40}$/.test(value)) return { ok: false, message: "Enter the channel handle, e.g. paytm" };
      const r = await timed(`https://www.youtube.com/@${encodeURIComponent(value)}`);
      return r.ok ? { ok: true, message: "Channel page exists" } : { ok: false, message: "Channel not found on YouTube" };
    }
    case "app-store": {
      const q = /^\d+$/.test(value) ? `id=${value}` : `bundleId=${encodeURIComponent(value)}`;
      const r = await timed(`https://itunes.apple.com/lookup?${q}&country=in`);
      const j = await r.json();
      const a = j.results?.[0];
      if (!a) return { ok: false, message: "App not found on the Indian App Store" };
      let iconDataUrl = "";
      try {
        const big = String(a.artworkUrl512 ?? a.artworkUrl100);
        const ir = await timed(big);
        if (ir.ok) iconDataUrl = `data:${ir.headers.get("content-type") ?? "image/png"};base64,${Buffer.from(await ir.arrayBuffer()).toString("base64")}`;
      } catch { /* icon is optional */ }
      return {
        ok: true,
        message: `Found: ${a.trackName} by ${a.sellerName}`,
        detail: { name: a.trackName, developer: a.sellerName, bundleId: a.bundleId, icon: a.artworkUrl100, iconDataUrl },
      };
    }
    case "play-store": {
      if (!/^[a-z][\w]*(\.[\w]+)+$/i.test(value)) return { ok: false, message: "Use the package name, e.g. net.one97.paytm" };
      try {
        // the scraper returns the real title and developer, which we use to register the official publisher
        const gp = await import("google-play-scraper");
        const gplay = (gp as unknown as { default: { app: (o: Record<string, unknown>) => Promise<{ title: string; developer: string }> } }).default;
        const d = await Promise.race([
          gplay.app({ appId: value, country: "in", lang: "en" }),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
        ]);
        return { ok: true, message: `Found: ${d.title} by ${d.developer}`, detail: { name: d.title, developer: d.developer } };
      } catch {
        const r = await timed(`https://play.google.com/store/apps/details?id=${encodeURIComponent(value)}&hl=en_IN&gl=IN`);
        return r.ok ? { ok: true, message: "App page exists" } : { ok: false, message: "App not found on Google Play" };
      }
    }
    case "domain": {
      const d = value.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(d)) return { ok: false, message: "Enter a domain like example.com" };
      const r = await timed(`https://dns.google/resolve?name=${encodeURIComponent(d)}&type=A`);
      const j = await r.json();
      return j.Answer?.length ? { ok: true, message: "Domain resolves" } : { ok: false, message: "Domain does not resolve" };
    }
    case "phone": {
      const digits = value.replace(/[\s()-]/g, "");
      if (/^(\+?91)?[6-9]\d{9}$/.test(digits) || /^1800\d{6,7}$/.test(digits) || /^0\d{2,4}\d{6,8}$/.test(digits)) return { ok: true, message: "Valid Indian number format" };
      return { ok: false, message: "Not a valid Indian mobile, toll-free or landline number" };
    }
  }
}

const KINDS: Kind[] = ["bluesky", "telegram", "youtube", "app-store", "play-store", "domain", "phone"];

export async function POST(req: Request) {
  let kind: Kind;
  let value: string;
  try {
    rateLimit(req, "validate", 60);
    const body = await readJson(req, 4_000);
    if (!KINDS.includes(body.kind as Kind)) throw new ApiError(400, `"kind" must be one of: ${KINDS.join(", ")}`);
    kind = body.kind as Kind;
    value = str(body.value, "value", { max: 200 })!;
  } catch (e) {
    return errorResponse(e);
  }
  try {
    return NextResponse.json(await check(kind, value));
  } catch {
    return NextResponse.json({ ok: false, message: "Could not reach the source - try again, or save without verifying" });
  }
}
