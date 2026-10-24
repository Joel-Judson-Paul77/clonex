"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { setThemeChoice, useThemeChoice, type ThemeChoice } from "@/lib/theme";

const OPTIONS: { id: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "system", label: "System", Icon: Monitor },
];

/** Light / Dark / System toggle. The choice is applied at once and saved for this browser. */
export default function ThemeSwitch({ className = "" }: { className?: string }) {
  const choice = useThemeChoice();
  return (
    <div role="group" aria-label="Colour theme" className={`flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.03] p-0.5 ${className}`}>
      {OPTIONS.map(({ id, label, Icon }) => {
        const on = choice === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setThemeChoice(id)}
            aria-pressed={on}
            aria-label={`${label} theme`}
            title={id === "system" ? "System theme (follows your device)" : `${label} theme`}
            className={`flex h-7 w-7 items-center pointer-coarse:h-11 pointer-coarse:w-11 justify-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white ${
              on ? "bg-white text-black" : "text-white/55 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
