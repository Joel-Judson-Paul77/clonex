import type { Brand, Candidate, Platform, SourceStatus } from "./types";
import { generateVariants, nameSimilarity } from "./lookalike";

type Result = { candidates: Candidate[]; status: SourceStatus };

async function getJson(url: string, ms = 12000, headers?: Record<string, string>) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "BrandGuard/0.1 (brand-protection research)", ...headers } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

async function getText(url: string, ms = 10000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0 BrandGuard/0.1" } });
    return { status: r.status, text: await r.text() };
  } finally {
    clearTimeout(t);
  }
}

function fail(platform: SourceStatus["platform"], e: unknown): Result {
  return {
    candidates: [],
    status: { platform, source: "live", ok: false, count: 0, note: e instanceof Error ? e.message : "error" },
  };
}

/* ---------- Apple App Store (official iTunes Search API) ---------- */
export async function scanAppStore(brand: Brand): Promise<Result> {
  try {
    const { terms } = generateVariants(brand.name);
    const batches = await Promise.all(
      terms.slice(0, 4).map((t) =>
        getJson(`https://itunes.apple.com/search?term=${encodeURIComponent(t)}&entity=software&country=in&limit=25`),
      ),
    );
    const seen = new Set<string>();
    const out: Candidate[] = [];
    for (const b of batches) {
      for (const r of b.results ?? []) {
        const id = `ios-${r.trackId}`;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({
          id,
          platform: "app-store",
          source: "live",
          kind: "app",
          name: r.trackName,
          handle: r.bundleId,
          developer: r.sellerName,
          url: r.trackViewUrl,
          description: (r.description ?? "").slice(0, 600),
          iconUrl: r.artworkUrl100,
          ratings: r.userRatingCount,
          createdAt: r.releaseDate,
        });
      }
    }
    return { candidates: out, status: { platform: "app-store", source: "live", ok: true, count: out.length } };
  } catch (e) {
    return fail("app-store", e);
  }
}

/* ---------- Google Play (google-play-scraper; no official search API) ---------- */
interface PlayApp { appId: string; title: string; developer: string; url: string; icon: string; summary?: string }

export async function scanPlayStore(brand: Brand): Promise<Result> {
  try {
    const gp = await import("google-play-scraper");
    const gplay = (gp as unknown as { default: { search: (o: Record<string, unknown>) => Promise<PlayApp[]> } }).default;
    // scam apps use words like "kyc", "loan", "cashback", so search several lookalike phrases
    const terms = [brand.name, ...["kyc", "loan", "cashback", "refund", "support", "official", "rewards", "pro"].map((w) => `${brand.name} ${w}`)];
    const batches = await Promise.all(
      terms.map((term) => gplay.search({ term, num: 30, country: "in", lang: "en" }).catch(() => [] as PlayApp[])),
    );
    const seen = new Set<string>();
    const out: Candidate[] = [];
    for (const a of batches.flat()) {
      if (seen.has(a.appId)) continue;
      seen.add(a.appId);
      out.push({
        id: `play-${a.appId}`,
        platform: "play-store",
        source: "live",
        kind: "app",
        name: a.title,
        handle: a.appId,
        developer: a.developer,
        url: a.url,
        description: a.summary ?? "",
        iconUrl: a.icon,
      });
    }
    if (!out.length) throw new Error("no results returned (Play may be rate-limiting)");
    return { candidates: out, status: { platform: "play-store", source: "live", ok: true, count: out.length } };
  } catch (e) {
    return fail("play-store", e);
  }
}

/* ---------- Bluesky (public AppView API) ---------- */
export async function scanBluesky(brand: Brand): Promise<Result> {
  try {
    const { terms } = generateVariants(brand.name);
    const batches = await Promise.all(
      terms.slice(0, 4).map((t) =>
        getJson(`https://public.api.bsky.app/xrpc/app.bsky.actor.searchActors?q=${encodeURIComponent(t)}&limit=25`),
      ),
    );
    const seen = new Set<string>();
    const out: Candidate[] = [];
    for (const b of batches) {
      for (const a of b.actors ?? []) {
        if (seen.has(a.did)) continue;
        seen.add(a.did);
        out.push({
          id: `bsky-${a.did}`,
          platform: "bluesky",
          source: "live",
          kind: "profile",
          name: a.displayName || a.handle,
          handle: a.handle,
          url: `https://bsky.app/profile/${a.handle}`,
          description: a.description ?? "",
          iconUrl: a.avatar,
          createdAt: a.createdAt,
        });
      }
    }
    return { candidates: out, status: { platform: "bluesky", source: "live", ok: true, count: out.length } };
  } catch (e) {
    return fail("bluesky", e);
  }
}

