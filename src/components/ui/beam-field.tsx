"use client";

import { useState } from "react";
import { BorderBeam } from "@/components/ui/border-beam-search";
import { useResolvedTheme } from "@/lib/theme";

/**
 * Wraps a text field in an animated border beam that lights up only while the field
 * has focus, so the user always sees which input they are filling in.
 */
export function BeamField({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const [focused, setFocused] = useState(false);
  const theme = useResolvedTheme();
  return (
    <BorderBeam
      size="line"
      colorVariant="mono"
      theme={theme}
      duration={3.1}
      borderRadius={10}
      active={focused}
      className={className}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
    >
      {children}
    </BorderBeam>
  );
}
