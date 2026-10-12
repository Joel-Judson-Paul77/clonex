import type { LucideIcon } from "lucide-react";
import type { Finding, Platform } from "@/lib/types";

/** Colours shared by the donut, the bars and their legends. */
export const SEV_COLOR = {
  critical: "#ef4444",
  high: "#f97316",
  suspicious: "#fbbf24",
} as const;
type Bucket = keyof typeof SEV_COLOR;

const bucketOf = (f: Finding): Bucket => (f.severity === "critical" ? "critical" : f.severity === "high" ? "high" : "suspicious");

/** Summary number with an icon tile, as in a dashboard stat card. */
export function KpiCard({ label, value, sub, tone, tile, Icon, className = "" }: {
  label: string; value: string | number; sub?: string; tone: string; tile: string; Icon: LucideIcon; className?: string;
}) {
  return (
    <div className={`glass-card flex items-start justify-between gap-3 rounded-2xl p-4 ${className}`}>
      <div className="min-w-0">
        <div className="text-xs font-medium text-white/60">{label}</div>
        <div className={`mt-1.5 text-3xl font-semibold tracking-tight ${tone}`}>{value}</div>
        {sub && <div className="mt-1 text-[11px] leading-snug text-white/55">{sub}</div>}
      </div>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tile}`}>
        <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
      </div>
    </div>
  );
}

export function Panel({ title, hint, children, className = "" }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`glass-card rounded-2xl p-5 ${className}`}>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {hint && <p className="text-xs text-white/55">{hint}</p>}
      </div>
      {children}
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
