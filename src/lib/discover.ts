// Finds a brand's OFFICIAL social accounts. Evidence comes from two places:
//   1. links on the brand's own website (a link on the real domain is a strong sign it is official)
//   2. Wikidata, matched to the brand by its official-website entry
// Handles are never guessed: anything on the official list is never flagged, so a wrong guess could hide a
// real impersonator.

export interface Channels {
  youtube: string[]; // @handles, without the @
  telegram: string[];
  bluesky: string[];
  /** YouTube links that are not @handles ("c/paytm", "channel/UC..."), to be resolved to a handle */
  youtubeRefs: string[];
}

const MAX_PER_KIND = 3;

// t.me paths that are not accounts
const TELEGRAM_RESERVED = new Set(["s", "joinchat", "share", "addstickers", "addemoji", "addtheme", "login", "proxy", "socks", "setlanguage", "iv", "c", "boost"]);

export const emptyChannels = (): Channels => ({ youtube: [], telegram: [], bluesky: [], youtubeRefs: [] });

function add(list: string[], value: string) {
  if (list.length < MAX_PER_KIND && !list.some((x) => x.toLowerCase() === value.toLowerCase())) list.push(value);
}

/** Pull YouTube, Telegram and Bluesky accounts out of a page's HTML (links, and plain URLs in embedded data). */
export function extractChannels(html: string): Channels {
  const out = emptyChannels();
  // unescape the common ways a URL is written inside HTML and JSON
  const text = html.replace(/&amp;/g, "&").replace(/\\\//g, "/").replace(/\\u002F/gi, "/");
  const end = String.raw`(?=[/?#"'\s<)\\&]|$)`;

  for (const m of text.matchAll(new RegExp(String.raw`https?://(?:www\.|m\.)?youtube\.com/@([A-Za-z0-9_.-]{3,40})` + end, "gi"))) add(out.youtube, m[1]);
  for (const m of text.matchAll(new RegExp(String.raw`https?://(?:www\.|m\.)?youtube\.com/((?:c|user)/[A-Za-z0-9_.-]{3,40}|channel/UC[A-Za-z0-9_-]{20,24})` + end, "gi"))) add(out.youtubeRefs, m[1]);

  for (const m of text.matchAll(new RegExp(String.raw`https?://(?:t\.me|telegram\.me|telegram\.dog)/(?:s/)?([A-Za-z][A-Za-z0-9_]{3,31})` + end, "gi"))) {
    if (!TELEGRAM_RESERVED.has(m[1].toLowerCase())) add(out.telegram, m[1]);
  }

  for (const m of text.matchAll(new RegExp(String.raw`https?://bsky\.app/profile/([A-Za-z0-9][A-Za-z0-9.-]+\.[A-Za-z]{2,})` + end, "gi"))) add(out.bluesky, m[1].toLowerCase());

  return out;
}

export function countChannels(c: Channels): number {
  return c.youtube.length + c.telegram.length + c.bluesky.length + c.youtubeRefs.length;
}

/** Add one set of channels into another, without duplicates. */
export function mergeChannels(into: Channels, from: Channels): Channels {
  for (const k of ["youtube", "telegram", "bluesky", "youtubeRefs"] as const) for (const v of from[k]) add(into[k], v);
  return into;
}

/** The @handle of a YouTube channel, read from its page (canonical link, or the page's own channel data). */
export function youtubeHandleFromPage(html: string): string | null {
  const m =
    html.match(/<link rel="canonical" href="https?:\/\/www\.youtube\.com\/@([A-Za-z0-9_.-]{3,40})"/i) ??
    html.match(/"canonicalBaseUrl":"\/@([A-Za-z0-9_.-]{3,40})"/i) ??
    html.match(/"vanityChannelUrl":"https?:\/\/www\.youtube\.com\/@([A-Za-z0-9_.-]{3,40})"/i);
  return m ? m[1] : null;
}

interface WikidataClaim { rank?: string; mainsnak?: { datavalue?: { value?: unknown } } }
export interface WikidataEntity { claims?: Record<string, WikidataClaim[] | undefined> }

const claimValues = (e: WikidataEntity, prop: string): string[] =>
  (e.claims?.[prop] ?? [])
    .filter((c) => c.rank !== "deprecated")
    .map((c) => c.mainsnak?.datavalue?.value)
    .filter((v): v is string => typeof v === "string");

/** True when the entity's official-website entry (P856) is on the brand's domain. */
export function wikidataMatchesDomain(e: WikidataEntity, domain: string): boolean {
  return claimValues(e, "P856").some((url) => {
    try {
      const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
      return host === domain || host.endsWith(`.${domain}`);
    } catch {
      return false;
    }
  });
}

/** The official accounts Wikidata lists: YouTube channel IDs (P2397), Telegram usernames (P3789), Bluesky handles (P12361). */
export function wikidataAccounts(e: WikidataEntity): Channels {
  const out = emptyChannels();
  for (const id of claimValues(e, "P2397")) if (/^UC[A-Za-z0-9_-]{20,24}$/.test(id)) add(out.youtubeRefs, `channel/${id}`);
  for (const u of claimValues(e, "P3789")) if (/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(u)) add(out.telegram, u);
  for (const h of claimValues(e, "P12361")) if (/^[A-Za-z0-9][A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(h)) add(out.bluesky, h.toLowerCase());
  return out;
}

/** True for an address that is safe to fetch from the server: not loopback, private, link-local or reserved. */
export function isPublicIp(ip: string): boolean {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::" || v.startsWith("fe80") || v.startsWith("fc") || v.startsWith("fd")) return false;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPublicIp(mapped[1]) : true;
  }
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 169 && b === 254) return false; // link-local, includes cloud metadata services
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  if (a >= 224) return false; // multicast and reserved
  return true;
}
