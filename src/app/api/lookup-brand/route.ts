import { NextResponse } from "next/server";
import { errorResponse, rateLimit } from "@/lib/api-guard";
import { lookupBrands } from "@/lib/brand-lookup";
import type { LookupResponse } from "@/lib/brand-types";

export const maxDuration = 30;

const cache = new Map<string, { at: number; data: LookupResponse }>();
const TTL = 10 * 60 * 1000;

// GET /api/lookup-brand?q=spotify  -> brand cards assembled from the App Store + Google Play
export async function GET(req: Request) {
  try {
    rateLimit(req, "lookup", 60); // typing fires debounced requests, so allow a generous rate
  } catch (e) {
    return errorResponse(e);
  }
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ q, cards: [], live: { ios: false, android: false } } satisfies LookupResponse);

  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.data);

  const data = await lookupBrands(q);
  // only cache results that came from live stores, so a temporary outage is not remembered
  if (data.live.ios || data.live.android) cache.set(key, { at: Date.now(), data });
  return NextResponse.json(data);
}
