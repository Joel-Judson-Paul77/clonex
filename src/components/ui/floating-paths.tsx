"use client";

import React from "react";
import { cn } from "@/lib/utils";

export function FloatingPathsBackground({
  position,
  children,
  className,
  pathsClassName,
  fixed = false,
}: {
  /** 1 sweeps the curves one way, -1 mirrors them. */
  position: number;
  className?: string;
  /** Extra classes for the line layer (opacity, colour). */
  pathsClassName?: string;
  /** Pin the lines to the viewport so they fill the whole page background instead of just this block. */
  fixed?: boolean;
  children: React.ReactNode;
}) {
  // Static curves, animated as ONE layer with transform/opacity only (GPU-composited, no per-frame JS or
  // SVG repaint). 36 individually animated paths was too heavy; 18 curves read the same.
  const paths = React.useMemo(
    () =>
      Array.from({ length: 18 }, (_, k) => {
        const i = k * 2;
        return {
          id: i,
          d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
          width: 0.5 + i * 0.03,
          opacity: 0.1 + i * 0.03,
        };
      }),
    [position],
  );

  return (
    <div className={cn("relative w-full", className)}>
      <div aria-hidden="true" className={cn("pointer-events-none inset-0 overflow-hidden text-foreground", fixed ? "fixed z-0" : "absolute", pathsClassName)}>
        <svg className="floating-paths-layer h-full w-full" viewBox="0 0 696 316" preserveAspectRatio="xMidYMid slice" fill="none">
          {paths.map((path) => (
            <path key={path.id} d={path.d} stroke="currentColor" strokeWidth={path.width} strokeOpacity={path.opacity} />
          ))}
        </svg>
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
