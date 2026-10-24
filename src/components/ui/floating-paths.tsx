"use client";

import React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Slow, deterministic drift speeds (seconds) so server and client render the same markup. */
const duration = (i: number) => 20 + ((i * 7) % 11);

export function FloatingPathsBackground({
  position,
  children,
  className,
  pathsClassName,
}: {
  /** 1 sweeps the curves one way, -1 mirrors them. */
  position: number;
  className?: string;
  /** Extra classes for the line layer (opacity, colour). */
  pathsClassName?: string;
  children: React.ReactNode;
}) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
  }));

  return (
    <div className={cn("relative w-full", className)}>
      {/* lines sit behind the content and never take clicks; theme-aware via the page's foreground colour */}
      <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden text-foreground", pathsClassName)}>
        <svg className="h-full w-full" viewBox="0 0 696 316" preserveAspectRatio="xMidYMid slice" fill="none">
          {paths.map((path) => (
            <motion.path
              key={path.id}
              d={path.d}
              stroke="currentColor"
              strokeWidth={path.width}
              strokeOpacity={0.1 + path.id * 0.03}
              initial={{ pathLength: 0.3, opacity: 0.6 }}
              animate={{
                pathLength: 1,
                opacity: [0.3, 0.6, 0.3],
                pathOffset: [0, 1, 0],
              }}
              transition={{
                duration: duration(path.id),
                repeat: Number.POSITIVE_INFINITY,
                ease: "linear",
              }}
            />
          ))}
        </svg>
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
