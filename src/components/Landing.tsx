"use client";

import { CrowdCanvas } from "@/components/ui/skiper39";
import { FlowButton } from "@/components/ui/flow-button";
import ThemeSwitch from "@/components/ThemeSwitch";
import { NewsArticles } from "@/components/ui/news-articles";
import { CountUp } from "@/components/ui/count-up";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";

// Black line-art crowd (Open Peeps), white-filled, so it stands out against the dark page.
const CROWD_SRC = "https://cdn.21st.dev/assets/localized/abdb8990a7bef8c2f5af3e45f0a3c969c4b0603fba8be92e81347de4ea4e1ed7.png";

const THREATS = ["Fake apps", "Cloned accounts", "Look-alike domains", "Scam support numbers"];

/** Glow colour of the timeline (electric blue, so it reads against the white-on-black page). */
const ACCENT = "#5b8cff";

const STEPS = [
  { to: 5, unit: "sources", title: "Search", body: "App Store, Google Play, Bluesky, Telegram and look-alike domains, all at once." },
  { to: 100, prefix: "0 to", unit: "", title: "Score", body: "Each listing gets a 0 to 100 risk score with the reasons behind it." },
  { to: 1, unit: "click", title: "Act", body: "Review the evidence, then send a takedown notice in one click." },
];

/** Opening page: states the problem over the crowd, then leads into the CloneX workflow. */
export default function Landing({ onEnter }: { onEnter: () => void }) {
  const railRef = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: railRef, offset: ["start 65%", "end 55%"] });
  const fill = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
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

      {/* numbers: what one scan covers (figures taken from the product itself), on a glowing scroll timeline */}
      <section aria-label="What CloneX does" className="relative z-10 mx-auto w-full max-w-4xl px-5 py-20 sm:py-28">
        <p className="eyebrow text-center">How it works</p>
        <ol ref={railRef} className="relative mt-12 flex flex-col gap-14 pl-12 sm:gap-20 sm:pl-16">
          {/* the rail: a faint track, a glowing fill that grows with scroll, and a bright orb riding its tip */}
          <div aria-hidden="true" className="absolute bottom-2 left-[11px] top-2 w-[2px] rounded-full bg-white/10 sm:left-[15px]">
            <motion.div
              className="absolute inset-x-0 top-0 rounded-full"
              style={{
                height: fill,
                background: `linear-gradient(to bottom, transparent, ${ACCENT})`,
                boxShadow: `0 0 10px 1px ${ACCENT}, 0 0 28px 3px ${ACCENT}77`,
              }}
            />
            <motion.span
              className="absolute -left-[7px] h-4 w-4 -translate-y-1/2 rounded-full bg-white"
              style={{ top: fill, boxShadow: `0 0 12px 3px ${ACCENT}, 0 0 42px 12px ${ACCENT}88` }}
            />
          </div>
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative grid gap-4 sm:grid-cols-[minmax(0,15rem)_1fr] sm:items-center sm:gap-10">
              <motion.span
                aria-hidden="true"
                className="absolute -left-[41px] top-4 h-2.5 w-2.5 rounded-full bg-white/25 sm:-left-[53px]"
                initial={false}
                whileInView={{ backgroundColor: ACCENT, boxShadow: `0 0 12px 2px ${ACCENT}` }}
                viewport={{ margin: "0px 0px -45% 0px" }}
                transition={{ duration: 0.4 }}
              />
              <div>
                <span className="num text-sm" style={{ color: ACCENT }}>0{i + 1}</span>
                <div className="num mt-2 flex items-baseline gap-2 text-6xl text-white sm:text-7xl">
                  {s.prefix && <span className="text-3xl text-white/45 sm:text-4xl">{s.prefix}</span>}
                  <CountUp to={s.to} digitEffect="slide" duration={1.6} delay={i * 0.15} />
                  <span className="text-2xl text-white/45 sm:text-3xl">{s.unit}</span>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">{s.title}</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-white/60">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <NewsArticles className="bg-background" />
    </main>
  );
}
