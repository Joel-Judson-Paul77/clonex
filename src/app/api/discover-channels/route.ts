import { lookup } from "node:dns/promises";
import { NextResponse } from "next/server";
import { ApiError, errorResponse, rateLimit } from "@/lib/api-guard";
import { isHostname } from "@/lib/connectors";
import { emptyChannels, extractChannels, mergeChannels, wikidataAccounts, wikidataMatchesDomain, youtubeHandleFromPage } from "@/lib/discover";
import type { Channels, WikidataEntity } from "@/lib/discover";

export const maxDuration = 25;

// GET /api/discover-channels?domain=paytm.com&name=Paytm
// Returns the brand's official YouTube, Telegram and Bluesky accounts, from (1) links on its own website and
// (2) Wikidata. The server fetches a URL it was given, so for the brand's website it only talks to public
// internet addresses on that domain, follows at most three redirects inside it, and caps time and size.

const MAX_BYTES = 1_500_000;
const UA = "Mozilla/5.0 (compatible; CloneXBot/1.0; brand-protection research)";
const cache = new Map<string, { at: number; value: Result }>();
const TTL = 6 * 60 * 60 * 1000;

interface Result {
  domain: string;
  status: "ok" | "none" | "unreachable";
  found: { youtube: string[]; telegram: string[]; bluesky: string[] };
  /** where each account was found, keyed "kind:handle" */
  sources: Record<string, string>;
}

const sameSite = (host: string, domain: string) => host === domain || host === `www.${domain}` || host.endsWith(`.${domain}`);

async function assertPublic(host: string) {
  const { isPublicIp } = await import("@/lib/discover");
  const addrs = await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => !isPublicIp(a.address))) throw new Error("not a public address");
}

async function readCapped(r: Response): Promise<string> {
  const reader = r.body?.getReader();
  if (!reader) throw new Error("empty body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => undefined);
  return Buffer.concat(chunks).toString("utf8");
}

async function fetchSiteHtml(startUrl: string, domain: string): Promise<string> {
  let url = startUrl;
  for (let hop = 0; hop < 4; hop++) {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.port || !sameSite(u.hostname, domain)) throw new Error("outside the brand's domain");
    await assertPublic(u.hostname);
    const r = await fetch(url, { signal: AbortSignal.timeout(7000), redirect: "manual", headers: { "User-Agent": UA, Accept: "text/html" } });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
      url = new URL(r.headers.get("location")!, url).toString();
      continue;
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return readCapped(r);
  }
  throw new Error("too many redirects");
}

async function fromWebsite(domain: string): Promise<Channels> {
  for (const start of [`https://${domain}/`, `https://www.${domain}/`]) {
    try {
      return extractChannels(await fetchSiteHtml(start, domain));
    } catch {
      /* try the www. twin */
    }
  }
  return emptyChannels();
}

async function fromWikidata(name: string, domain: string): Promise<Channels> {
  try {
    const api = "https://www.wikidata.org/w/api.php";
    const headers = { "User-Agent": UA, Accept: "application/json" };
    const search = await fetch(`${api}?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&type=item&limit=6&format=json`, { headers, signal: AbortSignal.timeout(7000) });
    const ids: string[] = ((await search.json()).search ?? []).map((s: { id: string }) => s.id).filter((id: string) => /^Q\d+$/.test(id));
    if (!ids.length) return emptyChannels();
    const ents = await fetch(`${api}?action=wbgetentities&ids=${ids.join("|")}&props=claims&format=json`, { headers, signal: AbortSignal.timeout(7000) });
    const entities: Record<string, WikidataEntity> = (await ents.json()).entities ?? {};
    // only an entity whose official website is on this brand's domain counts, so a namesake never matches
    for (const id of ids) if (entities[id] && wikidataMatchesDomain(entities[id], domain)) return wikidataAccounts(entities[id]);
  } catch {
    /* Wikidata is a bonus source: ignore failures */
  }
  return emptyChannels();
}

/** Resolve a YouTube link like "c/paytm" or "channel/UC..." to the channel's @handle. */
async function resolveYoutube(ref: string): Promise<string | null> {
  if (!/^(?:c|user)\/[A-Za-z0-9_.-]{3,40}$|^channel\/UC[A-Za-z0-9_-]{20,24}$/.test(ref)) return null;
  try {
    const r = await fetch(`https://www.youtube.com/${ref}`, { signal: AbortSignal.timeout(6000), headers: { "User-Agent": UA, "Accept-Language": "en" } });
    return r.ok ? youtubeHandleFromPage(await readCapped(r)) : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    rateLimit(req, "discover", 40);
    const params = new URL(req.url).searchParams;
    const raw = (params.get("domain") ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!isHostname(raw)) throw new ApiError(400, '"domain" must be a domain like example.com');
    const domain = raw.replace(/^www\./, "");
    const name = (params.get("name") ?? "").trim().slice(0, 60) || domain.split(".")[0];

    const key = `${domain}|${name.toLowerCase()}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.value);

    const [site, wiki] = await Promise.all([fromWebsite(domain), fromWikidata(name, domain)]);
    const origin = new Map<string, string>(); // "kind:handle" -> where it came from
    const note = (c: Channels, from: string) => {
      for (const k of ["youtube", "telegram", "bluesky"] as const) for (const v of c[k]) if (!origin.has(`${k}:${v.toLowerCase()}`)) origin.set(`${k}:${v.toLowerCase()}`, from);
    };
    note(site, `linked from ${domain}`);
    note(wiki, "listed on Wikidata");

    const merged = mergeChannels(mergeChannels(emptyChannels(), site), wiki);
    const resolved = await Promise.all(merged.youtubeRefs.map(async (ref) => ({ ref, handle: await resolveYoutube(ref) })));
    for (const { ref, handle } of resolved) {
      if (!handle) continue;
      if (!merged.youtube.some((h) => h.toLowerCase() === handle.toLowerCase())) merged.youtube.push(handle);
      if (!origin.has(`youtube:${handle.toLowerCase()}`)) origin.set(`youtube:${handle.toLowerCase()}`, site.youtubeRefs.includes(ref) ? `linked from ${domain}` : "listed on Wikidata");
    }

    const found = { youtube: merged.youtube.slice(0, 3), telegram: merged.telegram, bluesky: merged.bluesky };
    const total = found.youtube.length + found.telegram.length + found.bluesky.length;
    const sources: Record<string, string> = {};
    for (const k of ["youtube", "telegram", "bluesky"] as const) for (const v of found[k]) sources[`${k}:${v}`] = origin.get(`${k}:${v.toLowerCase()}`) ?? "found online";
    const result: Result = { domain, status: total ? "ok" : "none", found, sources };
    cache.set(key, { at: Date.now(), value: result });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
