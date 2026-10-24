import { afterEach, describe, expect, it, vi } from "vitest";
import sample from "./fixtures/apify-search-sample.json";
import { APIFY_ACTOR, APIFY_LABEL, MAX_ITEMS, apifyEnabled, apifyKeywords, normalizeApifyItems, scanApify } from "@/lib/apify";
import { mergeExtra } from "@/lib/connectors";
import { officialReason, scoreCandidate } from "@/lib/scoring";
import type { Brand, Candidate } from "@/lib/types";

const brand: Brand = {
  name: "Paytm",
  officialHandles: [],
  officialDomains: ["paytm.com"],
  officialDevelopers: ["One97 Communications"],
  officialPhones: [],
  officialApps: ["473941634", "net.one97.paytm"],
};

const TOKEN = "apify_api_TEST_TOKEN_DO_NOT_LEAK";
const env = { APIFY_ENABLED: "true", APIFY_TOKEN: TOKEN };

const okFetch = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

afterEach(() => vi.restoreAllMocks());

describe("normalizeApifyItems", () => {
  const cands = normalizeApifyItems(sample);

  it("turns store results into app candidates with the same ids the built-in sources use", () => {
    expect(cands.map((c) => c.id)).toEqual([
      "ios-473941634",
      "play-net.one97.paytm",
      "play-com.paytm.kyc.rewards",
      "ios-6502000111", // "id6502000111" -> store id without the "id" prefix
      "ios-6502000222", // no appId: read from the link
    ]);
    const play = cands.find((c) => c.id === "play-com.paytm.kyc.rewards")!;
    expect(play).toMatchObject({
      platform: "play-store",
      source: "live",
      kind: "app",
      name: "Paytm KYC Rewards Official",
      handle: "com.paytm.kyc.rewards",
      developer: "Quick Cash Studio",
      ratings: 312,
      via: APIFY_LABEL,
    });
    expect(cands.find((c) => c.id === "ios-6502000111")).toMatchObject({ platform: "app-store", handle: "6502000111" });
  });

  it("labels every candidate with where it came from", () => {
    expect(cands.every((c) => c.via === APIFY_LABEL && c.source === "live")).toBe(true);
  });

  it("skips rows with no title, an unknown store, no usable id, junk values, and duplicates", () => {
    expect(cands.find((c) => c.name === "Paytm Helper")).toBeUndefined();
    expect(cands.find((c) => c.handle === "com.example.untitled")).toBeUndefined();
    expect(new Set(cands.map((c) => c.id)).size).toBe(cands.length);
  });

  it("returns nothing for output that is not a list", () => {
    expect(normalizeApifyItems(null)).toEqual([]);
    expect(normalizeApifyItems({ error: "x" })).toEqual([]);
    expect(normalizeApifyItems("oops")).toEqual([]);
  });

  it("never reads more than the result cap", () => {
    const many = Array.from({ length: MAX_ITEMS + 40 }, (_, i) => ({ store: "googlePlay", appId: `com.fake.a${i}`, title: `Paytm ${i}`, url: `https://play.google.com/store/apps/details?id=com.fake.a${i}` }));
    expect(normalizeApifyItems(many)).toHaveLength(MAX_ITEMS);
  });
});

describe("official assets and scoring (the shared pipeline)", () => {
  const cands = normalizeApifyItems(sample);

  it("recognises the brand's own apps from Apify results, so they are never flagged", () => {
    const own = cands.filter((c) => officialReason(c, brand));
    expect(own.map((c) => c.id).sort()).toEqual(["ios-473941634", "play-net.one97.paytm"]);
    for (const c of own) expect(scoreCandidate(c, brand)).toBeNull();
  });

  it("scores the look-alikes with the normal scorer", () => {
    const fake = cands.find((c) => c.id === "play-com.paytm.kyc.rewards")!;
    const f = scoreCandidate(fake, brand);
    expect(f).not.toBeNull();
    expect(f!.score).toBeGreaterThan(35);
    expect(f!.signals.length).toBeGreaterThan(0);
  });
});

describe("scanApify (never breaks the scan)", () => {
  it("returns candidates and an ok status labelled as Apify when the actor answers", async () => {
    const r = await scanApify(brand, { env, fetchImpl: okFetch(sample) });
    expect(r.status).toMatchObject({ ok: true, count: 5, label: APIFY_LABEL, source: "live" });
    expect(r.candidates).toHaveLength(5);
  });

  it("sends the token only in the Authorization header, with the cost and time limits in the request", async () => {
    const f = okFetch(sample);
    await scanApify(brand, { env, fetchImpl: f });
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain(TOKEN);
    expect(url).toContain(APIFY_ACTOR);
    expect(url).toContain("maxTotalChargeUsd=0.05");
    expect(url).toContain(`maxItems=${MAX_ITEMS}`);
    expect(url).toContain("timeout=15");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect(String(init.body)).not.toContain(TOKEN);
    expect(JSON.parse(String(init.body)).keywords).toEqual(apifyKeywords(brand));
  });

  it.each([
    ["an HTTP error", () => new Response("{}", { status: 500 }), "HTTP 500"],
    ["a payment-required answer", () => new Response("{}", { status: 402 }), "HTTP 402"],
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
    await vi.advanceTimersByTimeAsync(19_000);
    const r = await p;
    vi.useRealTimers();
    expect(r.status.ok).toBe(false);
    expect(r.status.note).toContain("did not answer");
  });
});

describe("mergeExtra (one failing source must not stop the scan)", () => {
  const builtIn = (c: Candidate[]) => ({ candidates: c, status: { platform: "play-store" as const, source: "live" as const, ok: true, count: c.length } });
  const play = normalizeApifyItems(sample).find((c) => c.id === "play-com.paytm.kyc.rewards")!;

  it("keeps every built-in result when Apify failed", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const failed = await scanApify(brand, { env, fetchImpl: (async () => new Response("{}", { status: 500 })) as unknown as typeof fetch });
    const merged = mergeExtra([builtIn([play])], failed);
    expect(merged).toHaveLength(2);
    expect(merged[0].candidates).toEqual([play]);
    expect(merged[1].status.ok).toBe(false);
  });

  it("drops Apify results the built-in sources already found, so nothing is listed twice", () => {
    const apify = { candidates: normalizeApifyItems(sample), status: { platform: "app-store" as const, source: "live" as const, ok: true, count: 5, label: APIFY_LABEL } };
    const merged = mergeExtra([builtIn([play])], apify);
    const ids = merged.flatMap((r) => r.candidates.map((c) => c.id));
    expect(ids.filter((i) => i === "play-com.paytm.kyc.rewards")).toHaveLength(1);
    expect(merged[1].status.count).toBe(4);
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
