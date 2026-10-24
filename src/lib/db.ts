import type { CaseEvent, CaseMap, CaseStatus } from "./cases";

// Case history stored in Postgres (Supabase), reached through its REST API with the server-side service-role key.
// Without SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY the app keeps working: the browser stores the history itself.

const base = () => process.env.SUPABASE_URL?.replace(/\/+$/, "");
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dbEnabled = () => !!(base() && key());

export interface EventRow {
  finding_id: string;
  at: string;
  by_analyst: string;
  from_status: CaseStatus | null;
  to_status: CaseStatus;
  note: string | null;
}

/** Folds an ordered list of event rows into the per-finding case records the UI uses. */
export function eventsToCaseMap(rows: EventRow[]): CaseMap {
  const map: CaseMap = {};
  for (const r of rows) {
    const event: CaseEvent = { at: r.at, by: r.by_analyst, from: r.from_status, to: r.to_status, ...(r.note ? { note: r.note } : {}) };
    const rec = map[r.finding_id] ?? { status: "new" as CaseStatus, history: [] };
    rec.history.push(event);
    rec.status = r.to_status;
    map[r.finding_id] = rec;
  }
  return map;
}

async function rest(path: string, init?: RequestInit): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    return await fetch(`${base()}/rest/v1/${path}`, {
      ...init,
      signal: ctl.signal,
      cache: "no-store",
      headers: { apikey: key()!, Authorization: `Bearer ${key()}`, "Content-Type": "application/json", ...init?.headers },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** All case events for a brand (or one finding), oldest first. */
export async function loadCases(brand: string, findingId?: string): Promise<CaseMap> {
  const filter = `brand=eq.${encodeURIComponent(brand)}${findingId ? `&finding_id=eq.${encodeURIComponent(findingId)}` : ""}`;
  const r = await rest(`case_events?${filter}&select=finding_id,at,by_analyst,from_status,to_status,note&order=at.asc,id.asc&limit=5000`);
  if (!r.ok) throw new Error(`database answered HTTP ${r.status}`);
  return eventsToCaseMap((await r.json()) as EventRow[]);
}

export async function appendEvent(brand: string, findingId: string, e: CaseEvent): Promise<void> {
  const r = await rest("case_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ brand, finding_id: findingId, at: e.at, by_analyst: e.by, from_status: e.from, to_status: e.to, note: e.note ?? null }),
  });
  if (!r.ok) throw new Error(`database answered HTTP ${r.status}`);
}
