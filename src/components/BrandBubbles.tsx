"use client";

import { useEffect, useState } from "react";
import { featuredPresets, presetCard } from "@/lib/brand-presets";
import type { BrandCard } from "@/lib/brand-types";

/** One-click starter brands shown under the search bar. Icons load from the App Store; letters are the fallback. */
export default function BrandBubbles({ onPick }: { onPick: (c: BrandCard) => void }) {
  const [icons, setIcons] = useState<Record<string, string>>({});
  const presets = featuredPresets();

  useEffect(() => {
    let alive = true;
    fetch("/api/preset-icons")
      .then((r) => r.json())
      .then((j) => alive && setIcons(j.icons ?? {}))
      .catch(() => undefined); // offline: the letter avatars stay
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Popular brands">
      <span className="eyebrow mr-1">Popular</span>
      {presets.map((p) => {
        const icon = p.iosAppId ? icons[p.iosAppId] : undefined;
        return (
          <button
            key={p.name}
            type="button"
            onClick={() => onPick({ ...presetCard(p), iconUrl: icon })}
            className="btn-ghost flex items-center gap-2 py-1 pl-1 pr-3.5 text-sm"
            title={`Fill in the profile for ${p.name}`}
          >
            {icon ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote store icon, size unknown
              <img src={icon} alt="" className="h-6 w-6 rounded-full border border-white/10 object-cover" />
            ) : (
              <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white/80">
                {p.name.slice(0, 1)}
              </span>
            )}
            {p.name}
          </button>
        );
      })}
    </div>
  );
}
