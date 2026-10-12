import type { BrandCard, LookupResponse } from "./brand-types";
import { matchPresets } from "./brand-presets";
import { nameSimilarity, normalize } from "./lookalike";

interface IosApp { trackId: number; trackName: string; bundleId?: string; sellerName?: string; sellerUrl?: string; artworkUrl512?: string; artworkUrl100?: string }
interface PlayApp { appId: string; title: string; developer: string; icon?: string; summary?: string }

async function timedFetchJson(url: string, ms: number) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "Clonex/0.1 (brand lookup)" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} timed out`)), ms))]);
}

/** "Paytm: Secure UPI Payments" -> "Paytm"; "WhatsApp Messenger" -> "WhatsApp" when the query is "whatsapp". */
function brandName(title: string, q: string): string {
  const head = title.split(/\s[-–—|]\s|:\s/)[0].trim() || title;
  const words = head.split(/\s+/);
  const first = words[0];
  const nq = normalize(q);
  if (words.length > 1 && nq && normalize(first).startsWith(nq.slice(0, Math.max(3, nq.length)))) return first;
  return words.length > 3 ? words.slice(0, 2).join(" ") : head;
}

function registrableDomain(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const host = new URL(/^https?:/i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
    const parts = host.split(".");
    if (parts.length <= 2) return host;
    const sld = parts[parts.length - 2];
    return parts[parts.length - 1].length === 2 && ["co", "com", "org", "net", "gov", "ac"].includes(sld) ? parts.slice(-3).join(".") : parts.slice(-2).join(".");
  } catch {
    return undefined;
  }
}

function pubSim(a?: string, b?: string): number {
  const first = (s?: string) => normalize((s ?? "").split(/[\s,.]+/)[0] ?? "");
  const x = first(a), y = first(b);
  return x && y && x === y ? 1 : 0;
}

export async function lookupBrands(q: string): Promise<LookupResponse> {
  const live = { ios: false, android: false };
  let ios: IosApp[] = [];
  let play: PlayApp[] = [];
  const notes: string[] = [];

  const iosP = (async () => {
    for (const country of ["in", "us"]) {
      const j = await timedFetchJson(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=software&country=${country}&limit=8`, 7000);
      if (j.results?.length) return j.results as IosApp[];
    }
    return [] as IosApp[];
  })();
  const playP = (async () => {
    const gp = await import("google-play-scraper");
    const gplay = (gp as unknown as { default: { search: (o: Record<string, unknown>) => Promise<PlayApp[]> } }).default;
    return gplay.search({ term: q, num: 8, country: "in", lang: "en" });
  })();

  const [iosR, playR] = await Promise.allSettled([withTimeout(iosP, 9000, "App Store"), withTimeout(playP, 9000, "Google Play")]);
  if (iosR.status === "fulfilled") { ios = iosR.value; live.ios = true; } else notes.push(`App Store unavailable (${(iosR.reason as Error).message})`);
  if (playR.status === "fulfilled") { play = playR.value; live.android = true; } else notes.push(`Google Play unavailable (${(playR.reason as Error).message})`);

  // Pair each iOS app with the Android app that looks like the same product
  const cards: BrandCard[] = [];
  const usedPlay = new Set<string>();
  for (const a of ios.slice(0, 6)) {
    const aBrand = brandName(a.trackName, q);
    let best: PlayApp | undefined;
    let bestScore = 0;
    for (const b of play) {
      if (usedPlay.has(b.appId)) continue;
      const s = nameSimilarity(brandName(b.title, q), aBrand) + pubSim(a.sellerName, b.developer) * 0.5;
      if (s > bestScore) { bestScore = s; best = b; }
    }
    const matched = best && bestScore >= 1.2 ? best : undefined;
    if (matched) usedPlay.add(matched.appId);
    cards.push({
      key: `ios:${a.trackId}`,
      name: aBrand,
      publisher: a.sellerName ?? matched?.developer ?? "",
      iconUrl: a.artworkUrl512 ?? a.artworkUrl100,
      ios: { appId: String(a.trackId), bundleId: a.bundleId, title: a.trackName },
      android: matched ? { pkg: matched.appId, title: matched.title, developer: matched.developer } : undefined,
      domain: registrableDomain(a.sellerUrl),
      origin: "live",
    });
  }
  for (const b of play.slice(0, 6)) {
    if (usedPlay.has(b.appId)) continue;
    // Android-only results: skip ones that duplicate an existing iOS card's brand
    if (cards.some((c) => nameSimilarity(c.name, brandName(b.title, q)) >= 0.9 && pubSim(c.publisher, b.developer))) continue;
    cards.push({
      key: `and:${b.appId}`,
      name: brandName(b.title, q),
      publisher: b.developer,
      iconUrl: b.icon,
      android: { pkg: b.appId, title: b.title, developer: b.developer },
      origin: "live",
    });
  }

  // Domain for Android-only cards: the Play listing exposes the developer's website
  const needDomain = cards.filter((c) => !c.domain && c.android).slice(0, 3);
  if (needDomain.length) {
    try {
      const gp = await import("google-play-scraper");
      const gplay = (gp as unknown as { default: { app: (o: Record<string, unknown>) => Promise<{ developerWebsite?: string }> } }).default;
      await Promise.allSettled(
        needDomain.map(async (c) => {
          const d = await withTimeout(gplay.app({ appId: c.android!.pkg, country: "in", lang: "en" }), 4000, "Play details");
          c.domain = registrableDomain(d.developerWebsite);
        }),
      );
    } catch { /* domain stays empty; user can type it */ }
  }

  // Keep only cards that are actually about the query, then rank. Apps whose PUBLISHER carries the
  // brand name (e.g. "Binance Switzerland AG") rank above look-alike names from unrelated developers.
  const nq = normalize(q);
  const ranked = cards
    .filter((c) => nameSimilarity(c.name, q) >= 0.5 || normalize(c.publisher).includes(nq) || normalize(c.ios?.title ?? c.android?.title ?? "").includes(nq))
    .map((c, i) => ({
      c,
      s: nameSimilarity(c.name, q) * 10 + (normalize(c.publisher).includes(nq) ? 6 : 0) + (c.ios && c.android ? 1 : 0) - i * 0.01,
    }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c)
    .slice(0, 6);

  // Presets also fill gaps in live results (e.g. the nickname "gpay" -> Google Pay), without duplicating them
  const present = new Set(ranked.flatMap((c) => [c.ios?.appId, c.android?.pkg].filter(Boolean) as string[]));
  const extra = (live.ios || live.android ? matchPresets(q, 2) : [])
    .filter((p) => ![p.ios?.appId, p.android?.pkg].some((id) => id && present.has(id)))
    .filter((p) => !ranked.some((c) => normalize(c.name) === normalize(p.name) && c.origin === "live"));
  if (extra.length) return { q, cards: [...extra, ...ranked].slice(0, 6), live, note: "Includes a built-in preset" };

  // Fallback: built-in presets when live stores returned nothing or were unreachable
  if (!ranked.length || (!live.ios && !live.android)) {
    const presets = matchPresets(q);
    if (presets.length) notes.push("Showing built-in presets");
    return { q, cards: presets, live, note: notes.join("; ") || undefined };
  }
  return { q, cards: ranked, live, note: notes.join("; ") || undefined };
}
