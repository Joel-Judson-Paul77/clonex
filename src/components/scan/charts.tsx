import type { LucideIcon } from "lucide-react";
import type { Finding, Platform } from "@/lib/types";
import { CountUp } from "@/components/ui/count-up";

/** Colours shared by the donut, the bars and their legends. */
export const SEV_COLOR = {
  critical: "#ef4444",
  high: "#f97316",
  suspicious: "#fbbf24",
} as const;
type Bucket = keyof typeof SEV_COLOR;

const bucketOf = (f: Finding): Bucket => (f.severity === "critical" ? "critical" : f.severity === "high" ? "high" : "suspicious");

/** Summary number with an icon tile and a soft glow in the severity colour, as in a dashboard stat card. */
export function KpiCard({ label, value, sub, tone, tile, Icon, glow = "", className = "" }: {
  label: string; value: string | number; sub?: string; tone: string; tile: string; Icon: LucideIcon; glow?: string; className?: string;
}) {
  return (
    <div className={`glass-card group relative flex items-start justify-between gap-3 overflow-hidden rounded-2xl p-5 transition-colors hover:border-white/20 ${className}`}>
      <div aria-hidden="true" className={`pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full opacity-60 blur-2xl transition-opacity group-hover:opacity-100 ${glow}`} />
      <div className="relative min-w-0">
        <div className="text-xs font-medium uppercase tracking-wider text-white/60">{label}</div>
        <div className={`num mt-2 text-5xl sm:text-6xl ${tone}`}>
          {typeof value === "number" ? <CountUp to={value} digitEffect="slide" duration={1.4} /> : value}
        </div>
        {sub && <div className="mt-2.5 text-xs leading-snug text-white/60">{sub}</div>}
      </div>
      <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tile}`}>
        <Icon aria-hidden="true" className="h-5 w-5" />
      </div>
    </div>
  );
}

export function Panel({ title, hint, children, className = "" }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`glass-card flex h-full flex-col rounded-2xl p-5 sm:p-6 ${className}`}>
      <div className="mb-5">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-white/55">{hint}</p>}
      </div>
      <div className="flex flex-1 flex-col justify-center">{children}</div>
    </section>
  );
}

/** One-glance summary: how many listings were checked, how many were flagged, and the split by risk level. */
export function RiskStrip({ critical, high, suspicious, safe, checked, seconds }: {
  critical: number; high: number; suspicious: number; safe: number; checked: number; seconds: number;
}) {
  const flagged = critical + high + suspicious;
  const parts = [
    { key: "critical", n: critical, color: SEV_COLOR.critical, label: "Critical" },
    { key: "high", n: high, color: SEV_COLOR.high, label: "High risk" },
    { key: "suspicious", n: suspicious, color: SEV_COLOR.suspicious, label: "Suspicious" },
  ];
  return (
    <section className="glass-card rounded-2xl p-5 sm:p-6" aria-label="Scan summary">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-sm text-white/80">
          <span className="num text-3xl text-white"><CountUp to={flagged} digitEffect="slide" duration={1.4} /></span> flagged out of{" "}
          <span className="num text-xl text-white"><CountUp to={checked} digitEffect="slide" duration={1.6} /></span> listings checked
        </p>
        <p className="text-xs text-white/55">{safe} of your own assets recognised and skipped · scanned in {seconds.toFixed(1)}s</p>
      </div>
      <div
        className="mt-4 flex h-3 overflow-hidden rounded-full bg-white/[0.07]"
        role="img"
        aria-label={`${critical} critical, ${high} high risk, ${suspicious} suspicious`}
      >
        {flagged > 0 &&
          parts.map((p) => (p.n ? <span key={p.key} className="h-full" style={{ width: `${(p.n / flagged) * 100}%`, background: p.color }} /> : null))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/70">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.label} <span className="num text-base text-white">{p.n}</span>
            <span className="num text-xs text-white/45">{flagged ? `${Math.round((p.n / flagged) * 100)}%` : "0%"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Horizontal stacked bars: flagged findings per platform, split by severity. */
export function PlatformBars({ findings, labels }: { findings: Finding[]; labels: Record<Platform, string> }) {
  const rows = new Map<Platform, Record<Bucket, number>>();
  findings.forEach((f) => {
    const row = rows.get(f.platform) ?? { critical: 0, high: 0, suspicious: 0 };
    row[bucketOf(f)]++;
    rows.set(f.platform, row);
  });
  const list = [...rows.entries()]
    .map(([platform, n]) => ({ platform, n, total: n.critical + n.high + n.suspicious }))
    .sort((a, b) => b.total - a.total);
  const max = Math.max(1, ...list.map((r) => r.total));

  if (!list.length) return <p className="py-8 text-center text-sm text-white/55">Nothing was flagged on any platform.</p>;
  return (
    <ul className="space-y-3.5">
      {list.map(({ platform, n, total }) => (
        <li key={platform} className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 truncate text-white/75">{labels[platform]}</span>
          <div
            className="flex h-3 flex-1 overflow-hidden rounded-full bg-white/[0.07]"
            role="img"
            aria-label={`${labels[platform]}: ${n.critical} critical, ${n.high} high risk, ${n.suspicious} suspicious`}
          >
            {(Object.keys(SEV_COLOR) as Bucket[]).map((b) =>
              n[b] ? <span key={b} style={{ width: `${(n[b] / max) * 100}%`, background: SEV_COLOR[b] }} /> : null,
            )}
          </div>
          <span className="w-6 text-right font-semibold text-white">{total}</span>
        </li>
      ))}
    </ul>
  );
}
