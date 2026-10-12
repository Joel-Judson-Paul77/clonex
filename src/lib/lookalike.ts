// Lookalike generation + text similarity (typosquat / homoglyph aware)

const HOMOGLYPHS: Record<string, string> = {
  "0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b",
  "$": "s", "@": "a", "!": "i", "|": "l",
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y", "і": "i", // cyrillic
};

export function normalize(s: string): string {
  let out = s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
  out = out.replace(/rn/g, "m").replace(/vv/g, "w").replace(/cl/g, "d");
  out = [...out].map((c) => HOMOGLYPHS[c] ?? c).join("");
  return out.replace(/[^a-z0-9]/g, "");
}

/** Edit distance where swapping two adjacent letters counts as ONE edit (Damerau-Levenshtein / OSA). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev2: number[] = [];
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
    }
    prev2 = prev;
    prev = cur;
  }
  return prev[n];
}

// Words scammers attach to a brand ("paytmkyc", "refundpaytm", "paytm247"). Anything else glued onto the brand
// ("InCred", "Credit4Sure") makes it a different word, not an impersonation.
const AFFIXES = new Set([
  "support", "care", "customercare", "helpline", "helpdesk", "official", "help", "kyc", "refund", "service", "services",
  "india", "app", "pro", "rewards", "reward", "loan", "cashback", "team", "online", "money", "wallet", "bank", "login",
  "verify", "verification", "update", "offer", "offers", "customer", "assist", "number", "contact", "store", "free",
  "plus", "lite", "new", "original", "secure", "safe", "pay",
]);
const affixOk = (rest: string) => rest === "" || /^\d+$/.test(rest) || AFFIXES.has(rest);

/** True when the brand appears as a whole word in the candidate, optionally glued to a scam-style affix or digits. */
function embeddedAsWord(candidate: string, b: string): boolean {
  const toks = candidate.split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(normalize).filter(Boolean);
  for (let i = 0; i < toks.length; i++) {
    let joined = "";
    for (let j = i; j < Math.min(toks.length, i + 4); j++) {
      joined += toks[j]; // a brand written as several words ("Google Pay") spans several tokens
      if (joined === b) return true;
      if (joined.length > b.length) {
        if (joined.startsWith(b) && affixOk(joined.slice(b.length))) return true;
        if (joined.endsWith(b) && affixOk(joined.slice(0, joined.length - b.length))) return true;
        // a one-letter typo of the brand plus an affix ("paytmm official"); only for brands long enough that one edit is still the same word
        if (b.length >= 5) {
          for (const len of [b.length - 1, b.length + 1]) {
            if (joined.length > len && levenshtein(joined.slice(0, len), b) <= 1 && affixOk(joined.slice(len))) return true;
            if (joined.length > len && levenshtein(joined.slice(joined.length - len), b) <= 1 && affixOk(joined.slice(0, joined.length - len))) return true;
          }
        }
      }
    }
  }
  return false;
}

/** 0..1 similarity between a candidate string and the brand token. */
export function nameSimilarity(candidate: string, brand: string): number {
  const c = normalize(candidate);
  const b = normalize(brand);
  if (!c || !b) return 0;
  if (c === b) return 1;
  const dist = levenshtein(c, b);
  let lev = 1 - dist / Math.max(c.length, b.length);
  // one or two edits on a 4-5 letter word is usually a different word ("Credit" vs "CRED"), not a typo
  if (b.length <= 5 && dist > 1) lev = Math.min(lev, 0.5);
  // brand embedded in a longer name ("paytm_support", "paytm official"): only as a whole word, not inside another word
  const contains = c.includes(b) && embeddedAsWord(candidate, b) ? 0.85 + Math.min(0.1, b.length / (c.length * 10)) : 0;
  return Math.max(lev, contains);
}

const SCAM_SUFFIXES = [
  "support", "care", "customercare", "helpline", "official", "help", "kyc",
  "refund", "service", "india", "app", "pro", "rewards", "loan", "cashback",
];

/** Search terms + likely squatted handles for a brand. */
export function generateVariants(brand: string): { terms: string[]; handles: string[] } {
  const base = brand.toLowerCase().replace(/[^a-z0-9]/g, "");
  const terms = new Set<string>([brand, ...SCAM_SUFFIXES.slice(0, 5).map((s) => `${brand} ${s}`)]);
  const handles = new Set<string>();

  for (const s of SCAM_SUFFIXES) {
    handles.add(`${base}${s}`);
    handles.add(`${base}_${s}`);
    handles.add(`${s}${base}`);
  }
  // typos: drop / swap / double a letter
  for (let i = 0; i < base.length; i++) {
    handles.add(base.slice(0, i) + base.slice(i + 1));
    handles.add(base.slice(0, i) + base[i] + base.slice(i));
    if (i < base.length - 1) handles.add(base.slice(0, i) + base[i + 1] + base[i] + base.slice(i + 2));
  }
  // visual swaps
  handles.add(base.replace(/m/g, "rn"));
  handles.add(base.replace(/o/g, "0"));
  handles.add(base.replace(/l/g, "1"));
  handles.add(base.replace(/i/g, "l"));

  handles.delete(base);
  return {
    terms: [...terms],
    handles: [...handles].filter((h) => h.length >= 4 && h.length <= 32),
  };
}

const PHONE_RE = /(?:\+?91[\s-]?)?(?:0?[6-9]\d{4}[\s-]?\d{5}|1800[\s-]?\d{3}[\s-]?\d{3,4})/g;

export function extractPhones(text: string): string[] {
  const found = text.match(PHONE_RE) ?? [];
  return [...new Set(found.map((p) => p.replace(/[\s-]/g, "").replace(/^(\+?91)/, "")))];
}
