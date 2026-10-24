"use client";

import { useSyncExternalStore } from "react";
import { CHANGE_EVENT, THEME_KEY } from "@/lib/theme-script";

/** What the viewer picked. "system" follows the operating system's light/dark setting. */
export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

function readChoice(): ThemeChoice {
  const c = document.documentElement.getAttribute("data-theme-choice");
  return c === "light" || c === "dark" ? c : "system";
}

function readResolved(): ResolvedTheme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

/** Apply a new choice straight away and remember it for this viewer. */
export function setThemeChoice(choice: ThemeChoice) {
  const d = document.documentElement;
  d.setAttribute("data-theme-choice", choice);
  const light = choice === "light" || (choice === "system" && window.matchMedia("(prefers-color-scheme: light)").matches);
  d.setAttribute("data-theme", light ? "light" : "dark");
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* storage unavailable: the choice lasts until the page is closed */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, readChoice, () => "system");
}

/** The theme actually on screen (light or dark), for components that need to pick colours in JS. */
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribe, readResolved, () => "dark");
}
