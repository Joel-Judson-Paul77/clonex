"use client";

import { NeuroBackdrop } from "@/components/ui/neuro-backdrop";
import { useEffect, useState } from "react";
import { Eye, Search, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { KpiCard, Panel, PlatformBars, RiskStrip } from "@/components/scan/charts";
import type { BrandProfile, ExcludedItem, Finding, Platform, ScanResult, Severity, Signal, SourceStatus } from "@/lib/types";
import { profileToBrand } from "@/lib/types";
import type { TakedownRecord, TakedownResponse } from "@/lib/takedown";
import TakedownModal from "@/components/scan/TakedownModal";
import { CaseActions, CaseHistory, StatusChip } from "@/components/scan/CaseControls";
import { imitatedAsset } from "@/lib/imitates";
import { addEvent, byPriority, isOpen, pendingAlerts, statusOf, transition, type CaseMap, type CaseRecord, type CaseStatus } from "@/lib/cases";

const PLATFORM: Record<Platform, string> = {
  "app-store": "Apple App Store",
  "play-store": "Google Play",
  bluesky: "Bluesky",
  telegram: "Telegram",
  youtube: "YouTube",
  instagram: "Instagram",
  x: "X (Twitter)",
  domain: "Look-alike domains",
};

/** App listings have a "listing"; social accounts and pages have a profile or page description. */
function textLabel(f: Finding) {
  return f.platform === "app-store" || f.platform === "play-store" ? "Listing text" : "Profile description";
}

const RING: Record<Severity, string> = { critical: "#ef4444", high: "#f97316", medium: "#fbbf24", low: "#71717a" };

function SourceBadge({ live, cached }: { live: boolean; cached?: boolean }) {
  const tone = cached ? "bg-sky-500/15 text-sky-300" : live ? "bg-emerald-500/15 text-emerald-300" : "bg-violet-500/15 text-violet-300";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${tone}`}>{cached ? "CACHED" : live ? "LIVE" : "SIMULATED"}</span>;
}

function ScoreRing({ score, sev }: { score: number; sev: Severity }) {
  const r = 18, c = 2 * Math.PI * r;
  return (
    <svg width="60" height="60" viewBox="0 0 46 46" className="shrink-0 drop-shadow-lg" aria-label={`Risk score ${score} of 100`}>
      <circle cx="23" cy="23" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-white/15" />
      <circle cx="23" cy="23" r={r} fill="none" stroke={RING[sev]} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 23 23)" />
      <text x="23" y="27.5" textAnchor="middle" className="fill-white text-[13px] font-bold">{score}</text>
    </svg>
  );
}

/** Turn a scoring signal into a short reason a non-technical reader understands. */
function plainReason(s: Signal, f: Finding): string | null {
  switch (s.key) {
    case "logo": return `${Math.round((f.logoSim ?? 0) * 100)}% logo similarity`;
    case "phone": return "Unofficial support phone number";
    case "name": return s.label === "Near-identical name" ? "Near-identical brand name" : "Look-alike brand name";
    case "typo": return "Misspelled brand name (typosquat)";
    case "reformat": return "Brand name with altered spacing";
    case "homoglyph": return "Look-alike characters (e.g. 0 for o)";
    case "nameword": return `Scam word in the name: "${(s.detail.match(/"([^"]+)"$/) ?? [])[1] ?? "support"}"`;
    case "link": return "Links to an unofficial website";
    case "age": return `New account (${s.detail.replace("Created ", "").toLowerCase()})`;
    case "cert": return "New certificate on a look-alike domain";
    case "dns": return "Registered look-alike domain";
    case "reach": return "Very few ratings";
    case "lang":
      if (/KYC/.test(s.label)) return "KYC scam trigger word";
      if (/Credential/.test(s.label)) return "Asks for OTP, PIN or remote access";
      if (/support/i.test(s.label)) return "Poses as customer support";
      if (/Refund/.test(s.label)) return "Refund or reward bait";
      if (/Financial/.test(s.label)) return "Loan or investment bait";
      if (/Urgen/.test(s.label)) return "Urgent pressure tactics";
      return null; // weak language signals are shown only in the evidence drawer
    default: return null; // e.g. the "combo" bonus is a scoring detail, not a reason
  }
}

