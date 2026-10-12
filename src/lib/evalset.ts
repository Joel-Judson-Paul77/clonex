import type { Brand, Candidate } from "./types";
import { nameSimilarity } from "./lookalike";
import { scoreCandidate } from "./scoring";

// Labelled test set for look-alike detection (the brief's bonus: character swaps, added words,
// spacing changes - WITHOUT over-flagging legitimate names).
//
// Honesty notes: fakes are generated from the same families the brief names (swaps / added words /
// spacing), so recall on them partly measures our own assumptions. The NEGATIVES are the real test of
// over-flagging: unrelated brands, genuinely similar-sounding brands, fan pages and news accounts.

export type Label = "fake" | "legit";
export interface Case {
  brand: string;
  name: string;
  handle: string;
  description: string;
  label: Label;
  category: string;
}

const SCAM = "Instant refund and KYC update. DM or call 98765 43210 now.";
const NEUTRAL = "";

function swaps(b: string): [string, string][] {
  const out: [string, string][] = [];
  const add = (v: string, cat: string) => v && v !== b && out.push([v, cat]);
  add(b.replace("o", "0"), "char-swap");
  add(b.replace("a", "4"), "char-swap");
  add(b.replace("e", "3"), "char-swap");
  add(b.replace("i", "1"), "char-swap");
  add(b.replace("l", "1"), "char-swap");
  add(b.replace("m", "rn"), "char-swap");
  add(b.slice(1), "char-swap"); // dropped first letter
  add(b.slice(0, 2) + b[1] + b.slice(2), "char-swap"); // doubled letter
  add(b.slice(0, 1) + b[2] + b[1] + b.slice(3), "char-swap"); // transposed
  return out;
}

function fakesFor(brand: string): Case[] {
  const B = brand;
  const b = brand.toLowerCase();
  const cases: Case[] = [];
  const push = (name: string, handle: string, desc: string, category: string) =>
    cases.push({ brand: B, name, handle, description: desc, label: "fake", category });

  for (const [v, cat] of swaps(b)) {
    push(v, v, SCAM, cat); // with scam text
    push(v, v, NEUTRAL, `${cat} (no text)`); // name only
  }
  for (const w of ["Support", "Official", "Customer Care", "KYC Update", "Rewards", "Loan", "Helpline", "India Official"]) {
    push(`${B} ${w}`, `${b}_${w.toLowerCase().replace(/\s+/g, "")}`, SCAM, "added-words");
    push(`${B} ${w}`, `${b}_${w.toLowerCase().replace(/\s+/g, "")}`, NEUTRAL, "added-words (no text)");
  }
  const spaced = [b.split("").join(" "), b.slice(0, 2) + " " + b.slice(2), b.slice(0, 3) + "-" + b.slice(3), b.slice(0, 2) + "." + b.slice(2), b.slice(0, 2) + "_" + b.slice(2)];
  for (const v of spaced) {
    const h = v.replace(/[ .-]/g, "_"); // a handle that is NOT the official one, as on a real platform
    push(v, h, SCAM, "spacing");
    push(v, h, NEUTRAL, "spacing (no text)");
  }
  return cases;
}

const NEGATIVES: Record<string, string[]> = {
  Paytm: ["PayU", "PayPal", "PhonePe", "Google Pay", "Amazon Pay", "MobiKwik", "Tata Neu", "Pay Day Loans Guide", "Patna News", "Cricket Live Score", "Zomato", "Pytorch Tutorials", "Paytm memes", "Fintech Watch UPI News"],
  PhonePe: ["Phone Repair Shop", "PhoneArena", "Paytm", "Google Pay", "BHIM", "Slice", "CRED", "Phone Cases India", "Pepe memes", "PhonePe memes", "Digital Payments Weekly"],
  Zomato: ["Swiggy", "Tomato Recipes", "Zomato memes", "Zoho", "Domino's", "Zomatoes Farm", "Food Blog India", "Dineout", "EatSure", "Zomato fan club", "Restaurant News"],
  Flipkart: ["Amazon India", "Myntra", "Meesho", "Flipboard", "Flip Kart Racing Go-Karts", "Flipkart memes", "Shopping Deals Daily", "Snapdeal", "Nykaa", "Ecommerce India News"],
};

