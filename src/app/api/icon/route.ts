import { NextResponse } from "next/server";
import { errorResponse, rateLimit } from "@/lib/api-guard";

// Fetches a store icon server-side and returns it as a data URL, so the profile can keep the logo.
// Only app-store image hosts are allowed, so this can't be used to reach arbitrary URLs.
const ALLOWED = (host: string) => host.endsWith(".mzstatic.com") || host.endsWith(".googleusercontent.com");
const MAX_BYTES = 1_500_000;

export async function GET(req: Request) {
  try {
    rateLimit(req, "icon", 120);
  } catch (e) {
    return errorResponse(e);
  }
  const raw = new URL(req.url).searchParams.get("url") ?? "";
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return NextResponse.json({ error: "bad url" }, { status: 400 });
  }
  if (u.protocol !== "https:" || !ALLOWED(u.hostname)) return NextResponse.json({ error: "host not allowed" }, { status: 400 });

  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 7000);
  try {
    const r = await fetch(u, { signal: ctl.signal, headers: { "User-Agent": "Clonex/0.1" } });
    const type = r.headers.get("content-type") ?? "";
    if (!r.ok || !type.startsWith("image/")) return NextResponse.json({ error: "not an image" }, { status: 502 });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) return NextResponse.json({ error: "too large" }, { status: 413 });
    return NextResponse.json({ dataUrl: `data:${type};base64,${buf.toString("base64")}` });
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  } finally {
    clearTimeout(t);
  }
}
