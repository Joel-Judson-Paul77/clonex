"use client";

import { useEffect, useState } from "react";
import ProfileForm, { EMPTY_PROFILE } from "@/components/ProfileForm";
import AccuracyView from "@/components/AccuracyView";
import ScanView from "@/components/ScanView";
import AutomationView from "@/components/AutomationView";
import Landing from "@/components/Landing";
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

  // Load the saved profile once on mount (localStorage only exists in the browser)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
      if (raw) {
        setProfile(JSON.parse(raw));
        setTab("monitor");
      }
    } catch {
      /* storage unavailable: start empty */
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
      <header className="mb-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="flex items-center gap-3">
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect x="2.5" y="2.5" width="19" height="19" rx="6" stroke="white" strokeOpacity="0.55" strokeWidth="1.5" />
            <rect x="10.5" y="10.5" width="19" height="19" rx="6" fill="white" />
          </svg>
          <h1 className="text-xl font-semibold tracking-tight text-white">CloneX</h1>
        </div>
        <nav aria-label="Workflow steps" className="grid w-full grid-cols-4 items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 text-sm sm:flex sm:w-auto">
          {STEPS.map((s, i) => {
            const locked = s.id === "monitor" && !profile;
            const active = tab === s.id;
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
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full font-mono text-[11px] ${active ? "bg-black/10" : "bg-white/10"}`}>{i + 1}</span>
                  {s.label}
                </button>
              </div>
            );
          })}
        </nav>
        {profile ? (
          <button type="button" onClick={startOver} className="btn-ghost px-4 py-2 text-xs" title="Clear the saved brand and its last scan">
            Start over
          </button>
        ) : (
          <p className="eyebrow hidden xl:block">Brand impersonation monitoring</p>
        )}
      </header>

      <main id="main" tabIndex={-1} className="focus:outline-none">
        {tab === "automation" ? (
          <AutomationView />
        ) : tab === "accuracy" ? (
          <AccuracyView />
        ) : tab === "profile" || !profile ? (
          <ProfileForm key={formKey} initial={profile ?? EMPTY_PROFILE} onSave={save} />
        ) : (
          <ScanView profile={profile} />
        )}
      </main>
    </div>
  );
}