function reasonsOf(f: Finding, max = 4): string[] {
  const out: string[] = [];
  for (const s of [...f.signals].sort((a, b) => b.weight - a.weight)) {
    const r = s.weight > 0 ? plainReason(s, f) : null;
    if (r && !out.includes(r)) out.push(r);
    if (out.length >= max) break;
  }
  return out;
}

function takedownReport(f: Finding, brand: string, imitates: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return [
    `Subject: Impersonation report: "${f.name}" impersonating ${brand}`,
    "",
    "Hello Trust & Safety team,",
    "",
    `We represent ${brand} and are reporting an account/app that impersonates our brand and may be used to defraud customers.`,
    "",
    `Platform: ${PLATFORM[f.platform]}`,
    `Account / app: ${f.name}${f.handle ? ` (${f.handle})` : ""}`,
    f.url ? `Link: ${f.url}` : "",
    `It appears to imitate: ${imitates}`,
    `Risk score: ${f.score}/100 (${f.severity})`,
    "",
    "Why we believe this is impersonation:",
    ...reasonsOf(f, 8)
      .filter((r) => !(f.phones.length && r === "Unofficial support phone number")) // listed with the numbers below
      .map((r) => `- ${r}`),
    f.phones.length ? `- Lists unofficial phone number(s): ${f.phones.join(", ")}` : "",
    f.description ? `\n${textLabel(f)}: "${f.description}"` : "",
    "",
    "We ask that you review and remove it under your impersonation and trademark policies and, where our logo has been copied, for copyright infringement. Further evidence is available on request.",
    "",
    `[Rights-holder to confirm before sending: I am authorised to act on behalf of ${brand}, and the information in this notice is accurate.]`,
    "",
    `${brand} Brand Protection`,
    `Prepared with CloneX on ${date}. Draft for human review before sending.`,
  ]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n");
}

