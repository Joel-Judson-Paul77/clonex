"use client";

import { useEffect, useState } from "react";
import { NeuroNoise } from "@paper-design/shaders-react";

/**
 * Animated white "neural filament" background for a card (from the 21st.dev CTA-06 block).
 * Put it as the FIRST child of a `relative` card and lift the card's content with `relative`.
 * It sits behind the content, ignores the mouse, is clipped to the card's corners (so dropdowns inside the
 * card can still overflow it) and fades out towards the left so text stays readable.
 */
export function NeuroBackdrop({ radius = "rounded-3xl" }: { radius?: string }) {
  // honour "reduce motion": render one still frame instead of animating
  const [still, setStill] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setStill(q.matches);
    sync();
    q.addEventListener("change", sync);
    return () => q.removeEventListener("change", sync);
  }, []);

  return (
    <div aria-hidden="true" className={`theme-invert pointer-events-none absolute inset-0 overflow-hidden ${radius}`}>
      <NeuroNoise
        className="absolute inset-0 h-full w-full"
        style={{
          maskImage: "linear-gradient(to left, black 25%, transparent 85%)",
          WebkitMaskImage: "linear-gradient(to left, black 25%, transparent 85%)",
        }}
        brightness={0}
        contrast={1}
        colorMid="rgba(255, 255, 255, 0.85)"
        scale={0.55}
        speed={still ? 0 : 1}
        width={1280}
        height={720}
      />
    </div>
  );
}

export default NeuroBackdrop;
