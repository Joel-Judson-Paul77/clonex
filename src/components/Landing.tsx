"use client";

import { CrowdCanvas } from "@/components/ui/skiper39";
import { FlowButton } from "@/components/ui/flow-button";
import ThemeSwitch from "@/components/ThemeSwitch";
import { NewsArticles } from "@/components/ui/news-articles";

// Black line-art crowd (Open Peeps), white-filled, so it stands out against the dark page.
const CROWD_SRC = "https://cdn.21st.dev/assets/localized/abdb8990a7bef8c2f5af3e45f0a3c969c4b0603fba8be92e81347de4ea4e1ed7.png";

const THREATS = ["Fake apps", "Cloned accounts", "Look-alike domains", "Scam support numbers"];

/** Opening page: states the problem over the crowd, then leads into the CloneX workflow. */
export default function Landing({ onEnter }: { onEnter: () => void }) {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center gap-3 px-5 pt-8">
        <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true" className="text-white">
          <rect x="2.5" y="2.5" width="19" height="19" rx="6" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.5" />
          <rect x="10.5" y="10.5" width="19" height="19" rx="6" fill="currentColor" />
        </svg>
        <span className="text-xl font-semibold tracking-tight text-white">CloneX</span>
        <ThemeSwitch className="ml-auto" />
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-5 pt-10 text-center sm:pt-14">
        <p className="eyebrow">Digital risk protection</p>
        <h1 className="mt-4 bg-gradient-to-b from-white to-white/55 bg-clip-text text-4xl font-semibold leading-[1.08] text-transparent sm:text-6xl">
          Anyone can pretend to be your brand.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
          Fake apps, cloned social accounts and look-alike domains appear every day. Your customers can&apos;t tell the
          difference until they&apos;ve already been scammed.
        </p>

        <ul className="mt-6 flex flex-wrap justify-center gap-2" aria-label="What impersonators use">
          {THREATS.map((t) => (
            <li key={t} className="rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-xs text-white/75">
              {t}
            </li>
          ))}
        </ul>

        <p className="mt-8 max-w-xl text-sm text-white/55">
          CloneX searches app stores and social platforms, compares names and logos, and shows you exactly what to report.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <FlowButton onClick={onEnter}>Enter CloneX</FlowButton>
          <button
            type="button"
            onClick={() => document.getElementById("in-the-news")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="btn-ghost px-5 py-3 text-sm"
          >
            Articles ↓
          </button>
        </div>
      </section>

      {/* the crowd: everyone looks the same from a distance */}
      <div className="pointer-events-none relative mt-6 h-[42vh] w-full min-h-[260px]">
        <div className="absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-background to-transparent" />
        <CrowdCanvas src={CROWD_SRC} rows={15} cols={7} className="absolute bottom-0 h-full w-full" />
      </div>

      <NewsArticles className="bg-background" />
    </main>
  );
}
