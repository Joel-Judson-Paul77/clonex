import { NextResponse } from "next/server";
import { ApiError, errorResponse, rateLimit, readJson, str } from "@/lib/api-guard";
import { addEvent, statusOf, transition, type CaseStatus } from "@/lib/cases";
import { appendEvent, dbEnabled, loadCases } from "@/lib/db";

// Shared case history (Postgres). GET returns every case for a brand; POST records one analyst decision.
// The server re-checks every move against the allowed transitions, so the browser cannot skip a step.

const STATUSES: CaseStatus[] = ["new", "under-review", "confirmed", "false-positive", "closed"];
const NO_STORE = { "Cache-Control": "no-store" };

/** A short, secret-free reason for the response (e.g. "database answered HTTP 401"). */
const reason = (e: unknown) => (e instanceof Error ? e.message.slice(0, 120) : "unknown error");
const unreachable = (e: unknown) => NextResponse.json({ error: "The case database could not be reached", detail: reason(e) }, { status: 502 });

export async function GET(req: Request) {
  try {
    rateLimit(req, "cases-read", 120);
    if (!dbEnabled()) return NextResponse.json({ enabled: false, cases: {} }, { headers: NO_STORE });
    const brand = str(new URL(req.url).searchParams.get("brand") ?? "", "brand", { min: 1, max: 80 })!;
    return NextResponse.json({ enabled: true, cases: await loadCases(brand) }, { headers: NO_STORE });
  } catch (e) {
    return e instanceof ApiError ? errorResponse(e) : unreachable(e);
  }
}

export async function POST(req: Request) {
  try {
    rateLimit(req, "cases-write", 60);
    if (!dbEnabled()) throw new ApiError(503, "The case database is not configured");
    const b = await readJson(req, 4_000);
    const brand = str(b.brand, "brand", { min: 1, max: 80 })!;
    const findingId = str(b.findingId, "findingId", { min: 1, max: 200 })!;
    const by = str(b.by, "by", { max: 40, optional: true }) ?? "Analyst";
    const note = str(b.note, "note", { max: 300, optional: true });
    const to = b.to === undefined ? undefined : (b.to as CaseStatus);
    if (to !== undefined && !STATUSES.includes(to)) throw new ApiError(400, `"to" must be one of: ${STATUSES.join(", ")}`);
    if (to === undefined && !note) throw new ApiError(400, 'Send either a new status ("to") or a "note"');

    const current = await loadCases(brand, findingId);
    const next = to ? transition(current, findingId, to, by, note) : addEvent(current, findingId, by, note!);
    const record = next[findingId];
    if (next === current || !record) throw new ApiError(409, `A ${statusOf(current, findingId)} case cannot move to ${to}`);

    await appendEvent(brand, findingId, record.history[record.history.length - 1]);
    return NextResponse.json({ ok: true, record });
  } catch (e) {
    return e instanceof ApiError ? errorResponse(e) : unreachable(e);
  }
}