function negativesFor(brand: string): Case[] {
  return (NEGATIVES[brand] ?? []).map((n) => ({
    brand,
    name: n,
    handle: n.toLowerCase().replace(/[^a-z0-9]/g, ""),
    description: /memes|fan club|news|weekly|blog|watch|tutorial|score|guide/i.test(n) ? "Posts and discussion. Not affiliated with any company." : "",
    label: "legit" as Label,
    category: /memes|fan club|news|weekly|blog|watch|tutorial|guide/i.test(n) ? "fan/news page" : /^(PayU|PayPal|PhonePe|Google Pay|Amazon Pay|MobiKwik|Tata Neu|Paytm|BHIM|Slice|CRED|Swiggy|Zoho|Domino's|Dineout|EatSure|Amazon India|Myntra|Meesho|Snapdeal|Nykaa|Flipboard)$/.test(n) ? "other real brand" : "unrelated / similar-sounding",
  }));
}


// ---------------------------------------------------------------------------------------------
// HELD-OUT STRESS TEST. Written BEFORE it was ever run and NOT used to tune the detector.
// Harder, differently-styled cases: unicode look-alikes, emoji/symbol decoration, mixed tricks,
// and legitimate names that are genuinely ambiguous. Imperfect scores here are expected and honest.
// ---------------------------------------------------------------------------------------------
const FAKE = (brand: string, name: string, handle: string, description: string, category: string): Case => ({ brand, name, handle, description, label: "fake", category });
const LEGIT = (brand: string, name: string, handle: string, description: string, category: string): Case => ({ brand, name, handle, description, label: "legit", category });

export function buildHeldOut(): Case[] {
  const cyr = "Ра"; // Cyrillic Er + a: renders like "Pa"
  return [
    FAKE("Paytm", "Paytmm Official", "paytmm_official", "Claim your reward now. Call 1800 000 111.", "typo + scam"),
    FAKE("Paytm", `${cyr}ytm Support`, "paytm_help_desk", "", "unicode homoglyph"),
    FAKE("Paytm", "PAYTM® Customer Care", "paytmcc247", "24x7 helpline, share OTP to verify", "symbol decoration"),
    FAKE("Paytm", "Paytm-In Rewards", "paytm_in_rewards", "Lucky draw winner! http://claim-paytm-win.top", "separator + scam"),
    FAKE("Paytm", "Pay tm cashback 2026", "pay_tm_2026", "Instant cashback, DM now", "spacing + scam"),
    FAKE("Paytm", "P.A.Y.T.M Official", "p_a_y_t_m", "", "punctuation"),
    FAKE("Paytm", "Paytm Helpdesk", "paytm_helpdesk_in", "", "added word (no scam text)"),
    FAKE("Paytm", "Paytrn Support", "paytrn_support", "", "rn-for-m trick"),
    FAKE("Paytm", "Paytmm", "paytmm", "", "typo (no text)"),
    FAKE("Zomato", "Zomatto Official", "zomatto_official", "Free gold membership: http://zomato-gold.xyz", "typo + link"),
    FAKE("Zomato", "Z0mato Gold Offers", "z0mato_gold", "", "digit swap + word"),
    FAKE("Zomato", "Zomato Customer Care", "zomato_care_help", "Refund issue? WhatsApp 98765 43210", "added words + phone"),
    FAKE("Zomato", "Zomat0 refund", "zomat0refund", "", "digit swap"),
    FAKE("Zomato", "Zom ato support", "zom_ato_support", "", "spacing + word"),
    FAKE("Zomato", "Zomato-Care", "zomato_care", "", "separator + word"),
    FAKE("Zomato", "Zomaato Rewards", "zomaato_rewards", "", "doubled letter + word"),
    FAKE("Zomato", "Zomatto", "zomatto", "", "typo (no text)"),

    LEGIT("Paytm", "Paytm Fans India", "paytmfansindia", "Fan page. Not affiliated with the company.", "fan page"),
    LEGIT("Paytm", "Paytm Review Blog", "paytmreviewblog", "Independent reviews of UPI apps.", "review blog"),
    LEGIT("Paytm", "Payton Mitchell", "paytonmitchell", "Photographer based in Austin.", "similar personal name"),
    LEGIT("Paytm", "Spaytm Studio", "spaytmstudio", "Yoga and wellness studio.", "unrelated containing brand letters"),
    LEGIT("Paytm", "Paytm Careers Discussion", "paytmcareersdiscuss", "Forum for job seekers.", "discussion forum"),
    LEGIT("Paytm", "Paytm Customer Reviews", "paytmcustomerreviews", "Honest user reviews. Unofficial.", "review site using scam-ish word"),
    LEGIT("Paytm", "Pat M Photography", "patmphoto", "Weddings and portraits.", "unrelated"),
    LEGIT("Paytm", "UPI Payments News", "upipaymentsnews", "Daily news on UPI, Paytm and PhonePe.", "news mentioning brand"),
    LEGIT("Zomato", "Zomato Delivery Partners Union", "zomatodpunion", "Union for delivery workers. Not affiliated.", "union / community"),
    LEGIT("Zomato", "Zomatoes Organic Farm", "zomatoesfarm", "Farm-fresh tomatoes.", "unrelated similar-sounding"),
    LEGIT("Zomato", "Zomato Stock Analysis", "zomatostocks", "Market commentary on listed companies.", "finance blog"),
    LEGIT("Zomato", "Zomaton Labs", "zomatonlabs", "Robotics research lab.", "unrelated near-name"),
    LEGIT("Zomato", "Tomato Zoom", "tomatozoom", "Cooking videos.", "unrelated"),
    LEGIT("Zomato", "Restaurant Weekly", "restaurantweekly", "Reviews of Zomato-listed restaurants.", "news mentioning brand"),
  ];
}

export const BRANDS = ["Paytm", "PhonePe", "Zomato", "Flipkart"];

export function buildDataset(): Case[] {
  return BRANDS.flatMap((b) => [...fakesFor(b), ...negativesFor(b)]);
}

function brandOf(name: string): Brand {
  const b = name.toLowerCase();
  return { name, officialHandles: [b], officialDomains: [`${b}.com`], officialDevelopers: [name], officialPhones: [], officialApps: [] };
}

function candidateOf(c: Case): Candidate {
  return { id: `${c.brand}:${c.name}:${c.category}`, platform: "instagram", source: "simulated", kind: "profile", name: c.name, handle: c.handle, description: c.description };
}

export interface Metrics { tp: number; fp: number; fn: number; tn: number; precision: number; recall: number; f1: number }
export interface Row { case: Case; nameHit: boolean; fullHit: boolean; sim: number }

function metrics(rows: Row[], pick: (r: Row) => boolean): Metrics {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const r of rows) {
    const hit = pick(r);
    if (r.case.label === "fake") hit ? tp++ : fn++;
    else hit ? fp++ : tn++;
  }
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  return { tp, fp, fn, tn, precision, recall, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0 };
}

