import { afterEach, describe, expect, it, vi } from "vitest";
import sample from "./fixtures/apify-search-sample.json";
import { APIFY_ACTOR, APIFY_LABEL, MAX_RESULTS, apifyEnabled, apifyQueries, normalizeApifyPages, scanApify } from "@/lib/apify";
import { mergeExtra } from "@/lib/connectors";
import { officialReason, scoreCandidate } from "@/lib/scoring";
import type { Brand, Candidate } from "@/lib/types";

// tests/fixtures/apify-search-sample.json is real output of apify/google-search-scraper for the two queries
// below (trimmed to the fields we read), saved once so the tests never call Apify.

const brand: Brand = {
  name: "Paytm",
  officialHandles: [],
  officialDomains: ["paytm.com"],
  officialDevelopers: ["One97 Communications"],
  officialPhones: [],
  officialApps: [],
};

const TOKEN = "apify_api_TEST_TOKEN_DO_NOT_LEAK";
const env = { APIFY_ENABLED: "true", APIFY_TOKEN: TOKEN };

const okFetch = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

afterEach(() => vi.restoreAllMocks());

describe("normalizeApifyPages", () => {
  const cands = normalizeApifyPages(sample);
  const byUrl = (u: string) => cands.find((c) => c.url === u);

  it("turns web results into page candidates: the title is the name, the site is the handle", () => {
    expect(byUrl("https://kyas.wbhealth.gov.in/latest/paytm-kyc-update/")).toMatchObject({
      id: "web-kyas.wbhealth.gov.in/latest/paytm-kyc-update",
      platform: "domain",
      kind: "page",
      source: "live",
      name: "Paytm Kyc Update - APK Download Today & Bonus Info",
      handle: "kyas.wbhealth.gov.in",
      via: APIFY_LABEL,
    });
    expect(new Set(cands.map((c) => c.id)).size).toBe(cands.length);
  });

  it("keeps the snippet as the description, without Google's trailing 'Read more'", () => {
    const d = byUrl("https://kyas.wbhealth.gov.in/latest/paytm-kyc-update/")!.description!;
    expect(d).toContain("complete Paytm KYC update");
    expect(d).not.toContain("Read more");
  });

  it("skips social, video and search-engine pages, which other sources cover", () => {
    expect(cands.some((c) => /youtube|google\./.test(c.handle ?? ""))).toBe(false);
  });

  it("returns nothing for output that is not a list of result pages", () => {
    expect(normalizeApifyPages(null)).toEqual([]);
    expect(normalizeApifyPages({ error: "x" })).toEqual([]);
    expect(normalizeApifyPages([null, "x", {}, { organicResults: "no" }, { organicResults: [{ url: "javascript:alert(1)" }, { url: "not a url" }] }])).toEqual([]);
  });

  it("never reads more than the result cap", () => {
    const many = [{ organicResults: Array.from({ length: MAX_RESULTS + 30 }, (_, i) => ({ title: `Paytm ${i}`, url: `https://paytm-fake${i}.example.com/` })) }];
    expect(normalizeApifyPages(many)).toHaveLength(MAX_RESULTS);
  });
});

describe("official assets and scoring (the shared pipeline)", () => {
  const cands = normalizeApifyPages(sample);

  it("recognises pages on the brand's own domain, subdomains included, so they are never flagged", () => {
    const own = cands.filter((c) => officialReason(c, brand));
    expect(own.length).toBeGreaterThanOrEqual(8);
    expect(own.every((c) => /(^|\.)paytm\.com$/.test(c.handle!))).toBe(true);
    for (const c of own) expect(scoreCandidate(c, brand)).toBeNull();
  });

  it("flags a scam-style page on a third-party site with the normal scorer", () => {
    const page = cands.find((c) => c.handle === "kyas.wbhealth.gov.in")!;
    const f = scoreCandidate(page, brand);
    expect(f).not.toBeNull();
    expect(f!.score).toBeGreaterThanOrEqual(35);
    expect(f!.signals.map((s) => s.key)).toContain("nameword");
  });
});

