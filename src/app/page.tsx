"use client";

import { useEffect, useState } from "react";
import ProfileForm, { EMPTY_PROFILE } from "@/components/ProfileForm";
import AccuracyView from "@/components/AccuracyView";
import ScanView from "@/components/ScanView";
import AutomationView from "@/components/AutomationView";
import { Check } from "lucide-react";
import Landing from "@/components/Landing";
import ThemeSwitch from "@/components/ThemeSwitch";
import type { BrandProfile } from "@/lib/types";

const KEY = "clonex.profile.v1";
const LEGACY_KEY = "mirage.profile.v1"; // saved before the rename
const LAST_SCAN_KEY = "clonex.lastscan.v1"; // written by ScanView
const TAKEDOWNS_KEY = "clonex.takedowns.v1"; // written by ScanView
const ENTERED_KEY = "clonex.entered"; // opening page is shown once per browser session

const STEPS = [
  { id: "profile", label: "Brand Profile" },
  { id: "monitor", label: "Monitor & Triage" },
  { id: "accuracy", label: "Accuracy Report" },
  { id: "automation", label: "How it works" },
] as const;

export default function Home() {
  const [profile, setProfile] = useState<BrandProfile | null>(null);
  const [tab, setTab] = useState<"profile" | "monitor" | "accuracy" | "automation">("profile");
  const [ready, setReady] = useState(false);
  const [entered, setEntered] = useState(false);
  const [formKey, setFormKey] = useState(0); // bumping it remounts the profile form with empty fields

  // Every visit starts on a blank Step 1 so the user chooses the brand to protect. Anything saved by an earlier
  // visit (profile, last scan, takedown statuses) is cleared here; it is still kept while the page is open, so
  // switching between the steps does not lose the current scan.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      [KEY, LEGACY_KEY, LAST_SCAN_KEY, TAKEDOWNS_KEY].forEach((k) => localStorage.removeItem(k));
    } catch {
      /* storage unavailable: nothing to clear */
    }
    try {
      setEntered(sessionStorage.getItem(ENTERED_KEY) === "1");
    } catch {
      /* storage unavailable: show the opening page */
    }
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const save = (p: BrandProfile) => {
    setProfile(p);
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
    setTab("monitor");
  };

  // Forget the saved brand and its last scan, and return to an empty Step 1 (for a clean demo).
  const startOver = () => {
    try {
      [KEY, LEGACY_KEY, LAST_SCAN_KEY, TAKEDOWNS_KEY].forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    setProfile(null);
    setFormKey((k) => k + 1);
    setTab("profile");
  };

  const enter = () => {
    setEntered(true);
    try {
      sessionStorage.setItem(ENTERED_KEY, "1");
    } catch {
      /* ignore */
    }
    window.scrollTo(0, 0);
  };

  if (!ready) return null;
  if (!entered) return <Landing onEnter={enter} />;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8">
      <a href="#main" className="sr-only rounded-full bg-white px-4 py-2 text-sm font-semibold text-black focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100]">
        Skip to content
      </a>
      <header className="z-40 -mx-5 lg:sticky lg:top-0 mb-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-white/[0.06] bg-[var(--header-bg)] px-5 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true" className="text-white">
            <rect x="2.5" y="2.5" width="19" height="19" rx="6" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.5" />
            <rect x="10.5" y="10.5" width="19" height="19" rx="6" fill="currentColor" />
          </svg>
          <h1 className="text-xl font-semibold tracking-tight text-white">CloneX</h1>
        </div>
        <nav aria-label="Workflow steps" className="order-last grid w-full sm:order-none grid-cols-4 items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 text-sm sm:flex sm:w-auto">
          {STEPS.map((s, i) => {
            const locked = s.id === "monitor" && !profile;
            const active = tab === s.id;
            const done = s.id === "profile" && !!profile; // step 1 is complete once a profile is saved
            return (
              <div key={s.id} className="flex min-w-0 items-center gap-1">
                {i > 0 && <span className="hidden px-1 text-white/25 sm:inline" aria-hidden="true">→</span>}
                <button
                  disabled={locked}
                  onClick={() => setTab(s.id)}
                  aria-current={active ? "step" : undefined}
                  title={locked ? "Save a brand profile first" : undefined}
                  className={`flex w-full items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs font-medium transition sm:w-auto sm:gap-2 sm:px-4 sm:text-sm ${
                    active ? "bg-white text-black" : "text-white/55 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  }`}
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full font-mono text-[11px] ${active ? "bg-black/10" : done ? "bg-emerald-400/20 text-emerald-300" : "bg-white/10"}`}>
                    {done && !active ? <Check aria-hidden="true" className="h-3 w-3" /> : i + 1}
                  </span>
                  {s.label}
                </button>
              </div>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          {profile ? (
            <button type="button" onClick={startOver} className="btn-ghost px-4 py-2 text-xs" title="Clear the saved brand and its last scan">
              Start over
            </button>
          ) : (
            <p className="eyebrow hidden 2xl:block">Brand impersonation monitoring</p>
          )}
          <ThemeSwitch />
        </div>
      </header>

      <main id="main" tabIndex={-1} className="focus:outline-none">
        <div key={tab} className="page-enter">
          {tab === "automation" ? (
            <AutomationView />
          ) : tab === "accuracy" ? (
            <AccuracyView />
          ) : tab === "profile" || !profile ? (
            <ProfileForm key={formKey} initial={profile ?? EMPTY_PROFILE} onSave={save} />
          ) : (
            <ScanView profile={profile} />
          )}
        </div>
      </main>

      <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-6 text-xs text-white/55">
        <span>CloneX · brand impersonation monitoring · Kampus.VC Challenge 3</span>
        <span className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={() => { setTab("automation"); window.scrollTo(0, 0); }} className="hover:text-white">How it works</button>
          <a href="https://github.com/Joel-Judson-Paul77/clonex" target="_blank" rel="noreferrer" className="hover:text-white">Source on GitHub</a>
        </span>
      </footer>
    </div>
  );
}
