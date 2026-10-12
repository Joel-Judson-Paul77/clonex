import { NextResponse } from "next/server";
import { errorResponse, rateLimit } from "@/lib/api-guard";
import { featuredPresets } from "@/lib/brand-presets";

// Real app icons for the featured-brand bubbles: ONE iTunes lookup for all featured iOS apps, cached.
let cache: { at: number; icons: Record<string, string> } | null = null;
const TTL = 6 * 60 * 60 * 1000;

async function lookup(ids: string[], country: string): Promise<Record<string, string>> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`https://itunes.apple.com/lookup?id=${ids.join(",")}&country=${country}`, { signal: ctl.signal });
    if (!r.ok) return {};
    const j = await r.json();
    return Object.fromEntries((j.results ?? []).map((a: { trackId: number; artworkUrl100?: string }) => [String(a.trackId), a.artworkUrl100 ?? ""]).filter(([, u]: [string, string]) => u));
  } catch {
    return {};
  } finally {
    clearTimeout(t);
  }
}

export async function GET(req: Request) {
  try {
    rateLimit(req, "preset-icons", 30);
  } catch (e) {
    return errorResponse(e);
  }
  if (cache && Date.now() - cache.at < TTL) return NextResponse.json({ icons: cache.icons });
  const ids = featuredPresets().map((p) => p.iosAppId).filter((x): x is string => !!x);
  let icons = await lookup(ids, "in");
  const missing = ids.filter((i) => !icons[i]);
  if (missing.length) icons = { ...icons, ...(await lookup(missing, "us")) };
  if (Object.keys(icons).length) cache = { at: Date.now(), icons }; // don't remember a failed lookup
  return NextResponse.json({ icons });
}
