import { NextResponse } from "next/server";
import { ApiError, errorResponse, rateLimit, readJson } from "@/lib/api-guard";
import { buildPayload, sendToN8n } from "@/lib/n8n";
import type { ScanResult } from "@/lib/types";

// Forwards a scan's top findings to the n8n automation layer (alerts, abuse-email drafts, logging).
// It can trigger outbound alerts, so it is disabled unless CLONEX_NOTIFY_KEY is set, and every caller
// must send that key in the "x-clonex-key" header.
export async function POST(req: Request) {
  try {
    const key = process.env.CLONEX_NOTIFY_KEY;
    if (!key) throw new ApiError(503, "Notifications are disabled (set CLONEX_NOTIFY_KEY to enable them)");
    if (req.headers.get("x-clonex-key") !== key) throw new ApiError(401, "Missing or wrong x-clonex-key header");
    rateLimit(req, "notify", 10);
    const body = await readJson(req, 300_000);
    if (!Array.isArray(body.findings) || typeof (body.brand as { name?: unknown })?.name !== "string") {
      throw new ApiError(400, "A scan result with findings and brand.name is required");
    }
    const res = await sendToN8n(buildPayload(body as unknown as ScanResult));
    return NextResponse.json(res, { status: res.ok ? 200 : 502 });
  } catch (e) {
    return errorResponse(e);
  }
}