describe("scanApify (never breaks the scan)", () => {
  it("returns candidates and an ok status labelled as Apify when the actor answers", async () => {
    const r = await scanApify(brand, { env, fetchImpl: okFetch(sample) });
    expect(r.status).toMatchObject({ ok: true, label: APIFY_LABEL, source: "live", platform: "domain" });
    expect(r.status.count).toBe(r.candidates.length);
    expect(r.candidates.length).toBeGreaterThan(10);
  });

  it("sends the token only in the Authorization header, with the time and result limits in the request", async () => {
    const f = okFetch(sample);
    await scanApify(brand, { env, fetchImpl: f });
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain(TOKEN);
    expect(url).toContain(APIFY_ACTOR);
    expect(url).toContain("timeout=40");
    expect(url).toContain("maxItems=2");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect(String(init.body)).not.toContain(TOKEN);
    const body = JSON.parse(String(init.body));
    expect(body.queries.split("\n")).toEqual(apifyQueries(brand));
    expect(body.maxPagesPerQuery).toBe(1);
  });

  it.each([
    ["an HTTP error", () => new Response("{}", { status: 500 }), "HTTP 500"],
    ["a payment-required answer", () => new Response("{}", { status: 402 }), "HTTP 402"],
    ["a timed-out run", () => new Response("{}", { status: 400 }), "HTTP 400"],
    ["an empty result", () => new Response("[]", { status: 200 }), "no usable results"],
    ["output that is not JSON", () => new Response("<html>", { status: 200 }), "failed"],
  ])("skips the source on %s, with no candidates and a clear note", async (_name, make, note) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await scanApify(brand, { env, fetchImpl: (async () => make()) as unknown as typeof fetch });
    expect(r.candidates).toEqual([]);
    expect(r.status.ok).toBe(false);
    expect(r.status.note).toContain(note);
    expect(warn).toHaveBeenCalled();
  });

  it("skips the source when the network call throws, without leaking the token", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const boom = (async () => {
      throw new Error(`socket hang up while sending ${TOKEN}`);
    }) as unknown as typeof fetch;
    const r = await scanApify(brand, { env, fetchImpl: boom });
    expect(r.status.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain(TOKEN);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(TOKEN);
  });

  it("gives up after the deadline instead of hanging the scan", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const hang = ((_u: string, init: RequestInit) =>
      new Promise((_res, rej) => init.signal?.addEventListener("abort", () => rej(new Error("aborted"))))) as unknown as typeof fetch;
    const p = scanApify(brand, { env, fetchImpl: hang });
    await vi.advanceTimersByTimeAsync(46_000);
    const r = await p;
    vi.useRealTimers();
    expect(r.status.ok).toBe(false);
    expect(r.status.note).toContain("did not answer");
  });
});

describe("mergeExtra (one failing source must not stop the scan)", () => {
  const builtIn = (c: Candidate[]) => ({ candidates: c, status: { platform: "domain" as const, source: "live" as const, ok: true, count: c.length } });
  const web = normalizeApifyPages(sample);

  it("keeps every built-in result when Apify failed", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const failed = await scanApify(brand, { env, fetchImpl: (async () => new Response("{}", { status: 500 })) as unknown as typeof fetch });
    const merged = mergeExtra([builtIn([web[0]])], failed);
    expect(merged).toHaveLength(2);
    expect(merged[0].candidates).toEqual([web[0]]);
    expect(merged[1].status.ok).toBe(false);
  });

  it("drops Apify results a built-in source already found, so no site is listed twice", () => {
    const apify = { candidates: web, status: { platform: "domain" as const, source: "live" as const, ok: true, count: web.length, label: APIFY_LABEL } };
    const merged = mergeExtra([builtIn([web[0]])], apify);
    const ids = merged.flatMap((r) => r.candidates.map((c) => c.id));
    expect(ids.filter((i) => i === web[0].id)).toHaveLength(1);
    expect(merged[1].status.count).toBe(web.length - 1);
  });
});

describe("feature flag", () => {
  it("is off unless both the flag and a token are set", () => {
    expect(apifyEnabled({})).toBe(false);
    expect(apifyEnabled({ APIFY_ENABLED: "true" })).toBe(false);
    expect(apifyEnabled({ APIFY_TOKEN: "x" })).toBe(false);
    expect(apifyEnabled({ APIFY_ENABLED: "false", APIFY_TOKEN: "x" })).toBe(false);
    expect(apifyEnabled({ APIFY_ENABLED: "true", APIFY_TOKEN: "x" })).toBe(true);
  });
});
