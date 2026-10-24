import { describe, expect, it } from "vitest";
import { imitatedAsset } from "@/lib/imitates";

const profile = {
  name: "Paytm",
  apps: [
    { id: "473941634", store: "app-store" as const, label: "Paytm (iOS)" },
    { id: "net.one97.paytm", store: "play-store" as const },
  ],
  handles: { bluesky: [], telegram: ["@paytm_official"], youtube: ["paytm"] },
  domains: ["paytm.com"],
};

describe("imitatedAsset", () => {
  it("names the official app in the same store, using its label when there is one", () => {
    expect(imitatedAsset({ platform: "app-store" }, profile)).toBe("Paytm (iOS), the official Apple App Store app");
    expect(imitatedAsset({ platform: "play-store" }, profile)).toBe("net.one97.paytm, the official Google Play app");
  });

  it("names the official account on the same network, without a leading @@", () => {
    expect(imitatedAsset({ platform: "telegram" }, profile)).toBe("@paytm_official, the official Telegram account");
    expect(imitatedAsset({ platform: "youtube" }, profile)).toBe("@paytm, the official YouTube account");
  });

  it("names the official website for a look-alike domain", () => {
    expect(imitatedAsset({ platform: "domain" }, profile)).toBe("paytm.com, the official website");
  });

  it("says so when the profile lists no asset of that type, instead of inventing one", () => {
    expect(imitatedAsset({ platform: "bluesky" }, profile)).toBe("Paytm's official Bluesky account (none listed in the profile)");
    expect(imitatedAsset({ platform: "instagram" }, profile)).toBe("Paytm's official Instagram account (none listed in the profile)");
    expect(imitatedAsset({ platform: "x" }, profile)).toBe("Paytm's official X account (none listed in the profile)");
    expect(imitatedAsset({ platform: "app-store" }, { ...profile, apps: [] })).toBe("Paytm's official app on Apple App Store (none listed in the profile)");
    expect(imitatedAsset({ platform: "domain" }, { ...profile, domains: [] })).toBe("Paytm's official website (none listed in the profile)");
  });
});
