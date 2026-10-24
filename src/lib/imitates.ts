import type { BrandProfile, Finding, Platform } from "./types";

const STORE_NAME: Partial<Record<Platform, string>> = { "app-store": "Apple App Store", "play-store": "Google Play" };
const NETWORK_NAME: Partial<Record<Platform, string>> = { bluesky: "Bluesky", telegram: "Telegram", youtube: "YouTube", instagram: "Instagram", x: "X" };

/**
 * The official asset a detection copies, taken from the brand profile: the official app in the same store, the
 * official account on the same network, or the official website. When the profile lists no asset of that type the
 * line says so, rather than naming one that is not on file.
 */
export function imitatedAsset(f: Pick<Finding, "platform">, profile: Pick<BrandProfile, "name" | "apps" | "handles" | "domains">): string {
  const brand = profile.name.trim() || "the brand";

  if (f.platform === "app-store" || f.platform === "play-store") {
    const app = profile.apps.find((a) => a.store === f.platform);
    return app ? `${app.label?.trim() || app.id}, the official ${STORE_NAME[f.platform]} app` : `${brand}'s official app on ${STORE_NAME[f.platform]} (none listed in the profile)`;
  }
  if (f.platform === "domain") {
    const d = profile.domains.map((x) => x.trim()).find(Boolean);
    return d ? `${d}, the official website` : `${brand}'s official website (none listed in the profile)`;
  }
  if (f.platform === "bluesky" || f.platform === "telegram" || f.platform === "youtube") {
    const h = profile.handles[f.platform].map((x) => x.trim().replace(/^@/, "")).find(Boolean);
    return h ? `@${h}, the official ${NETWORK_NAME[f.platform]} account` : `${brand}'s official ${NETWORK_NAME[f.platform]} account (none listed in the profile)`;
  }
  return `${brand}'s official ${NETWORK_NAME[f.platform] ?? "social"} account (none listed in the profile)`;
}
