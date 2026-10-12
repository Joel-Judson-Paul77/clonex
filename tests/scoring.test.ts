import { describe, expect, it } from "vitest";
import { isOfficial, officialReason, scoreCandidate } from "@/lib/scoring";
import type { Brand, Candidate } from "@/lib/types";

const paytm: Brand = {
  name: "Paytm",
  officialHandles: ["paytm", "paytm.bsky.social"],
  officialDomains: ["paytm.com"],
  officialDevelopers: ["One97 Communications", "PayTM Mobile Solutions Private Limited"],
  officialPhones: ["1800 120 1243"],
  officialApps: ["473941634", "net.one97.paytm"],
};

const cand = (over: Partial<Candidate>): Candidate => ({
  id: "x",
  platform: "telegram",
  source: "live",
  kind: "profile",
  name: "Example",
  ...over,
});

describe("official assets are never flagged", () => {
  it("excludes an official handle", () => {
    const c = cand({ handle: "paytm", name: "Paytm" });
    expect(officialReason(c, paytm)).toMatch(/official handle/);
    expect(scoreCandidate(c, paytm)).toBeNull();
  });

  it("excludes an app by store ID, by package and by publisher", () => {
    expect(isOfficial(cand({ kind: "app", platform: "app-store", id: "ios-473941634", handle: "473941634" }), paytm)).toBe(true);
    expect(isOfficial(cand({ kind: "app", platform: "play-store", handle: "net.one97.paytm" }), paytm)).toBe(true);
    const byPublisher = cand({ kind: "app", platform: "play-store", name: "Paytm for Business", developer: "One97 Communications Ltd." });
    expect(scoreCandidate(byPublisher, paytm)).toBeNull();
  });

  it("excludes the brand's own domain and subdomains", () => {
    expect(isOfficial(cand({ kind: "domain", platform: "domain", handle: "paytm.com" }), paytm)).toBe(true);
    expect(isOfficial(cand({ kind: "domain", platform: "domain", handle: "pay.paytm.com" }), paytm)).toBe(true);
    expect(isOfficial(cand({ kind: "domain", platform: "domain", handle: "paytm.com.evil.io" }), paytm)).toBe(false);
  });

  it("does not let a very short publisher string match everything", () => {
    const c = cand({ kind: "app", platform: "play-store", name: "Paytm Loan", developer: "Ltd" });
    expect(officialReason(c, { ...paytm, officialDevelopers: ["Ltd"] })).toBeNull();
  });
});

describe("impersonation is flagged with a score and reasons", () => {
  it("flags a scam channel with a scam word in the name", () => {
    const f = scoreCandidate(cand({ name: "Paytm kyc 250", handle: "kycpaytm", description: "Update KYC now and get refund" }), paytm);
    expect(f).not.toBeNull();
    expect(f!.score).toBeGreaterThanOrEqual(55);
    expect(f!.signals.some((s) => s.key === "nameword")).toBe(true);
    expect(f!.summary).toMatch(/impersonation of Paytm/i);
  });

  it("flags an unofficial phone number as a strong signal", () => {
    const f = scoreCandidate(
      cand({ name: "Paytm Customer Care", handle: "paytm_support_official", platform: "instagram", description: "Official Paytm support. Call +91 98765 43210 immediately." }),
      paytm,
    );
    expect(f).not.toBeNull();
    expect(f!.phones.length).toBeGreaterThan(0);
    expect(f!.severity).toBe("critical");
  });

  it("does not count the brand's own support number as rogue", () => {
    const f = scoreCandidate(cand({ name: "Paytm Support", handle: "paytm_support", description: "Call 1800 120 1243" }), paytm);
    expect(f?.phones ?? []).toEqual([]);
  });

  it("flags a copied logo even when the name differs", () => {
    const f = scoreCandidate(cand({ kind: "app", platform: "play-store", name: "Pay Wallet Pro", logoSim: 0.9, developer: "Someone Else" }), paytm);
    expect(f).not.toBeNull();
    expect(f!.signals.some((s) => s.key === "logo")).toBe(true);
  });

  it("scores a character-swap trick", () => {
    const f = scoreCandidate(cand({ name: "p4ytm", handle: "p4ytm", description: "Cashback offers" }), paytm);
    expect(f).not.toBeNull();
    expect(f!.signals.some((s) => s.key === "homoglyph")).toBe(true);
  });
});

describe("over-flagging guards", () => {
  it("ignores unrelated names", () => {
    expect(scoreCandidate(cand({ name: "Weather Today", handle: "weather" }), paytm)).toBeNull();
  });

  it("needs a second signal before a profile is flagged on its name alone", () => {
    expect(scoreCandidate(cand({ name: "paytm fan page", handle: "paytmfans", description: "Photos and memes" }), paytm)).toBeNull();
  });

  it("does not turn a certificate alone into evidence", () => {
    expect(scoreCandidate(cand({ kind: "domain", platform: "domain", name: "paytm.example.org", handle: "paytm.example.org" }), paytm)).toBeNull();
  });

  it("keeps a third-party tool 'for <brand>' below high risk", () => {
    const f = scoreCandidate(cand({ kind: "app", platform: "play-store", name: "Stats for Paytm", developer: "Some Studio", description: "Track your spending" }), paytm);
    if (f) {
      expect(f.score).toBeLessThanOrEqual(49);
      expect(["medium", "low"]).toContain(f.severity);
    }
  });

  it("does not use ordinary finance words in an app description as scam evidence", () => {
    const f = scoreCandidate(
      cand({ kind: "app", platform: "play-store", name: "Loan Calculator", developer: "Calc Apps", description: "Instant loan, reward points and customer care" }),
      { ...paytm, name: "CRED" },
    );
    expect(f).toBeNull();
  });
});

describe("severity bands", () => {
  it("maps the score to critical, high, medium or low", () => {
    const strong = scoreCandidate(
      cand({ name: "Paytm Customer Care", handle: "paytm_help", platform: "instagram", logoSim: 0.9, description: "Official support, KYC update. Call +91 98765 43210" }),
      paytm,
    );
    expect(strong?.severity).toBe("critical");
    expect(strong!.score).toBeLessThanOrEqual(100);
  });
});
