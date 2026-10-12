import type { Brand, Candidate, Finding, Severity, Signal } from "./types";
import { extractPhones, nameSimilarity, normalize } from "./lookalike";

// Scam language common in Indian brand-impersonation fraud (UPI / KYC / fake support)
const SCAM_PATTERNS: { re: RegExp; label: string; w: number }[] = [
  { re: /\b(kyc|re-?kyc|update your kyc|kyc (expired|pending|verification))\b/i, label: "KYC-update lure", w: 9 },
  { re: /\b(refund|chargeback|cashback|reward|lucky (draw|winner)|prize)\b/i, label: "Refund / reward bait", w: 7 },
  { re: /\b(customer ?care|helpline|toll[- ]?free|support number|complaint)\b/i, label: "Fake support contact", w: 8 },
  { re: /\b(dm|whatsapp|telegram|contact us)\b.*\b(now|immediately|urgent|fast)\b/i, label: "Urgent off-platform contact", w: 8 },
  { re: /\b(upi|otp|cvv|pin|password|anydesk|teamviewer|apk)\b/i, label: "Credential / remote-access request", w: 10 },
  { re: /\b(loan|instant loan|investment|double your|guaranteed returns?|trading tips?)\b/i, label: "Financial-scam offer", w: 7 },
  { re: /\b(verified|official|authorized|authorised|real)\b/i, label: "Claims to be official", w: 4 },
  { re: /\b(blocked|suspended|expire[sd]?|last chance|limited time)\b/i, label: "Urgency / threat language", w: 5 },
];

/** Why a candidate is one of the brand's own assets, or null if it is not. */
export function officialReason(c: Candidate, brand: Brand): string | null {
  const h = (c.handle ?? "").toLowerCase();
  const dev = (c.developer ?? "").toLowerCase();
  if (h && brand.officialHandles.some((o) => o.toLowerCase() === h)) return "Matches an official handle in your profile";
  if (c.kind === "app" && brand.officialApps.some((a) => a.toLowerCase() === h || c.id === `ios-${a}`)) return "Matches an official app ID in your profile";
  if (c.kind === "domain" && brand.officialDomains.some((d) => h === d.toLowerCase() || h.endsWith("." + d.toLowerCase()))) return "On an official domain";
  const pub = c.kind === "app" && dev ? brand.officialDevelopers.find((d) => d.length >= 4 && dev.includes(d.toLowerCase())) : undefined;
  if (pub) return `Published by official publisher "${pub}"`;
  return null;
}

export function isOfficial(c: Candidate, brand: Brand): boolean {
  return officialReason(c, brand) !== null;
}

/** "Stats for Spotify", "Turrit for Telegram": the listing names the brand to say what it works with. */
function isThirdPartyTool(listing: string, brandName: string): boolean {
  const escaped = brandName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) return false;
  return new RegExp(`\\b(for|with|via|using)\\s+${escaped}\\b`, "i").test(listing);
}

function severityOf(score: number): Severity {
  if (score >= 75) return "critical";
  if (score >= 55) return "high";
  if (score >= 35) return "medium";
  return "low";
}

