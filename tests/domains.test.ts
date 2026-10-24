import { describe, expect, it } from "vitest";
import { domainPermutations } from "@/lib/domains";

const paytm = { name: "Paytm", officialDomains: ["paytm.com"] };

describe("domainPermutations", () => {
  const out = domainPermutations(paytm);

  it("builds typo, scam-word and other-ending variants", () => {
    expect(out).toContain("payttm.com"); // doubled letter
    expect(out).toContain("patym.com"); // swapped letters
    expect(out).toContain("payt.com"); // missing letter
    expect(out).toContain("paytmsupport.com");
    expect(out).toContain("kycpaytm.in");
    expect(out).toContain("paytm.in");
    expect(out).toContain("paytm-refund.com");
  });

  it("never returns the brand's own domain or its subdomains", () => {
    expect(out).not.toContain("paytm.com");
    expect(out.some((h) => h.endsWith(".paytm.com"))).toBe(false);
  });

  it("only returns valid hostnames, without duplicates, within the cap", () => {
    expect(out.every((h) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h))).toBe(true);
    expect(new Set(out).size).toBe(out.length);
    expect(out.length).toBeLessThanOrEqual(400);
    expect(domainPermutations(paytm, 20)).toHaveLength(20);
  });

  it("handles a two-part ending like co.in", () => {
    const r = domainPermutations({ name: "Acme Pay", officialDomains: ["acmepay.co.in"] });
    expect(r).toContain("acmepay.com");
    expect(r).not.toContain("acmepay.co.in");
    expect(r).toContain("acmepaysupport.co.in");
  });

  it("falls back to the brand name when no domain is listed, and skips very short names", () => {
    expect(domainPermutations({ name: "Zomato", officialDomains: [] })).toContain("zomatosupport.com");
    expect(domainPermutations({ name: "X", officialDomains: [] })).toEqual([]);
  });
});