function Evidence({ f, officialLogo, record }: { f: Finding; officialLogo?: string; record?: CaseRecord }) {
  const maxW = Math.max(...f.signals.map((s) => s.weight), 1);
  return (
    <div className="grid gap-6 border-t border-white/10 p-4 md:grid-cols-[1.4fr_1fr]">
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/55">How the score was built</h4>
        <ul className="space-y-2">
          {f.signals.filter((s) => s.weight > 0).map((s, i) => (
            <li key={i}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-white/90">{s.label}</span>
                <span className="font-mono text-white/80">+{s.weight}</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded bg-white/10">
                <div className="h-full rounded bg-white/70" style={{ width: `${(s.weight / maxW) * 100}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-white/55">{s.detail}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-4">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/55">Logo comparison</h4>
          {f.iconUrl ? (
            <div className="flex items-center gap-3">
              {[["Official", officialLogo], ["Suspect", f.iconUrl]].map(([l, src]) => (
                <div key={l} className="text-center">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-white/10">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element -- remote/data icons, not optimisable
                      <img src={src} alt={`${l} logo`} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-white/55">none</span>
                    )}
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-white/55">{l}</div>
                </div>
              ))}
              <div className="pl-1">
                <div className={`text-2xl font-semibold ${(f.logoSim ?? 0) >= 0.6 ? "text-red-300" : "text-white/60"}`}>{f.logoSim === undefined ? "n/a" : `${Math.round(f.logoSim * 100)}%`}</div>
                <div className="text-[10px] uppercase tracking-wide text-white/55">logo match</div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-white/55">No icon available for this listing.</p>
          )}
        </div>
        {f.description && (
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/55">{textLabel(f)}</h4>
            <p className="line-clamp-4 text-xs text-white/60">{f.description}</p>
          </div>
        )}
        {f.url && f.source === "live" && (
          <a href={f.url} target="_blank" rel="noreferrer" className="inline-block text-xs text-white/70 hover:underline">Open listing ↗</a>
        )}
        <div className="text-[11px] text-white/55">
          <span className="font-semibold text-white/75">Source:</span> {PLATFORM[f.platform]} ({f.source}) · <span className="font-mono">{f.handle ?? f.id}</span>
        </div>
        <CaseHistory record={record} />
      </div>
    </div>
  );
}

// Card styling per severity group. Critical and high both get the Report Scam action.
const TONES = {
  critical: { border: "border-red-500/25", chip: "bg-red-500/10 text-red-200", edge: "via-red-400/80", wash: "from-red-500/[0.07]", report: true },
  high: { border: "border-orange-500/25", chip: "bg-orange-500/10 text-orange-200", edge: "via-orange-400/80", wash: "from-orange-500/[0.07]", report: true },
  suspicious: { border: "border-amber-500/20", chip: "bg-amber-500/10 text-amber-200", edge: "via-amber-300/70", wash: "from-amber-400/[0.05]", report: false },
} as const;

function ThreatCard({ f, tone, officialLogo, open, onToggle, onReport, pending, record, onMove, imitates }: {
  f: Finding; tone: keyof typeof TONES; officialLogo?: string; open: boolean; onToggle: () => void; onReport: () => void; pending?: boolean;
  record?: CaseRecord; onMove: (to: CaseStatus) => void; imitates: string;
}) {
  const status = record?.status ?? "new";
  const reasons = reasonsOf(f);
  const t = TONES[tone];
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br to-white/[0.02] transition-colors hover:border-white/25 ${t.wash} ${t.border}`}>
      <span aria-hidden="true" className={`pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent to-transparent ${t.edge}`} />
      <div className="flex flex-wrap items-start gap-5 p-5">
        <ScoreRing score={f.score} sev={f.severity} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-white">{f.name}</span>
            <SourceBadge live={f.source === "live"} />
            <StatusChip status={status} />
            {pending && <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-sky-300">TAKEDOWN PENDING</span>}
          </div>
          <div className="mt-0.5 text-xs text-white/55">
            {PLATFORM[f.platform]} · <span className="font-mono">{f.handle}</span>
          </div>
          <div className="mt-1 text-xs text-white/70"><span className="font-semibold text-white/85">Imitates:</span> {imitates}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {reasons.map((r) => (
              <span key={r} className={`rounded-full px-3 py-1 text-xs font-medium ${t.chip}`}>{r}</span>
            ))}
          </div>
          <div className="mt-3"><CaseActions status={status} onMove={onMove} /></div>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          {t.report && status === "confirmed" && (
            <button onClick={onReport} disabled={pending} className="rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-always-white hover:bg-red-500 disabled:cursor-default disabled:bg-white/10 disabled:text-white/70">
              {pending ? "✓ Takedown pending" : "⚡ Initiate Takedown"}
            </button>
          )}
          <button onClick={onToggle} aria-expanded={open} className="btn-ghost px-4 py-2 text-xs">
            {open ? "Hide evidence" : "Review Evidence"}
          </button>
        </div>
      </div>
      {open && <Evidence f={f} officialLogo={officialLogo} record={record} />}
    </div>
  );
}

function Group({ dot, title, subtitle, count, tone, show = true, children }: {
  dot: string; title: string; subtitle: string; count: number; tone: string; show?: boolean; children: React.ReactNode;
}) {
  if (!show) return null;
  return (
    <section className="space-y-4 pt-2">
      <div>
        <div className="flex items-center gap-4">
          <h3 className={`flex shrink-0 items-center gap-2.5 font-heading text-xl font-semibold ${tone}`}>
            <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${dot}`} />
            {title}
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-sans text-xs font-medium text-white/75">{count}</span>
          </h3>
          <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
        </div>
        <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-white/55">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function Progress({ sources }: { sources: string[] }) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 animate-pulse rounded-full bg-white" />
        <span className="text-sm font-medium text-white">Scanning {sources.length} sources in parallel… {sec}s</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {sources.map((s, i) => <span key={s} className="flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs text-white/80"><span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" style={{ animationDelay: `${i * 180}ms` }} />{s}</span>)}
      </div>
      <p className="mt-3 text-xs text-white/55">Searching look-alike names, comparing logos and checking listing text for scam patterns. Usually 10–20 seconds.</p>
    </div>
  );
}

/** Shows the first few cards of a group; the rest sit behind a "Show more" toggle so the page stays short. */
function Limited({ items, render, limit = 3 }: { items: Finding[]; render: (f: Finding) => React.ReactNode; limit?: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, limit);
  return (
    <>
      {shown.map(render)}
      {items.length > limit && (
        <button onClick={() => setAll(!all)} aria-expanded={all} className="w-full rounded-2xl border border-white/10 py-2.5 text-xs text-white/70 hover:bg-white/[0.04]">
          {all ? "Show fewer" : `Show ${items.length - limit} more`}
        </button>
      )}
    </>
  );
}

function SourceHealth({ sources }: { sources: SourceStatus[] }) {
  return (
    <ul className="space-y-2.5">
      {sources.map((s) => (
        <li key={s.platform} className="flex items-center gap-2.5" title={s.note}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${s.ok ? "bg-emerald-400" : "bg-amber-400"}`} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm text-white">{PLATFORM[s.platform]}</span>
          <span className="text-xs text-white/55">
            {!s.ok ? "scan continued without it" : s.cached ? "saved results" : `${s.count} checked`}
          </span>
          {s.ok ? (
            <SourceBadge live={s.source === "live"} cached={s.cached} />
          ) : (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-300">UNAVAILABLE</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function SafeList({ items }: { items: ExcludedItem[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 3);
  if (!items.length) return <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/55">No official assets turned up in this scan.</p>;
  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-white/[0.03]">
      <ul className="divide-y divide-white/10">
        {shown.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">✓ Safe / Verified</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-white">{x.name}</span>
              <span className="block truncate text-xs text-white/55">{PLATFORM[x.platform]} · {x.reason}</span>
            </span>
            <SourceBadge live={x.source === "live"} />
          </li>
        ))}
      </ul>
      {items.length > 3 && (
        <button onClick={() => setAll(!all)} className="w-full border-t border-white/10 py-2.5 text-xs text-white/70 hover:underline">
          {all ? "Show fewer" : `Show all ${items.length}`}
        </button>
      )}
    </div>
  );
}

const LAST_SCAN_KEY = "clonex.lastscan.v1";
const TAKEDOWNS_KEY = "clonex.takedowns.v1";
const CASES_KEY = "clonex.cases.v1";
const ALERTED_KEY = "clonex.alerted.v1";
const ANALYST_KEY = "clonex.analyst.v1";

function readJson<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? "null") as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: decisions still show, they just won't survive a refresh */
  }
}

export default function ScanView({ profile }: { profile: BrandProfile }) {
  const [loading, setLoading] = useState(false);
  // Keep the last scan across a page refresh (per brand), so a reload during the demo doesn't lose the results.
  const [result, setResult] = useState<ScanResult | null>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LAST_SCAN_KEY) ?? "null");
      return saved?.name === profile.name && saved.result?.findings ? (saved.result as ScanResult) : null;
    } catch {
      return null;
    }
  });
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [report, setReport] = useState<Finding | null>(null);
  // Which findings have a takedown in flight, kept across a refresh. A dry run sends nothing, so it is not recorded.
  const [takedowns, setTakedowns] = useState<Record<string, TakedownRecord>>(() => {
    try {
      return JSON.parse(localStorage.getItem(TAKEDOWNS_KEY) ?? "{}") ?? {};
    } catch {
      return {};
    }
  });
  // Analyst decisions and the per-case history, kept per brand across refreshes.
  const casesKey = `${CASES_KEY}:${profile.name}`;
  const alertedKey = `${ALERTED_KEY}:${profile.name}`;
  const [cases, setCases] = useState<CaseMap>(() => readJson<CaseMap>(casesKey, {}));
  const [analyst, setAnalyst] = useState(() => readJson<string>(ANALYST_KEY, ""));
  const [statusView, setStatusView] = useState<"open" | CaseStatus | "all">("open");
  const saveCases = (next: CaseMap) => {
    setCases(next);
    writeJson(casesKey, next);
  };
  const who = analyst.trim() || "Analyst";
  const [toast, setToast] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  // When the Postgres database is configured on the server, every analyst shares one case history (refreshed every
  // 15 seconds). Otherwise the history lives in this browser only.
  const [shared, setShared] = useState(false);
  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/cases?brand=${encodeURIComponent(profile.name)}`, { cache: "no-store" });
        const j = await r.json();
        if (live && j.enabled) {
          setShared(true);
          setCases(j.cases);
        }
      } catch {
        /* database unreachable: keep working from this browser's copy */
      }
    };
    void load();
    const t = setInterval(load, 15000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [profile.name]);
  const record = async (id: string, body: { to?: CaseStatus; note?: string }) => {
    if (!shared) {
      saveCases(body.to ? transition(cases, id, body.to, who) : addEvent(cases, id, who, body.note ?? ""));
      return;
    }
    try {
      const r = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: profile.name, findingId: id, by: who, ...body }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "save failed");
      setCases((c) => ({ ...c, [id]: j.record }));
    } catch (e) {
      setToast({ tone: "warn", text: `Could not save that decision: ${e instanceof Error ? e.message : "unknown error"}` });
    }
  };
  const move = (id: string, to: CaseStatus) => void record(id, { to });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  const onTakedownDone = (f: Finding, res: TakedownResponse) => {
    setReport(null);
    if (res.status === "dry-run") {
      setToast({ tone: "warn", text: "n8n isn't connected, so nothing was sent (dry run). Set the webhook URL to dispatch for real." });
      return;
    }
    const next = { ...takedowns, [f.id]: { status: "pending" as const, at: new Date().toISOString(), mode: res.mode } };
    setTakedowns(next);
    void record(f.id, { note: `Takedown notice dispatched (${res.mode})` });
    try {
      localStorage.setItem(TAKEDOWNS_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: the badge just won't survive a refresh */
    }
    setToast({
      tone: "ok",
      text: `⚡ ${res.message}`,
    });
  };
  const [simulate, setSimulate] = useState(true);
  const [view, setView] = useState<"all" | "critical" | "high" | "suspicious" | "excluded">("all");

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const send = () =>
        fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...profileToBrand(profile), simulate }),
        });
      let r: Response;
      try {
        r = await send();
      } catch {
        // The connection dropped (the server restarted). A scan is read-only, so wait for it to come back and try once more.
        await new Promise((res) => setTimeout(res, 3000));
        r = await send();
      }
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Scan failed");
      setResult(j);
      setOpen(null);
      // Alert once per high-risk detection: remember which ones already alerted so a re-scan stays quiet.
      const alerted = new Set(readJson<string[]>(alertedKey, []));
      const fresh = pendingAlerts((j as ScanResult).findings, alerted);
      if (fresh.length) {
        writeJson(alertedKey, [...alerted, ...fresh.map((x) => x.id)]);
        setToast({ tone: "warn", text: `🚨 ${fresh.length} new high-risk detection${fresh.length === 1 ? "" : "s"}. Highest: ${fresh[0].name} (score ${fresh[0].score}).` });
      }
      try {
        localStorage.setItem(LAST_SCAN_KEY, JSON.stringify({ name: profile.name, result: j }));
      } catch {
        /* storage full or unavailable: the results still show, they just won't survive a refresh */
      }
    } catch (e) {
      setError(e instanceof Error && e.message === "Failed to fetch" ? "Lost connection to the CloneX server. Make sure it is still running (`npm run demo`), then scan again." : e instanceof Error ? e.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  };

  // The queue: highest risk first, and false positives or closed cases drop out unless the analyst asks for them.
  const inView = (f: Finding) => {
    const s = statusOf(cases, f.id);
    return statusView === "all" ? true : statusView === "open" ? isOpen(s) : s === statusView;
  };
  const queue = byPriority((result?.findings ?? []).filter(inView));
  const critical = queue.filter((f) => f.severity === "critical");
  const high = queue.filter((f) => f.severity === "high");
  const suspicious = queue.filter((f) => f.severity === "medium" || f.severity === "low");
  const count = (s: CaseStatus) => (result?.findings ?? []).filter((f) => statusOf(cases, f.id) === s).length;
  const openCount = (result?.findings ?? []).filter((f) => isOpen(statusOf(cases, f.id))).length;
  const excluded = result?.excludedItems ?? [];

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-6 sm:p-8">
        <NeuroBackdrop />
        <div className="relative flex flex-wrap items-center gap-x-8 gap-y-6">
          <div className="flex min-w-0 items-center gap-5">
            {profile.logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL
              <img src={profile.logoDataUrl} alt="" className="h-16 w-16 shrink-0 rounded-2xl border border-white/20 object-cover shadow-xl shadow-black/50 sm:h-20 sm:w-20" />
            ) : (
              <div aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 font-heading text-3xl font-semibold text-white sm:h-20 sm:w-20">
                {profile.name.trim().charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="eyebrow">Step 2 of 3 · Monitor &amp; triage</p>
              <h2 className="mt-1.5 break-words font-heading text-2xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">Protecting {profile.name}</h2>
              <ul className="mt-3 flex flex-wrap gap-2 text-xs text-white/75">
                {[
                  [profile.domains.length, "domain"],
                  [profile.apps.length, "app"],
                  [Object.values(profile.handles).flat().length, "official account"],
                ].map(([n, label]) => (
                  <li key={label} className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1">
                    <span className="font-semibold text-white">{n}</span> {label}
                    {n === 1 ? "" : "s"}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-3">
            <label className="text-xs text-white/75">
              Analyst name
              <input
                value={analyst}
                onChange={(e) => {
                  setAnalyst(e.target.value);
                  writeJson(ANALYST_KEY, e.target.value);
                }}
                placeholder="e.g. Joel"
                maxLength={40}
                className="mt-1 block w-36 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm text-white placeholder:text-white/40"
              />
            </label>
            <label className="flex cursor-pointer items-center gap-3 text-xs text-white/75">
              <input type="checkbox" role="switch" checked={simulate} onChange={(e) => setSimulate(e.target.checked)} className="peer sr-only" />
              <span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-white/15 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-emerald-400/80 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-white peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-black" />
              <span>
                Simulated Instagram &amp; X
                <span className="block text-[11px] text-white/50">demo data, clearly labelled</span>
              </span>
            </label>
            <button onClick={run} disabled={loading} className="btn-primary px-7 py-3.5 text-sm shadow-lg shadow-white/10 disabled:opacity-60">
              {loading ? "Scanning…" : result ? "↻ Re-scan" : <><Search aria-hidden="true" className="mr-2 inline h-4 w-4 -translate-y-px" />Scan for impersonators</>}
            </button>
          </div>
        </div>
      </div>

      {loading && <Progress sources={["App Store", "Google Play", "Bluesky", "Telegram", "Look-alike domains", ...(simulate ? ["Instagram (sim)", "X (sim)"] : [])]} />}
      {error && <p className="rounded-[10px] border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      {!result && !loading && (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 sm:p-10">
          <p className="text-center text-sm text-white/75">Press <b>Scan for impersonators</b> to search app stores and social platforms.</p>
          <ol className="mx-auto mt-6 grid max-w-3xl gap-3 sm:grid-cols-3">
            {[
              ["Search", "App Store, Google Play, Bluesky, Telegram and look-alike domains, all at once."],
              ["Score", "Each listing gets a 0 to 100 risk score with the reasons behind it."],
              ["Act", "Review the evidence, then send a takedown notice in one click."],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <span className="font-mono text-xs text-white/55">0{i + 1}</span>
                <p className="mt-1 text-sm font-semibold text-white">{t}</p>
                <p className="mt-1 text-xs leading-relaxed text-white/60">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {loading && !result && (
        <div aria-hidden="true" className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="shimmer h-24 rounded-2xl" />)}
          </div>
          <div className="shimmer h-40 rounded-2xl" />
        </div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Critical" value={critical.length} tone="text-red-300" tile="bg-red-500/15 text-red-300" glow="bg-red-500/40" Icon={ShieldAlert} sub="Act on these first" />
            <KpiCard label="High risk" value={high.length} tone="text-orange-300" tile="bg-orange-500/15 text-orange-300" glow="bg-orange-500/35" Icon={TriangleAlert} sub="Strong evidence, act soon" />
            <KpiCard label="Suspicious" value={suspicious.length} tone="text-amber-300" tile="bg-amber-500/15 text-amber-300" glow="bg-amber-400/30" Icon={Eye} sub="Worth a manual look" />
            <KpiCard label="Safe / verified" value={excluded.length} tone="text-emerald-300" tile="bg-emerald-500/15 text-emerald-300" glow="bg-emerald-500/30" Icon={ShieldCheck} sub="Your official assets" />
          </div>

          <RiskStrip critical={critical.length} high={high.length} suspicious={suspicious.length} safe={excluded.length} checked={result.stats.candidates} seconds={result.stats.ms / 1000} />

          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Where they appear" hint="Flagged listings by platform">
              <PlatformBars findings={result.findings} labels={PLATFORM} />
            </Panel>
            <Panel title="Source health" hint="What each platform returned">
              <SourceHealth sources={result.sources} />
            </Panel>
          </div>

          <div role="group" aria-label="Case status" className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/55">Queue</span>
            {(
              [
                ["open", "Open queue", openCount],
                ["under-review", "Under review", count("under-review")],
                ["confirmed", "Confirmed", count("confirmed")],
                ["false-positive", "False positives", count("false-positive")],
                ["closed", "Closed", count("closed")],
                ["all", "All cases", result.findings.length],
              ] as const
            ).map(([id, label, n]) => (
              <button
                key={id}
                type="button"
                aria-pressed={statusView === id}
                onClick={() => setStatusView(id)}
                className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${statusView === id ? "border-white bg-white text-black" : "border-white/15 bg-white/[0.04] text-white/75 hover:bg-white/10 hover:text-white"}`}
              >
                {label} <span className={statusView === id ? "text-black/60" : "text-white/50"}>{n}</span>
              </button>
            ))}
          </div>

          <div role="group" aria-label="Show findings" className="flex flex-wrap items-center gap-2">
            {(
              [
                ["all", "All", critical.length + high.length + suspicious.length + excluded.length],
                ["critical", "Critical", critical.length],
                ["high", "High risk", high.length],
                ["suspicious", "Suspicious", suspicious.length],
                ["excluded", "Safe", excluded.length],
              ] as const
            ).map(([id, label, n]) => (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                onClick={() => setView(id)}
                className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${view === id ? "border-white bg-white text-black" : "border-white/15 bg-white/[0.04] text-white/75 hover:bg-white/10 hover:text-white"}`}
              >
                {label} <span className={view === id ? "text-black/60" : "text-white/50"}>{n}</span>
              </button>
            ))}
          </div>

          <Group show={view === "all" || view === "critical"} dot="bg-red-400" title="Critical Threats" subtitle="Risk score 75 or more: a close look-alike plus evidence such as a copied logo, scam wording or an unofficial phone number." count={critical.length} tone="text-red-300">
            {critical.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/55">No critical threats in this scan.</p>}
            <Limited items={critical} render={(f) => (
              <ThreatCard key={f.id} f={f} tone="critical" officialLogo={profile.logoDataUrl} open={open === f.id} onToggle={() => setOpen(open === f.id ? null : f.id)} onReport={() => setReport(f)} pending={!!takedowns[f.id]} record={cases[f.id]} onMove={(to) => move(f.id, to)} imitates={imitatedAsset(f, profile)} />
            )} />
          </Group>

          <Group show={view === "all" || view === "high"} dot="bg-orange-400" title="High Risk" subtitle="Risk score 55 to 74: likely impersonation. Check the evidence, then report." count={high.length} tone="text-orange-300">
            {high.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/55">No high-risk listings in this scan.</p>}
            <Limited items={high} render={(f) => (
              <ThreatCard key={f.id} f={f} tone="high" officialLogo={profile.logoDataUrl} open={open === f.id} onToggle={() => setOpen(open === f.id ? null : f.id)} onReport={() => setReport(f)} pending={!!takedowns[f.id]} record={cases[f.id]} onMove={(to) => move(f.id, to)} imitates={imitatedAsset(f, profile)} />
            )} />
          </Group>

          <Group show={view === "all" || view === "suspicious"} dot="bg-amber-300" title="Suspicious Listings" subtitle="Risk score below 55: look-alike or misspelled names with weaker evidence. Review before acting." count={suspicious.length} tone="text-amber-300">
            {suspicious.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/55">No suspicious listings in this scan.</p>}
            <Limited items={suspicious} render={(f) => (
              <ThreatCard key={f.id} f={f} tone="suspicious" officialLogo={profile.logoDataUrl} open={open === f.id} onToggle={() => setOpen(open === f.id ? null : f.id)} onReport={() => setReport(f)} pending={!!takedowns[f.id]} record={cases[f.id]} onMove={(to) => move(f.id, to)} imitates={imitatedAsset(f, profile)} />
            )} />
          </Group>

          <Group show={view === "all" || view === "excluded"} dot="bg-emerald-400" title="Excluded Assets" subtitle="Matched to your brand profile, so never scored." count={excluded.length} tone="text-emerald-300">
            <SafeList items={excluded} />
          </Group>
        </>
      )}

      {report && (
        <TakedownModal
          f={report}
          brand={profile.name}
          platformLabel={PLATFORM[report.platform]}
          initialText={takedownReport(report, profile.name, imitatedAsset(report, profile))}
          onClose={() => setReport(null)}
          onDone={(res) => onTakedownDone(report, res)}
        />
      )}
      {toast && (
        <div role="status" className={`fixed bottom-6 left-1/2 z-[60] w-[min(92vw,32rem)] -translate-x-1/2 rounded-xl border px-4 py-3 text-sm shadow-2xl ${toast.tone === "ok" ? "border-emerald-500/40 bg-emerald-950 text-emerald-100" : "border-amber-500/40 bg-amber-950 text-amber-100"}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
