import { describe, expect, it } from "vitest";
import { evaluateAll } from "@/lib/evalset";
import { isHostname } from "@/lib/connectors";

// These guard the accuracy numbers quoted in the README and deck. If detection changes and a number drops,
// this fails, so the claim is never quietly out of date.
describe("accuracy on the labelled test sets", () => {
  const r = evaluateAll();

  it("does not flag any legitimate name in the development set", () => {
    expect(r.main.endToEnd.fp).toBe(0);
    expect(r.main.endToEnd.precision).toBe(1);
  });

  it("keeps the held-out result at or above what we report (87% precision, 76% recall)", () => {
    expect(r.heldOut.endToEnd.precision).toBeGreaterThanOrEqual(0.86);
    expect(r.heldOut.endToEnd.recall).toBeGreaterThanOrEqual(0.76);
    expect(r.heldOut.endToEnd.f1).toBeGreaterThanOrEqual(0.8);
  });

  it("has the held-out set at 31 names", () => {
    expect(r.heldOut.total).toBe(31);
  });
});

describe("isHostname (certificate-log filter)", () => {
  it.each(["paytm.com", "pay.paytm.co.in", "a-b.example.org", "xn--e1afmkfd.xn--p1ai"])("accepts %s", (h) => {
    expect(isHostname(h)).toBe(true);
  });
  it.each(["paytm money limited", "-bad.com", "bad-.com", "no_dots", "a..b.com", "", "x".repeat(300) + ".com"])("rejects %j", (h) => {
    expect(isHostname(h)).toBe(false);
  });
});
