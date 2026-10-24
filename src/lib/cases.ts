import type { Finding } from "./types";

/** Where an investigation stands. New findings start as "new"; analysts move them along. */
export type CaseStatus = "new" | "under-review" | "confirmed" | "false-positive" | "closed";

export interface CaseEvent {
  at: string; // ISO timestamp
  by: string; // analyst who made the change (or "CloneX" for automatic events)
  from: CaseStatus | null;
  to: CaseStatus;
  note?: string;
}

export interface CaseRecord {
  status: CaseStatus;
  history: CaseEvent[];
}

/** Case records keyed by finding id. A finding with no record is "new". */
export type CaseMap = Record<string, CaseRecord>;

export const STATUS_LABEL: Record<CaseStatus, string> = {
  new: "New",
  "under-review": "Under review",
  confirmed: "Confirmed",
  "false-positive": "False positive",
  closed: "Closed",
};

/** Moves an analyst may make from each status. Closed and false-positive cases can be reopened. */
export const TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  new: ["under-review", "confirmed", "false-positive"],
  "under-review": ["confirmed", "false-positive"],
  confirmed: ["closed", "under-review"],
  "false-positive": ["under-review"],
  closed: ["under-review"],
};

/** Cases that still need attention. False positives and closed cases drop out of the priority queue. */
export const isOpen = (s: CaseStatus) => s === "new" || s === "under-review" || s === "confirmed";

export const statusOf = (map: CaseMap, id: string): CaseStatus => map[id]?.status ?? "new";

/** Records an analyst decision. An illegal move returns the map unchanged. */
export function transition(map: CaseMap, id: string, to: CaseStatus, by: string, note?: string, now = new Date()): CaseMap {
  const from = statusOf(map, id);
  if (!TRANSITIONS[from].includes(to)) return map;
  const event: CaseEvent = { at: now.toISOString(), by: by.trim() || "Analyst", from, to, ...(note ? { note } : {}) };
  return { ...map, [id]: { status: to, history: [...(map[id]?.history ?? []), event] } };
}

/** Adds a history entry without changing the status (e.g. "Takedown notice dispatched"). */
export function addEvent(map: CaseMap, id: string, by: string, note: string, now = new Date()): CaseMap {
  const status = statusOf(map, id);
  const event: CaseEvent = { at: now.toISOString(), by: by.trim() || "Analyst", from: status, to: status, note };
  return { ...map, [id]: { status, history: [...(map[id]?.history ?? []), event] } };
}

/** Highest risk first; ties keep a stable order by id so the queue doesn't jump around. */
export function byPriority<T extends Pick<Finding, "id" | "score">>(items: T[]): T[] {
  return [...items].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/** Critical or high findings that have not triggered an alert yet. Each detection alerts once. */
export function pendingAlerts(findings: Finding[], alerted: ReadonlySet<string>): Finding[] {
  return byPriority(findings.filter((f) => (f.severity === "critical" || f.severity === "high") && !alerted.has(f.id)));
}
