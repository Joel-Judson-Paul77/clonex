import dns from "node:dns/promises";
import type { Brand, Candidate } from "./types";

// Look-alike domain discovery that does not depend on a third-party service: build the typo, homoglyph and
// scam-word variants of the brand's own domain, then ask public DNS which of them are actually registered.
// Only the DNS record is read; no page is opened.

const AFFIXES = ["support", "care", "help", "kyc", "refund", "official", "india", "app", "rewards", "loan", "login", "verify", "wallet", "cashback"];
const TLDS = ["com", "in", "co.in", "net", "org", "info", "online", "xyz", "site", "app", "store"];
const SWAPS: [string, string][] = [["o", "0"], ["l", "1"], ["i", "l"], ["i", "1"], ["e", "3"], ["a", "4"], ["m", "rn"], ["w", "vv"]];
const HOST_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/;

/** Splits "paytm.com" into its brand label and suffix; "pay.co.in" gives ("pay", "co.in"). */
function splitDomain(d: string): { label: string; tld: string } | null {
  const parts = d.toLowerCase().trim().split(".");
  if (parts.length < 2) return null;
  const twoPart = parts.length >= 3 && ["co", "com", "org", "net"].includes(parts[parts.length - 2]) && parts[parts.length - 1].length === 2;
  const tld = parts.slice(twoPart ? -2 : -1).join(".");
  const label = parts[parts.length - (twoPart ? 3 : 2)];
  return label ? { label, tld } : null;
}

function typos(label: string): string[] {
  const out = new Set<string>();
  for (let i = 0; i < label.length; i++) {
    out.add(label.slice(0, i) + label.slice(i + 1)); // missing letter
    out.add(label.slice(0, i) + label[i] + label.slice(i)); // doubled letter
    if (i < label.length - 1) out.add(label.slice(0, i) + label[i + 1] + label[i] + label.slice(i + 2)); // swapped letters
  }
  for (const [from, to] of SWAPS) if (label.includes(from)) out.add(label.replace(from, to));
  out.delete(label);
  return [...out].filter((v) => v.length >= 3);
}

/** The look-alike hostnames worth checking for a brand. Never includes the brand's own domains. */
export function domainPermutations(brand: Pick<Brand, "name" | "officialDomains">, cap = 400): string[] {
  const official = brand.officialDomains.map((d) => d.toLowerCase());
  const parsed = official.map(splitDomain).find(Boolean);
  const token = brand.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const label = parsed?.label ?? token;
  if (label.length < 4) return [];
  const ownTld = parsed?.tld ?? "com";
  const tlds = [...new Set([ownTld, ...TLDS])];

  const out = new Set<string>();
  for (const t of typos(label)) for (const tld of [ownTld, "com", "in"]) out.add(`${t}.${tld}`);
  for (const a of AFFIXES) {
    for (const tld of [ownTld, "com", "in", "net", "org", "online"]) {
      out.add(`${label}${a}.${tld}`);
      out.add(`${a}${label}.${tld}`);
      out.add(`${label}-${a}.${tld}`);
    }
  }
  for (const tld of tlds) out.add(`${label}.${tld}`); // same name, different ending

  return [...out]
    .filter((h) => HOST_RE.test(h) && h.length <= 253)
    .filter((h) => !official.some((d) => h === d || h.endsWith("." + d)))
    .slice(0, cap);
}

type Lookup = { host: string; ip?: string; broken?: boolean };

// Ask public resolvers directly so the result does not depend on how the host machine's DNS is set up.
const resolver = new dns.Resolver({ timeout: 2000, tries: 1 });
resolver.setServers(["1.1.1.1", "8.8.8.8"]);

const NOT_REGISTERED = new Set(["ENOTFOUND", "ENODATA"]); // real answers: the domain does not exist

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), ms);
  });
  return Promise.race([p, limit]).finally(() => clearTimeout(timer));
}

async function lookup(host: string, ms: number): Promise<Lookup> {
  try {
    const ips = await withTimeout(resolver.resolve4(host), ms);
    return { host, ip: ips[0] };
  } catch (e) {
    if (NOT_REGISTERED.has((e as { code?: string }).code ?? "")) return { host };
  }
  // Public resolvers unreachable (e.g. a network that blocks outbound DNS): fall back to the system resolver.
  try {
    const { address } = await withTimeout(dns.lookup(host, { family: 4 }), ms);
    return { host, ip: address };
  } catch (e) {
    return NOT_REGISTERED.has((e as { code?: string }).code ?? "") ? { host } : { host, broken: true };
  }
}

export interface DomainScan {
  candidates: Candidate[];
  checked: number;
  ok: boolean; // false when DNS itself was unreachable, so "nothing found" would be meaningless
}

/** Finds which look-alike domains are registered and live, checking up to 40 hostnames at a time. */
export async function scanLookalikeDomains(brand: Brand, budgetMs = 6000): Promise<DomainScan> {
  const hosts = domainPermutations(brand);
  const stopAt = Date.now() + budgetMs;
  const results: Lookup[] = [];
  let next = 0;
  const worker = async () => {
    while (next < hosts.length && Date.now() < stopAt) {
      const host = hosts[next++];
      results.push(await lookup(host, 2500));
    }
  };
  await Promise.all(Array.from({ length: 40 }, worker));

  const broken = results.filter((r) => r.broken).length;
  const ok = results.length > 0 && broken / results.length < 0.8;
  const candidates: Candidate[] = results
    .filter((r) => r.ip)
    .map((r) => ({
      id: `dom-${r.host}`,
      platform: "domain",
      source: "live",
      kind: "domain",
      name: r.host,
      handle: r.host,
      url: `https://${r.host}`,
      description: `Registered look-alike domain (resolves to ${r.ip})`,
    }));
  return { candidates, checked: results.length, ok };
}
