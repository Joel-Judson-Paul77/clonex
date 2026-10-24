import { describe, expect, it } from "vitest";
import { eventsToCaseMap, type EventRow } from "@/lib/db";

const row = (finding_id: string, from: EventRow["from_status"], to: EventRow["to_status"], by = "Joel", note: string | null = null): EventRow => ({
  finding_id, at: "2026-10-24T10:00:00Z", by_analyst: by, from_status: from, to_status: to, note,
});

describe("eventsToCaseMap", () => {
  it("builds each case from its events, in order", () => {
    const map = eventsToCaseMap([row("a", "new", "under-review"), row("b", "new", "false-positive", "Priya"), row("a", "under-review", "confirmed", "Priya", "Same logo")]);
    expect(map.a.status).toBe("confirmed");
    expect(map.a.history.map((e) => [e.by, e.to])).toEqual([["Joel", "under-review"], ["Priya", "confirmed"]]);
    expect(map.a.history[1].note).toBe("Same logo");
    expect(map.b.status).toBe("false-positive");
  });

  it("returns an empty map when there are no events", () => {
    expect(eventsToCaseMap([])).toEqual({});
  });

  it("keeps note-only events without changing the status", () => {
    const map = eventsToCaseMap([row("a", "new", "confirmed"), row("a", "confirmed", "confirmed", "Joel", "Takedown notice dispatched")]);
    expect(map.a.status).toBe("confirmed");
    expect(map.a.history).toHaveLength(2);
  });
});
