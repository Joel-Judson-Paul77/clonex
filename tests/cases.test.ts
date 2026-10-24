import { describe, expect, it } from "vitest";
import { addEvent, byPriority, isOpen, pendingAlerts, statusOf, transition, type CaseMap } from "@/lib/cases";
import type { Finding } from "@/lib/types";

const f = (id: string, score: number, severity: Finding["severity"]): Finding => ({
  id, score, severity, platform: "play-store", source: "live", kind: "app", name: id,
  signals: [], phones: [], summary: "", aiAnalyzed: false,
});

const T0 = new Date("2026-10-24T10:00:00Z");

describe("case status", () => {
  it("treats an unseen finding as new", () => {
    expect(statusOf({}, "a")).toBe("new");
  });

  it("records who made each change and when", () => {
    let m: CaseMap = {};
    m = transition(m, "a", "under-review", "Joel", undefined, T0);
    m = transition(m, "a", "confirmed", "Priya", "Same logo and publisher mismatch", T0);
    expect(statusOf(m, "a")).toBe("confirmed");
    expect(m.a.history).toEqual([
      { at: T0.toISOString(), by: "Joel", from: "new", to: "under-review" },
      { at: T0.toISOString(), by: "Priya", from: "under-review", to: "confirmed", note: "Same logo and publisher mismatch" },
    ]);
  });

  it("refuses a move that is not allowed", () => {
    const m = transition({}, "a", "false-positive", "Joel", undefined, T0);
    expect(transition(m, "a", "confirmed", "Joel", undefined, T0)).toBe(m);
    expect(transition({}, "a", "closed", "Joel", undefined, T0)).toEqual({});
  });

  it("lets a closed or dismissed case be reopened", () => {
    let m = transition({}, "a", "false-positive", "Joel", undefined, T0);
    m = transition(m, "a", "under-review", "Joel", undefined, T0);
    expect(statusOf(m, "a")).toBe("under-review");
  });

  it("falls back to a default analyst name", () => {
    expect(transition({}, "a", "confirmed", "  ", undefined, T0).a.history[0].by).toBe("Analyst");
  });

  it("logs an event without changing the status", () => {
    let m = transition({}, "a", "confirmed", "Joel", undefined, T0);
    m = addEvent(m, "a", "Joel", "Takedown notice dispatched", T0);
    expect(statusOf(m, "a")).toBe("confirmed");
    expect(m.a.history).toHaveLength(2);
    expect(m.a.history[1]).toMatchObject({ from: "confirmed", to: "confirmed", note: "Takedown notice dispatched" });
  });

  it("drops false positives and closed cases out of the open queue", () => {
    expect(["new", "under-review", "confirmed"].every((s) => isOpen(s as never))).toBe(true);
    expect(isOpen("false-positive")).toBe(false);
    expect(isOpen("closed")).toBe(false);
  });
});

describe("priority and alerts", () => {
  it("sorts by score, highest first, with a stable tie-break", () => {
    const sorted = byPriority([f("b", 60, "high"), f("a", 60, "high"), f("c", 90, "critical")]);
    expect(sorted.map((x) => x.id)).toEqual(["c", "a", "b"]);
  });

  it("alerts only on critical or high findings, and only once each", () => {
    const list = [f("a", 90, "critical"), f("b", 60, "high"), f("c", 30, "low"), f("d", 50, "medium")];
    expect(pendingAlerts(list, new Set()).map((x) => x.id)).toEqual(["a", "b"]);
    expect(pendingAlerts(list, new Set(["a"])).map((x) => x.id)).toEqual(["b"]);
    expect(pendingAlerts(list, new Set(["a", "b"]))).toEqual([]);
  });
});
