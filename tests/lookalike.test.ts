import { describe, expect, it } from "vitest";
import { extractPhones, generateVariants, levenshtein, nameSimilarity, normalize } from "@/lib/lookalike";

describe("normalize", () => {
  it("lower-cases and strips spacing and punctuation", () => {
    expect(normalize("Pa Ytm")).toBe("paytm");
    expect(normalize("pay-tm")).toBe("paytm");
    expect(normalize("P A Y T M")).toBe("paytm");
  });

  it("maps look-alike characters back to letters", () => {
    expect(normalize("p4ytm")).toBe("paytm");
    expect(normalize("paytrn")).toBe("paytm"); // rn reads as m
  });
});

describe("levenshtein", () => {
  it("counts single edits and a swapped pair as one", () => {
    expect(levenshtein("paytm", "paytm")).toBe(0);
    expect(levenshtein("paytm", "paytmm")).toBe(1);
    expect(levenshtein("paytm", "pyatm")).toBe(1);
  });
});

describe("nameSimilarity: tricks that should match", () => {
  const brand = "Paytm";
  it.each([
    ["Paytm", 1],
    ["pa ytm", 1],
    ["p a y t m", 1],
    ["PAYTM", 1],
  ])("%s is identical once spacing and case are removed", (name, min) => {
    expect(nameSimilarity(name, brand)).toBeGreaterThanOrEqual(min);
  });

  it.each(["Paytm Support", "paytm_care", "kycpaytm", "refundpaytm", "Paytm Customer Care", "paytm247", "24x7 paytm", "Official Paytm"])(
    "%s (brand plus a scam-style word) is a strong match",
    (name) => {
      expect(nameSimilarity(name, brand)).toBeGreaterThanOrEqual(0.8);
    },
  );

  it.each(["pyatm", "paytmm", "payttm", "p4ytm"])("%s (typo or character swap) is a close match", (name) => {
    expect(nameSimilarity(name, brand)).toBeGreaterThanOrEqual(0.75);
  });

  it("tolerates a one-letter typo plus an added word", () => {
    expect(nameSimilarity("Paytmm Official", brand)).toBeGreaterThanOrEqual(0.8);
  });
});

describe("nameSimilarity: names that must not match", () => {
  it("does not treat a different word containing the brand letters as the brand", () => {
    expect(nameSimilarity("InCred", "CRED")).toBeLessThan(0.6);
    expect(nameSimilarity("Credit4Sure Pro", "CRED")).toBeLessThan(0.6);
  });

  it("does not match unrelated names", () => {
    expect(nameSimilarity("Weather Today", "Paytm")).toBeLessThan(0.5);
    expect(nameSimilarity("Zomato", "Paytm")).toBeLessThan(0.5);
  });

  it("treats two edits on a short brand as a different word, but still allows one (a typo)", () => {
    expect(nameSimilarity("Slimy", "Slice")).toBeLessThan(0.6); // two edits
    expect(nameSimilarity("Slick", "Slice")).toBeGreaterThanOrEqual(0.75); // one edit
  });
});

describe("generateVariants", () => {
  const v = generateVariants("Paytm");

  it("proposes squatted handles, typos and look-alike characters", () => {
    expect(v.handles).toContain("paytmkyc");
    expect(v.handles).toContain("paytm_support");
    expect(v.handles).toContain("refundpaytm");
    expect(v.handles).toContain("pyatm"); // swapped letters
    expect(v.handles).toContain("paytrn"); // m written as rn
  });

  it("never proposes the brand itself and keeps handles a sensible length", () => {
    expect(v.handles).not.toContain("paytm");
    expect(v.handles.every((h) => h.length >= 4 && h.length <= 32)).toBe(true);
  });

  it("searches the brand and brand plus common scam words", () => {
    expect(v.terms).toContain("Paytm");
    expect(v.terms.some((t) => /support/.test(t))).toBe(true);
  });
});

describe("extractPhones", () => {
  it("finds Indian mobile and helpline numbers in text", () => {
    const phones = extractPhones("Call +91 98765 43210 now, or 1800 123 4567");
    expect(phones.length).toBeGreaterThanOrEqual(1);
    expect(phones.join(" ").replace(/\D/g, "")).toContain("9876543210");
  });

  it("returns nothing when there is no number", () => {
    expect(extractPhones("No phone here, just words")).toEqual([]);
  });
});