/* ---------- Telegram (public preview pages, probing squatted handles) ---------- */
function meta(html: string, prop: string) {
  const m = html.match(new RegExp(`<meta property="${prop}" content="([^"]*)"`, "i"));
  return m ? m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'") : "";
}

// t.me, telegram.me and telegram.dog are all official Telegram hosts. Some networks (ISP or venue filters)
// block t.me, so if a host refuses connections we move on to the next one for the rest of the scan.
const TG_HOSTS = ["t.me", "telegram.me", "telegram.dog"];

export async function scanTelegram(brand: Brand): Promise<Result> {
  let hostIdx = 0;
  const tgPage = async (h: string) => {
    for (let tries = 0; tries < TG_HOSTS.length; tries++) {
      const idx = hostIdx;
      try {
        return await getText(`https://${TG_HOSTS[idx]}/${h}`, 6000);
      } catch {
        if (hostIdx === idx) hostIdx = (idx + 1) % TG_HOSTS.length; // first failure on this host moves everyone on
      }
    }
    throw new Error("all Telegram hosts unreachable");
  };
  try {
    const { handles } = generateVariants(brand.name);
    const probe = handles
      .sort((a, b) => nameSimilarity(b, brand.name) - nameSimilarity(a, brand.name))
      .slice(0, 40);
    const out: Candidate[] = [];
    let errors = 0;
    // modest concurrency to stay polite
    for (let i = 0; i < probe.length; i += 20) {
      const chunk = probe.slice(i, i + 20);
      const res = await Promise.all(
        chunk.map(async (h) => {
          try {
            const { status, text } = await tgPage(h);
            if (status !== 200) return null;
            const title = meta(text, "og:title");
            const desc = meta(text, "og:description");
            const image = meta(text, "og:image");
            // Unclaimed usernames render a generic "Telegram: Contact @x" page with no real description
            if (!title || /^Telegram: (Contact|Launch)/i.test(title) || title === `@${h}`) return null;
            if (/If you have Telegram, you can contact/i.test(desc)) return null;
            return { h, title, desc, image } as const;
          } catch {
            errors++;
            return null;
          }
        }),
      );
      for (const r of res) {
        if (!r) continue;
        out.push({
          id: `tg-${r.h}`,
          platform: "telegram",
          source: "live",
          kind: "profile",
          name: r.title,
          handle: r.h,
          url: `https://t.me/${r.h}`,
          description: r.desc,
          iconUrl: r.image || undefined,
        });
      }
    }
    if (errors > probe.length / 2) throw new Error(`${errors}/${probe.length} lookups failed (network)`);
    return { candidates: out, status: { platform: "telegram", source: "live", ok: true, count: out.length, note: `probed ${probe.length} handles${hostIdx ? ` via ${TG_HOSTS[hostIdx]}` : ""}` } };
  } catch (e) {
    return fail("telegram", e);
  }
}

/* ---------- Certificate Transparency (crt.sh) for lookalike domains ---------- */

/** A real DNS hostname: dot-separated labels, letters/digits/hyphens, a letter TLD. Rejects the company
 *  names that also appear in certificate fields (e.g. "paytm money limited"). */
