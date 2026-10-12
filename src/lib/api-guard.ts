import { NextResponse } from "next/server";

// Small, dependency-free guards shared by the API routes: bounded JSON parsing, field validation,
// and a per-client rate limit. Every failure becomes a clear 4xx JSON error instead of an empty 500.

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
  return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
}

/** Read a JSON object body, refusing anything larger than maxBytes or not valid JSON. */
export async function readJson(req: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new ApiError(413, `Request body too large (max ${Math.round(maxBytes / 1024)} KB)`);
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError(413, `Request body too large (max ${Math.round(maxBytes / 1024)} KB)`);
  if (!text.trim()) throw new ApiError(400, "Request body is empty");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ApiError(400, "Request body is not valid JSON");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new ApiError(400, "Request body must be a JSON object");
  return data as Record<string, unknown>;
}

/** A required or optional string field, trimmed and length-checked. */
export function str(v: unknown, field: string, opts: { min?: number; max: number; optional?: boolean }): string | undefined {
  if (v === undefined || v === null || v === "") {
    if (opts.optional) return undefined;
    throw new ApiError(400, `"${field}" is required`);
  }
  if (typeof v !== "string") throw new ApiError(400, `"${field}" must be a string`);
  const s = v.trim();
  if (opts.min && s.length < opts.min) throw new ApiError(400, `"${field}" must be at least ${opts.min} characters`);
  if (s.length > opts.max) throw new ApiError(400, `"${field}" must be at most ${opts.max} characters`);
  return s;
}

/** An optional list of short strings, with a cap on both item count and item length. */
export function strList(v: unknown, field: string, maxItems: number, maxLen: number): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new ApiError(400, `"${field}" must be a list`);
  if (v.length > maxItems) throw new ApiError(400, `"${field}" can hold at most ${maxItems} items`);
  return v.map((x, i) => {
    if (typeof x !== "string") throw new ApiError(400, `"${field}[${i}]" must be a string`);
    const s = x.trim();
    if (s.length > maxLen) throw new ApiError(400, `"${field}[${i}]" must be at most ${maxLen} characters`);
    return s;
  }).filter(Boolean);
}

// Magic bytes of the image formats we accept for an uploaded logo.
const SIGNATURES: [string, number[]][] = [
  ["png", [0x89, 0x50, 0x4e, 0x47]],
  ["jpeg", [0xff, 0xd8, 0xff]],
  ["gif", [0x47, 0x49, 0x46, 0x38]],
  ["webp", [0x52, 0x49, 0x46, 0x46]], // "RIFF" (WEBP container)
];

/** An optional logo as a data URL: real image bytes only, bounded size. */
export function logoDataUrl(v: unknown, maxBytes: number): string | undefined {
  const s = str(v, "logoDataUrl", { max: Math.ceil((maxBytes * 4) / 3) + 64, optional: true });
  if (!s) return undefined;
  const m = s.match(/^data:image\/(png|jpe?g|gif|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw new ApiError(400, '"logoDataUrl" must be a base64 PNG, JPEG, GIF or WebP data URL');
  const head = Buffer.from(m[2].slice(0, 24), "base64");
  if (!SIGNATURES.some(([, sig]) => sig.every((b, i) => head[i] === b))) throw new ApiError(400, '"logoDataUrl" is not a valid image');
  return s;
}

// ---- rate limiting (per client IP, in memory) --------------------------------------------------
// Good enough for a single-server demo; a multi-instance deployment would need a shared store.
const buckets = new Map<string, { count: number; reset: number }>();

function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
}

/** Throws a 429 once a client exceeds `limit` requests to `route` within `windowMs`. */
export function rateLimit(req: Request, route: string, limit: number, windowMs = 60_000) {
  const key = `${route}:${clientIp(req)}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k); // keep memory bounded
    return;
  }
  b.count++;
  if (b.count > limit) {
    const wait = Math.ceil((b.reset - now) / 1000);
    throw new ApiError(429, `Too many requests. Try again in ${wait}s.`);
  }
}
