import { NextResponse } from "next/server";
import { ApiError, errorResponse, logoDataUrl, rateLimit, readJson, str, strList } from "@/lib/api-guard";
import { isHostname, scanAllLive } from "@/lib/connectors";
import { bestLogoSimilarity, hashImage, hashImageVariants } from "@/lib/imagehash";
import { nameSimilarity } from "@/lib/lookalike";
import { officialReason, scoreCandidate } from "@/lib/scoring";
import { simulatedFeed } from "@/lib/simulated";
import type { Brand, Candidate, ExcludedItem, Finding, ScanResult } from "@/lib/types";

export const maxDuration = 60;

/** Prefer small thumbnails: perceptual hashing only needs ~64px. */
function thumb(url: string): string {
  return url.replace("/img/avatar/plain/", "/img/avatar_thumbnail/plain/");
}

/** Compare each candidate's icon/avatar with the brand's official logo, using a worker pool. */
async function attachLogoSimilarity(cands: Candidate[], logo: string, brandName: string): Promise<number> {
  const official = await hashImageVariants(logo);
  if (!official.length) return 0;
  // most name-similar first, so the time budget is spent where impersonation is likeliest
  const queue = cands
    .filter((c) => c.iconUrl)
    .sort((a, b) => nameSimilarity(b.name, brandName) - nameSimilarity(a.name, brandName))
    .slice(0, 250)
    .reverse(); // pop() takes from the end -> highest similarity first
  let checked = 0;
  const budgetEnd = Date.now() + 10_000; // stop comparing after 10s; remaining icons are skipped
  const worker = async () => {
    for (let c = queue.pop(); c && Date.now() < budgetEnd; c = queue.pop()) {
      const h = await hashImage(thumb(c.iconUrl!));
      if (h) {
        c.logoSim = bestLogoSimilarity(official, h);
        checked++;
      }
    }
  };
  // 10 workers: enough to finish within the budget, while limiting concurrent native image decoding
  await Promise.all(Array.from({ length: 10 }, worker));
  return checked;
}

export async function POST(req: Request) {
  const t0 = Date.now();
  let brand: Brand;
  let simulate = false;
  try {
    rateLimit(req, "scan", 10); // each scan fans out to 5 third-party services; 10/min leaves room for demo re-scans
    const body = await readJson(req, 2_500_000);
    brand = {
      name: str(body.name, "name", { min: 3, max: 60 })!,
      officialHandles: strList(body.officialHandles, "officialHandles", 50, 100),
      officialDomains: strList(body.officialDomains, "officialDomains", 25, 253),
      officialDevelopers: strList(body.officialDevelopers, "officialDevelopers", 25, 120),
      officialPhones: strList(body.officialPhones, "officialPhones", 25, 30),
      officialApps: strList(body.officialApps, "officialApps", 25, 200),
      // NOTE: no logoUrl. The server must never fetch an arbitrary caller-supplied URL (SSRF).
      logoDataUrl: logoDataUrl(body.logoDataUrl, 1_500_000),
    };
    if (body.simulate !== undefined && typeof body.simulate !== "boolean") throw new ApiError(400, '"simulate" must be true or false');
    simulate = body.simulate === true;
  } catch (e) {
    return errorResponse(e);
  }

  try {
    return NextResponse.json(await runScan(brand, simulate, t0));
  } catch {
    return NextResponse.json({ error: "The scan failed unexpectedly. Please try again." }, { status: 500 });
  }
}

async function runScan(brand: Brand, simulate: boolean, t0: number): Promise<ScanResult> {
  const results = await scanAllLive(brand);
  const statuses = results.map((r) => r.status);
  // defensive: cached snapshots from before the hostname filter could still hold non-hostnames
  const all = results.flatMap((r) => r.candidates).filter((c) => c.kind !== "domain" || isHostname(c.name));
  if (simulate) {
    const sim = await simulatedFeed(brand);
    all.push(...sim.candidates);
    statuses.push(...sim.statuses);
  }

  // 1. Exclude the brand's own assets (they must never be flagged)
  const candidates: Candidate[] = [];
  const excludedItems: ExcludedItem[] = [];
  for (const c of all) {
    const reason = officialReason(c, brand);
    if (reason) excludedItems.push({ id: c.id, platform: c.platform, name: c.name, handle: c.handle, url: c.url, source: c.source, reason });
    else candidates.push(c);
  }
  const excluded = excludedItems.length;

  // 2. Logo / icon comparison against the uploaded official logo
  const logo = brand.logoDataUrl;
  const logoChecked = logo ? await attachLogoSimilarity(candidates, logo, brand.name) : 0;

  // 3. Score
  const findings: Finding[] = candidates
    .map((c) => scoreCandidate(c, brand))
    .filter((f): f is Finding => f !== null)
    .sort((a, b) => b.score - a.score);

  return {
    brand: { name: brand.name }, // never echo the caller's input back
    scannedAt: new Date().toISOString(),
    findings,
    excludedItems,
    sources: statuses,
    stats: {
      candidates: all.length,
      flagged: findings.length,
      critical: findings.filter((f) => f.severity === "critical").length,
      excluded,
      logoChecked,
      ms: Date.now() - t0,
    },
  };
}