export function evaluate(data: Case[] = buildDataset()) {
  const rows: Row[] = data.map((c) => {
    const sim = Math.max(nameSimilarity(c.name, c.brand), nameSimilarity(c.handle, c.brand));
    return { case: c, sim, nameHit: sim >= 0.6, fullHit: scoreCandidate(candidateOf(c), brandOf(c.brand)) !== null };
  });
  const byCategory: Record<string, { fake: number; legit: number; nameHits: number; fullHits: number }> = {};
  for (const r of rows) {
    const k = r.case.category;
    byCategory[k] ??= { fake: 0, legit: 0, nameHits: 0, fullHits: 0 };
    byCategory[k][r.case.label]++;
    if (r.nameHit) byCategory[k].nameHits++;
    if (r.fullHit) byCategory[k].fullHits++;
  }
  return {
    total: rows.length,
    fakes: rows.filter((r) => r.case.label === "fake").length,
    legit: rows.filter((r) => r.case.label === "legit").length,
    nameOnly: metrics(rows, (r) => r.nameHit),
    endToEnd: metrics(rows, (r) => r.fullHit),
    byCategory,
    falseAlarms: rows.filter((r) => r.fullHit && r.case.label === "legit").map((r) => `${r.case.brand}: ${r.case.name}`),
    nameFalseAlarms: rows.filter((r) => r.nameHit && r.case.label === "legit").map((r) => `${r.case.brand}: ${r.case.name}`),
    missed: rows.filter((r) => !r.fullHit && r.case.label === "fake").map((r) => `${r.case.brand}: "${r.case.name}" [${r.case.category}]`),
  };
}

export function evaluateAll() {
  return { main: evaluate(buildDataset()), heldOut: evaluate(buildHeldOut()) };
}