export function scoreCandidate(c: Candidate, brand: Brand): Finding | null {
  if (isOfficial(c, brand)) return null;

  const signals: Signal[] = [];
  const text = `${c.name} ${c.description ?? ""}`;
  const nameSim = Math.max(
    nameSimilarity(c.name, brand.name),
    c.handle ? nameSimilarity(c.handle.split(".")[0], brand.name) : 0,
  );

  const logoSim = c.logoSim ?? 0;

  // 1. Name / handle lookalike (up to 35)
  if (nameSim >= 0.6 || logoSim >= 0.8) {
    const w = Math.round(nameSim * 35);
    signals.push({
      key: "name",
      label: nameSim > 0.9 ? "Near-identical name" : "Look-alike name",
      weight: w,
      detail: `"${c.name}"${c.handle ? ` (@${c.handle})` : ""} is ${Math.round(nameSim * 100)}% similar to "${brand.name}"`,
    });
  }
  if (nameSim < 0.6 && logoSim < 0.8) return null; // not close enough to be an impersonation candidate

  // 1b. Logo / icon copy (up to 35) - the brief scores logo & branding impersonation explicitly
  if (logoSim >= 0.6) {
    signals.push({
      key: "logo",
      label: logoSim >= 0.8 ? "Copies the official logo" : "Resembles the official logo",
      weight: Math.round(15 + logoSim * 20),
      detail: `Icon/avatar is ${Math.round(logoSim * 100)}% visually similar to the official logo`,
    });
  }

  // 2. Homoglyph / typosquat trick (+8)
  const raw = (c.handle ?? c.name).toLowerCase();
  if (normalize(raw) === normalize(brand.name) && raw.replace(/[^a-z0-9]/g, "") !== brand.name.toLowerCase().replace(/[^a-z0-9]/g, "")) {
    signals.push({ key: "homoglyph", label: "Character-swap trick", weight: 8, detail: `Uses look-alike characters to imitate "${brand.name}"` });
  }

  // 2b. Typosquat: a near-miss of the brand name that does not actually contain it (e.g. "pyatm", "aytm")
  const cn = normalize(c.handle?.split(".")[0] ?? c.name);
  const dn = normalize(c.name);
  const bn = normalize(brand.name);
  const typoSim = Math.max(nameSimilarity(cn, brand.name), nameSimilarity(dn, brand.name));
  if (typoSim >= 0.75 && typoSim < 1 && !cn.includes(bn) && !dn.includes(bn)) {
    signals.push({ key: "typo", label: "Typosquat of the brand name", weight: 12, detail: `"${c.name}" is a near-miss spelling of "${brand.name}"` });
  }

  // 2d. Same name, evasive formatting ("pa ytm", "pay-tm", "p a y t m"): identical once spacing/punctuation is removed
  if (dn === bn && c.name.toLowerCase().trim() !== brand.name.toLowerCase().trim()) {
    signals.push({ key: "reformat", label: "Same name, altered formatting", weight: 18, detail: `"${c.name}" reads as "${brand.name}" once spaces/punctuation are removed` });
  }

  // 2c. Scam-flavoured word attached to the brand name ("Support", "KYC", "Helpline"...)
  const NAME_WORDS = /\b(support|care|helpline|kyc|refund|rewards?|cashback|official|customer|loan|offers?)\b/i;
  if (nameSim >= 0.6 && NAME_WORDS.test(c.name.replace(/[_.]/g, " "))) {
    signals.push({ key: "nameword", label: "Scam-style word in the name", weight: 12, detail: `Name pairs the brand with "${(c.name.match(NAME_WORDS) ?? [""])[0]}"` });
  }

  // 3. Scam language (cap 25)
  let lang = 0;
  // A real payments/banking app's store description naturally mentions OTP, PIN, KYC and "instant"
  // offers, so these wording rules are only meaningful for profiles and pages, not for app listings.
  // The same goes for "loan", "reward", "customer care" and "official": every lender's or wallet's store page uses them.
  const APP_NOISY = /Credential|KYC-update|Urgency|Financial|Refund|Fake support|Claims to be official/;
  for (const p of SCAM_PATTERNS) {
    if (c.kind === "app" && APP_NOISY.test(p.label)) continue;
    if (p.re.test(text)) {
      lang += p.w;
      signals.push({ key: "lang", label: p.label, weight: p.w, detail: "Matched in listing text" });
    }
  }
  if (lang > 25) {
    // trim display weights to the cap
    let over = lang - 25;
    for (const s of signals.filter((s) => s.key === "lang").reverse()) {
      const cut = Math.min(s.weight, over);
      s.weight -= cut;
      over -= cut;
      if (over <= 0) break;
    }
  }

  // 4. Phone numbers not on the brand's official list (cap 20)
  const phones = extractPhones(text);
  const officialPhones = brand.officialPhones.map((p) => p.replace(/\D/g, "").replace(/^91/, ""));
  const rogue = phones.filter((p) => !officialPhones.includes(p.replace(/\D/g, "")));
  if (rogue.length) {
    signals.push({
      key: "phone",
      label: "Unofficial contact number",
      weight: Math.min(20, 14 + rogue.length * 3),
      detail: `Lists ${rogue.join(", ")}, which is not a registered ${brand.name} number`,
    });
  }

  // 5. Account / app age + reach (cap 12)
  if (c.createdAt) {
    const ageDays = (Date.now() - new Date(c.createdAt).getTime()) / 86_400_000;
    if (ageDays >= 0 && ageDays < 90) {
      signals.push({ key: "age", label: "Very new", weight: 8, detail: `Created ${Math.round(ageDays)} days ago` });
    }
  }
  if (c.kind === "app" && c.ratings !== undefined && c.ratings < 50) { // only when the store actually reported a count
    signals.push({ key: "reach", label: "Few ratings", weight: 4, detail: `${c.ratings ?? 0} ratings, unlike an established app` });
  }
  if (c.kind === "domain") {
    signals.push({ key: "cert", label: "Certificate issued for look-alike host", weight: 10, detail: "Found in public certificate-transparency logs" });
  }

  // 6. Description-embedded links to non-official domains (+8)
  const links = (c.description ?? "").match(/https?:\/\/[^\s)]+/gi) ?? [];
  const bad = links.filter((l) => !brand.officialDomains.some((d) => l.toLowerCase().includes(d.toLowerCase())));
  if (bad.length) {
    signals.push({ key: "link", label: "Links to non-official site", weight: 8, detail: bad.slice(0, 2).join(", ") });
  }

  // Compounding: a strong lookalike that ALSO shows scam behaviour is far riskier than either alone
  const behaviour = signals.filter((s) => ["lang", "phone", "link"].includes(s.key)).length;
  if (nameSim >= 0.8 && behaviour >= 1) {
    const w = Math.min(30, 12 + behaviour * 6);
    signals.push({ key: "combo", label: "Look-alike + scam behaviour", weight: w, detail: "Name imitation combined with fraud indicators" });
  }

  // Over-flagging guard: a name match alone (e.g. a personal handle that merely contains the
  // brand word) is not enough. Require corroboration unless the name is near-identical AND
  // the display name itself (not just the handle) carries it.
  // "cert" is deliberately NOT corroboration: every domain in the certificate logs has a certificate,
  // including the brand's own sites, so it says nothing about impersonation on its own.
  const corroborated = signals.some((s) => ["logo", "lang", "phone", "link", "age", "homoglyph", "typo", "nameword", "reformat"].includes(s.key));
  const displaySim = nameSimilarity(c.name, brand.name);
  // A near-identical APP name from a non-official publisher is suspicious by itself; a domain or profile is not
  // (brands own many domains like paytmmoney.com), so those need corroborating evidence.
  if (!corroborated && !(displaySim >= 0.9 && c.kind === "app")) return null;

  let score = Math.min(100, signals.reduce((a, s) => a + s.weight, 0));
  // "Stats for Spotify", "Turrit for Telegram": the name points at the brand to say what the tool works with, which is
  // not pretending to be it. Without a copied logo or a rogue phone number, keep these below "high".
  const thirdParty = isThirdPartyTool(c.name, brand.name);
  if (thirdParty && logoSim < 0.8 && !rogue.length) {
    score = Math.min(score, 49);
    signals.push({ key: "third-party", label: "Third-party tool for the brand", weight: 0, detail: `"${c.name}" names ${brand.name} to say what it works with` });
  }
  if (score < 35) return null;

  const top = [...signals].sort((a, b) => b.weight - a.weight).slice(0, 3).map((s) => s.label.toLowerCase());
  return {
    ...c,
    score,
    severity: severityOf(score),
    signals,
    phones: rogue,
    summary: `Likely impersonation of ${brand.name}: ${top.join(", ")}.`,
    aiAnalyzed: false,
  };
}
