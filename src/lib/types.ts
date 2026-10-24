export type Platform =
  | "app-store"
  | "play-store"
  | "bluesky"
  | "telegram"
  | "youtube"
  | "domain"
  | "instagram"
  | "x";

export type Kind = "app" | "profile" | "page" | "domain";
export type Severity = "critical" | "high" | "medium" | "low";

export interface Brand {
  name: string;
  officialHandles: string[]; // flat list across platforms (derived from `handles`)
  officialDomains: string[];
  officialDevelopers: string[];
  officialPhones: string[];
  officialApps: string[]; // bundle IDs / package names / store IDs
  logoUrl?: string;
  logoDataUrl?: string; // uploaded official logo (data URL)
}

/** What the profile form edits; flattened into `Brand` for scanning. */
export interface BrandProfile {
  name: string;
  logoDataUrl?: string;
  handles: { bluesky: string[]; telegram: string[]; youtube: string[] };
  apps: { id: string; store: "app-store" | "play-store"; label?: string }[];
  developers: string[];
  domains: string[];
  phones: string[];
}

export function profileToBrand(p: BrandProfile): Brand {
  return {
    name: p.name.trim(),
    officialHandles: [...p.handles.bluesky, ...p.handles.telegram, ...p.handles.youtube].map((h) => h.trim().replace(/^@/, "")).filter(Boolean),
    officialDomains: p.domains.map((d) => d.trim().toLowerCase()).filter(Boolean),
    officialDevelopers: p.developers.map((d) => d.trim()).filter(Boolean),
    officialPhones: p.phones.map((x) => x.trim()).filter(Boolean),
    officialApps: p.apps.map((a) => a.id.trim()).filter(Boolean),
    logoDataUrl: p.logoDataUrl,
  };
}

export interface Candidate {
  id: string;
  platform: Platform;
  source: "live" | "simulated";
  kind: Kind;
  name: string;
  handle?: string;
  developer?: string;
  url?: string;
  description?: string;
  iconUrl?: string;
  followers?: number;
  installs?: number;
  ratings?: number;
  createdAt?: string;
  logoSim?: number; // 0..1 similarity of icon/avatar to the official logo
  via?: string; // set when a candidate came from an optional third-party source, e.g. "Apify: ..."
}

export interface Signal {
  key: string;
  label: string;
  weight: number; // contribution to 0-100 score
  detail: string;
}

export interface Finding extends Candidate {
  score: number;
  severity: Severity;
  signals: Signal[];
  phones: string[];
  summary: string;
  aiAnalyzed: boolean;
  category?: string;
}

export interface SourceStatus {
  platform: Platform;
  label?: string; // shown instead of the platform name when one platform has more than one source
  source: "live" | "simulated";
  ok: boolean;
  count: number;
  note?: string;
  ms?: number;
  cached?: boolean;
}

export interface ExcludedItem {
  id: string;
  platform: Platform;
  name: string;
  handle?: string;
  url?: string;
  source: "live" | "simulated";
  reason: string;
}

export interface ScanResult {
  brand: Pick<Brand, "name">;
  scannedAt: string;
  findings: Finding[];
  excludedItems: ExcludedItem[];
  sources: SourceStatus[];
  stats: {
    candidates: number;
    flagged: number;
    critical: number;
    excluded: number; // official assets skipped
    logoChecked: number;
    ms: number;
  };
}
