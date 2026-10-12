import sharp from "./sharp-config";
import type { Brand, Candidate, SourceStatus } from "./types";

// Instagram and X block automated search, so for the prototype these two platforms run on a
// clearly-labelled SIMULATED feed. It is generated around the brand being protected and
// includes both scams and harmless/official accounts, so it exercises detection AND the
// "don't over-flag / exclude official" requirements. Production would plug in licensed data.

async function tamperedLogo(logoDataUrl?: string): Promise<string | undefined> {
  if (!logoDataUrl) return undefined;
  try {
    const buf = Buffer.from(logoDataUrl.split(",")[1] ?? "", "base64");
    const out = await sharp(buf, { failOn: "none" }).modulate({ hue: 30, brightness: 1.1 }).jpeg({ quality: 55 }).toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    return undefined;
  }
}

function squat(name: string): string {
  const b = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (/o/.test(b)) return b.replace("o", "0");
  if (/a/.test(b)) return b.replace("a", "4");
  if (/i/.test(b)) return b.replace("i", "1");
  return b + "_";
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

export async function simulatedFeed(brand: Brand): Promise<{ candidates: Candidate[]; statuses: SourceStatus[] }> {
  const B = brand.name;
  const b = B.toLowerCase().replace(/[^a-z0-9]/g, "");
  const stolen = await tamperedLogo(brand.logoDataUrl);

  const ig: Candidate[] = [
    {
      id: `sim-ig-support`, platform: "instagram", source: "simulated", kind: "profile",
      name: `${B} Customer Care`, handle: `${b}_support_official`,
      description: `Official ${B} support. DM now for KYC update & instant refund. Call +91 98765 43210 immediately.`,
      url: `https://instagram.com/${b}_support_official`, followers: 312, createdAt: daysAgo(9), iconUrl: stolen,
    },
    {
      id: `sim-ig-store`, platform: "instagram", source: "simulated", kind: "profile",
      name: `${B} Official Store`, handle: `${b}.store.in`,
      description: `Best deals and offers. Link in bio.`,
      url: `https://instagram.com/${b}.store.in`, followers: 1200, createdAt: daysAgo(40), iconUrl: stolen,
    },
    {
      // harmless fan page - must NOT be flagged
      id: `sim-ig-memes`, platform: "instagram", source: "simulated", kind: "profile",
      name: `${B} memes`, handle: `${b}memes`,
      description: `Funny posts about daily life. Not affiliated with any company.`,
      url: `https://instagram.com/${b}memes`, followers: 48200, createdAt: daysAgo(900),
    },
  ];
  if (brand.officialHandles[0]) {
    // the real account - must be excluded
    ig.push({
      id: `sim-ig-official`, platform: "instagram", source: "simulated", kind: "profile",
      name: B, handle: brand.officialHandles[0], description: `The official ${B} account.`,
      url: `https://instagram.com/${brand.officialHandles[0]}`, followers: 2_400_000, createdAt: daysAgo(3000), iconUrl: brand.logoDataUrl,
    });
  }

  const x: Candidate[] = [
    {
      id: `sim-x-squat`, platform: "x", source: "simulated", kind: "profile",
      name: `${B} Help`, handle: `${squat(B)}_help`,
      description: `Facing a blocked account? Message us on WhatsApp now, urgent resolution. Share your UPI PIN and OTP to verify.`,
      url: `https://x.com/${squat(B)}_help`, followers: 87, createdAt: daysAgo(4),
    },
    {
      id: `sim-x-reward`, platform: "x", source: "simulated", kind: "profile",
      name: `${B} Rewards`, handle: `${b}rewards2026`,
      description: `Lucky draw winner! Claim your cashback reward today: http://claim-${b}-rewards.top/win`,
      url: `https://x.com/${b}rewards2026`, followers: 145, createdAt: daysAgo(12),
    },
    {
      // a legitimate journalist mentioning the brand - must NOT be flagged
      id: `sim-x-news`, platform: "x", source: "simulated", kind: "profile",
      name: `Fintech Watch`, handle: `fintechwatch`,
      description: `Covering ${B}, UPI and digital payments in India.`,
      url: `https://x.com/fintechwatch`, followers: 21000, createdAt: daysAgo(1400),
    },
  ];

  const note = "Platform blocks automated access - demo data";
  return {
    candidates: [...ig, ...x],
    statuses: [
      { platform: "instagram", source: "simulated", ok: true, count: ig.length, note },
      { platform: "x", source: "simulated", ok: true, count: x.length, note },
    ],
  };
}
