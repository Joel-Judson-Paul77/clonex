/** One brand, assembled from app-store results, ready to auto-fill the profile form. */
export interface BrandCard {
  key: string;
  name: string;
  publisher: string;
  iconUrl?: string;
  ios?: { appId: string; bundleId?: string; title: string };
  android?: { pkg: string; title: string; developer?: string };
  domain?: string;
  /** "live" = came from a store API just now; "preset" = built-in fallback list */
  origin: "live" | "preset";
}

export interface LookupResponse {
  q: string;
  cards: BrandCard[];
  live: { ios: boolean; android: boolean };
  note?: string;
}