export function isHostname(h: string): boolean {
  return h.length <= 253 && /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*\.[a-z]{2,63}$/.test(h);
}
export async function scanCertTransparency(brand: Brand): Promise<Result> {
  const token = brand.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (token.length < 4) return { candidates: [], status: { platform: "domain", source: "live", ok: true, count: 0, note: "name too short" } };
  for (let attempt = 0; attempt < 1; attempt++) {
    try {
      const rows: { name_value: string; not_before: string }[] = await getJson(
        `https://crt.sh/?q=${encodeURIComponent("%" + token + "%")}&output=json`,
        15000,
      );
      const official = brand.officialDomains.map((d) => d.toLowerCase());
      const seen = new Set<string>();
      const out: Candidate[] = [];
      for (const row of rows.slice(0, 4000)) {
        for (const host of row.name_value.split("\n")) {
          const h = host.trim().replace(/^\*\./, "").toLowerCase();
          if (seen.has(h) || !isHostname(h)) continue;
          if (official.some((d) => h === d || h.endsWith("." + d))) continue;
          seen.add(h);
          out.push({
            id: `dom-${h}`,
            platform: "domain",
            source: "live",
            kind: "domain",
            name: h,
            handle: h,
            url: `https://${h}`,
            description: "",
            createdAt: row.not_before,
          });
        }
      }
      out.sort((a, b) => nameSimilarity(b.name.split(".")[0], brand.name) - nameSimilarity(a.name.split(".")[0], brand.name));
      const top = out.slice(0, 25); // most brand-like first; a long tail is noise
      return { candidates: top, status: { platform: "domain", source: "live", ok: true, count: top.length, note: `${out.length} certs matched` } };
    } catch (e) {
      return fail("domain", e instanceof Error && e.name === "AbortError" ? "crt.sh timed out (public service is often slow)" : e);
    }
  }
  return fail("domain", "unreachable");
}

// ---- Resilience: remember the last good result per source and fall back to it -----------------
// Live sources (esp. unofficial/public ones) can be slow or rate-limited. A scan must still
// work, so when a source fails we serve its last successful snapshot, clearly marked CACHED.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

interface Snapshot { at: number; candidates: Candidate[]; count: number }
const CACHE_FILE = path.join(os.tmpdir(), "clonex-source-cache.json");
const mem = new Map<string, Snapshot>();
let loaded = false;

function loadCache() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) as Record<string, Snapshot>;
    for (const [k, v] of Object.entries(raw)) mem.set(k, v);
  } catch { /* no cache yet */ }
}
function saveCache() {
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(mem))); } catch { /* best effort */ }
}

async function timed(fn: (b: Brand) => Promise<Result>, brand: Brand): Promise<Result> {
  loadCache();
  const t0 = Date.now();
  // A slow source must never hold the whole scan hostage. The certificate-log source is optional and often down,
  // so it gets a short leash and falls back to its cached snapshot.
  const DEADLINE = fn.name === "scanCertTransparency" ? 6000 : 20000;
  const withDeadline = (p: Promise<Result>, platform: Platform): Promise<Result> =>
    Promise.race([
      p,
      new Promise<Result>((res) =>
        setTimeout(() => res({ candidates: [], status: { platform, source: "live", ok: false, count: 0, note: `no response within ${DEADLINE / 1000}s` } }), DEADLINE),
      ),
    ]);
  const platform = (fn.name === "scanAppStore" ? "app-store" : fn.name === "scanPlayStore" ? "play-store" : fn.name === "scanBluesky" ? "bluesky" : fn.name === "scanTelegram" ? "telegram" : "domain") as Platform;
  let r = await withDeadline(fn(brand), platform);
  // one quick retry, only for fast failures (a source that already timed out won't recover in time)
  if (!r.status.ok && Date.now() - t0 < 6000 && platform !== "domain") r = await withDeadline(fn(brand), platform);
  const key = `${r.status.platform}:${brand.name.toLowerCase()}`;

  if (r.status.ok && r.candidates.length > 0) {
    mem.set(key, { at: Date.now(), candidates: r.candidates, count: r.candidates.length });
    saveCache();
  } else if (!r.status.ok) {
    const snap = mem.get(key);
    if (snap) {
      const mins = Math.max(1, Math.round((Date.now() - snap.at) / 60000));
      r = {
        candidates: snap.candidates,
        status: { ...r.status, ok: true, cached: true, count: snap.count, note: `live source unavailable - using results cached ${mins} min ago` },
      };
    }
  }
  r.status.ms = Date.now() - t0;
  return r;
}

export async function scanAllLive(brand: Brand): Promise<Result[]> {
  return Promise.all([
    timed(scanAppStore, brand),
    timed(scanPlayStore, brand),
    timed(scanBluesky, brand),
    timed(scanTelegram, brand),
    timed(scanCertTransparency, brand),
  ]);
}
