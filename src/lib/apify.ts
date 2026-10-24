import type { Brand, Candidate, SourceStatus } from "./types";

// Optional extra data source: a Google web search for scam-style phrases about the brand ("<brand> KYC update
// apk", "<brand> customer care number"), run through the Apify actor apify/google-search-scraper. It finds
// look-alike and spam pages that no app store or DNS check can see, including scam pages planted on hacked
// third-party sites. It only ever ADDS candidates: the built-in sources stay the fallback, and a failure here
// is reported in the source list and never stops the scan. Candidates go through the normal pipeline afterwards
// (official-asset check, then the one scorer).
//
// Off unless APIFY_ENABLED=true AND APIFY_TOKEN is set. The token is only ever sent in an Authorization header
// and is never logged or returned to the browser.

export const APIFY_ACTOR = "apify~google-search-scraper";
export const APIFY_LABEL = "Apify: Google web search";

/** Limits per run. Each search page costs about $0.0018, so two queries of one page each cost under half a cent. */
const MAX_QUERIES = 2;
export const MAX_RESULTS = 20; // never read more than this many web results back
// Apify rejects a per-run ceiling below $0.50 for this actor. The real spend is bounded by the two one-page
// queries above (about $0.004); the ceiling is only a backstop.
const MAX_SPEND_USD = "0.5";
const ACTOR_TIMEOUT_S = 40; // Apify aborts the run after this long (a run normally takes about 25 s)
const CLIENT_DEADLINE_MS = 45_000; // and so do we (the scan route has a 60 s budget)

type Result = { candidates: Candidate[]; status: SourceStatus };

/** One Google results page as the actor returns it. Every field is optional because the shape is not ours. */
export interface ApifyPage {
  searchQuery?: { term?: string };
  organicResults?: { title?: string; url?: string; description?: string; position?: number; type?: string }[];
}

// Pages that other sources already cover, or that are only social media: never worth a candidate of their own.
const SKIP_HOSTS = ["google.com", "youtube.com", "youtu.be", "wikipedia.org", "facebook.com", "instagram.com", "x.com", "twitter.com", "linkedin.com", "reddit.com"];

export function apifyEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.APIFY_ENABLED === "true" && !!env.APIFY_TOKEN;
}

function hostOf(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

const skipped = (host: string) => SKIP_HOSTS.some((s) => host === s || host.endsWith(`.${s}`));

/**
 * Turn Google result pages into Candidates, one per web page. The page title is the name (what a victim reads,
 * and what the scorer compares with the brand), the site's address is the handle, and the snippet is the
 * description so the scorer can read the scam wording and phone numbers.
 */
export function normalizeApifyPages(pages: unknown): Candidate[] {
  if (!Array.isArray(pages)) return [];
  const out = new Map<string, Candidate>();
  for (const raw of pages) {
    const results = (raw as ApifyPage | null)?.organicResults;
    if (!Array.isArray(results)) continue;
    for (const r of results) {
      if (out.size >= MAX_RESULTS) break;
      const host = hostOf(r?.url);
      if (!host || skipped(host)) continue;
      const u = new URL(r.url as string);
      const id = `web-${host}${u.pathname}`.replace(/\/+$/, "").slice(0, 160);
      if (out.has(id)) continue;
      const title = typeof r.title === "string" && r.title.trim() ? r.title.trim() : host;
      const snippet = typeof r.description === "string" ? r.description.replace(/\s*\.{3}\s*Read more$/i, "").replace(/\s+/g, " ").trim() : "";
      out.set(id, {
        id,
        platform: "domain",
        source: "live",
        kind: "page",
        name: title,
        handle: host,
        url: r.url,
        description: snippet.slice(0, 600),
        via: APIFY_LABEL,
      });
    }
  }
  return [...out.values()];
}

/** Scam-style searches: the phrases fraudsters write pages and apps around. Two only, because each is paid for. */
export function apifyQueries(brand: Brand): string[] {
  return [`${brand.name} KYC update apk`, `${brand.name} customer care number`].slice(0, MAX_QUERIES);
}

/** Runs the actor once and returns its dataset items. Throws a short, secret-free message on any failure. */
async function runActor(brand: Brand, token: string, fetchImpl: typeof fetch): Promise<unknown> {
  const qs = new URLSearchParams({
    timeout: String(ACTOR_TIMEOUT_S),
    maxItems: String(MAX_QUERIES),
    maxTotalChargeUsd: MAX_SPEND_USD,
    format: "json",
    clean: "true",
  });
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), CLIENT_DEADLINE_MS);
  try {
    const r = await fetchImpl(`https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?${qs}`, {
      method: "POST",
      signal: ctl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        queries: apifyQueries(brand).join("\n"),
        maxPagesPerQuery: 1,
        resultsPerPage: 10,
        countryCode: "in",
        languageCode: "en",
      }),
    });
    if (!r.ok) throw new Error(`Apify answered HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    if (ctl.signal.aborted) throw new Error(`Apify did not answer within ${CLIENT_DEADLINE_MS / 1000}s`);
    throw e instanceof Error && e.message.startsWith("Apify") ? e : new Error("Apify request failed");
  } finally {
    clearTimeout(timer);
  }
}

/** The scan entry point. Never throws: any failure becomes an "unavailable" status with no candidates. */
export async function scanApify(
  brand: Brand,
  opts: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch } = {},
): Promise<Result> {
  const t0 = Date.now();
  const env = opts.env ?? process.env;
  const status = (ok: boolean, count: number, note?: string): SourceStatus => ({
    platform: "domain",
    label: APIFY_LABEL,
    source: "live",
    ok,
    count,
    note,
    ms: Date.now() - t0,
  });
  try {
    const pages = await runActor(brand, env.APIFY_TOKEN ?? "", opts.fetchImpl ?? fetch);
    const candidates = normalizeApifyPages(pages);
    if (!candidates.length) throw new Error("Apify returned no usable results");
    return { candidates, status: status(true, candidates.length) };
  } catch (e) {
    const note = e instanceof Error ? e.message : "Apify failed";
    console.warn(`[apify] ${note}`); // message only: never the token, URL or request
    return { candidates: [], status: status(false, 0, note) };
  }
}
