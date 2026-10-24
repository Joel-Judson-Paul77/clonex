import type { Brand, Candidate, SourceStatus } from "./types";

// Optional extra data source: app-store keyword search (Apple App Store + Google Play in one run) through the
// Apify actor cheapapi/app-store-google-play-scraper, "search" mode. It only ever ADDS candidates: the built-in
// sources stay the fallback, and a failure here is reported in the source list and never stops the scan.
// Candidates go through the normal pipeline afterwards (official-asset check, then the one scorer).
//
// Off unless APIFY_ENABLED=true AND APIFY_TOKEN is set. The token is only ever sent in an Authorization header
// and is never logged or returned to the browser.

export const APIFY_ACTOR = "cheapapi~app-store-google-play-scraper";
export const APIFY_LABEL = "Apify: App Store + Google Play search";

/** Hard limits per run. Search results cost about $0.00015 each, so these keep one run well under a cent. */
const MAX_KEYWORDS = 2;
const MAX_RESULTS_PER_KEYWORD = 30; // the actor's minimum for search
export const MAX_ITEMS = 50; // never read more than this many results back
const MAX_SPEND_USD = "0.05"; // Apify stops the run when this is reached
const ACTOR_TIMEOUT_S = 15; // Apify aborts the run after this long
const CLIENT_DEADLINE_MS = 18_000; // and so do we (the scan route has a 60 s budget)

type Result = { candidates: Candidate[]; status: SourceStatus };

/** One search result as the actor returns it. Every field is optional because the shape is not under our control. */
export interface ApifySearchItem {
  type?: string;
  keyword?: string;
  rank?: number;
  appId?: string | number;
  id?: string | number;
  title?: string;
  url?: string;
  iconUrl?: string;
  developer?: string;
  developerUrl?: string;
  rating?: number;
  ratingsCount?: number;
  store?: string;
  storeName?: string;
}

export function apifyEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.APIFY_ENABLED === "true" && !!env.APIFY_TOKEN;
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Which store a result belongs to, from its link first, then from the store field. */
function storeOf(item: ApifySearchItem): "app-store" | "play-store" | null {
  const url = str(item.url) ?? "";
  if (/^https?:\/\/(apps|itunes)\.apple\.com\//i.test(url)) return "app-store";
  if (/^https?:\/\/play\.google\.com\//i.test(url)) return "play-store";
  const s = `${item.store ?? ""} ${item.storeName ?? ""}`.toLowerCase();
  if (/apple|app\s*store|ios/.test(s)) return "app-store";
  if (/google|play/.test(s)) return "play-store";
  return null;
}

/** Turn actor output into our own Candidate shape. Rows that are not apps, or are unusable, are skipped. */
export function normalizeApifyItems(items: unknown): Candidate[] {
  if (!Array.isArray(items)) return [];
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const raw of items.slice(0, MAX_ITEMS)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as ApifySearchItem;
    const title = str(item.title);
    const store = storeOf(item);
    if (!title || !store) continue;
    const rawId = String(item.appId ?? item.id ?? "").trim();
    // same id formats as the built-in sources, so the official-app check and de-duplication work across them
    const storeId = store === "app-store" ? (rawId.match(/^(?:id)?(\d+)$/i)?.[1] ?? str(item.url)?.match(/\/id(\d+)/)?.[1]) : rawId;
    if (!storeId) continue;
    const id = store === "app-store" ? `ios-${storeId}` : `play-${storeId}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      platform: store,
      source: "live",
      kind: "app",
      name: title,
      handle: storeId,
      developer: str(item.developer),
      url: str(item.url),
      iconUrl: str(item.iconUrl),
      ratings: typeof item.ratingsCount === "number" ? item.ratingsCount : undefined,
      via: APIFY_LABEL,
    });
  }
  return out;
}

/** Search words: the brand itself and one scam-style phrase. Few on purpose: each keyword is paid for. */
export function apifyKeywords(brand: Brand): string[] {
  return [brand.name, `${brand.name} official`].slice(0, MAX_KEYWORDS);
}

/** Runs the actor once and returns its dataset items. Throws a short, secret-free message on any failure. */
async function runActor(brand: Brand, token: string, fetchImpl: typeof fetch): Promise<unknown> {
  const qs = new URLSearchParams({
    timeout: String(ACTOR_TIMEOUT_S),
    maxItems: String(MAX_ITEMS),
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
        mode: "search",
        keywords: apifyKeywords(brand),
        maxResults: MAX_RESULTS_PER_KEYWORD,
        store: "both",
        country: "IN",
        language: "en",
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
    platform: "app-store",
    label: APIFY_LABEL,
    source: "live",
    ok,
    count,
    note,
    ms: Date.now() - t0,
  });
  try {
    const items = await runActor(brand, env.APIFY_TOKEN ?? "", opts.fetchImpl ?? fetch);
    const candidates = normalizeApifyItems(items);
    if (!candidates.length) throw new Error("Apify returned no usable results");
    return { candidates, status: status(true, candidates.length) };
  } catch (e) {
    const note = e instanceof Error ? e.message : "Apify failed";
    console.warn(`[apify] ${note}`); // message only: never the token, URL or request
    return { candidates: [], status: status(false, 0, note) };
  }
}
