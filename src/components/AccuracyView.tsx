"use client";

import { NeuroBackdrop } from "@/components/ui/neuro-backdrop";
import { useEffect, useState } from "react";

interface Metrics { tp: number; fp: number; fn: number; tn: number; precision: number; recall: number; f1: number }
interface Report {
  total: number; fakes: number; legit: number;
  nameOnly: Metrics; endToEnd: Metrics;
  byCategory: Record<string, { fake: number; legit: number; nameHits: number; fullHits: number }>;
  falseAlarms: string[]; nameFalseAlarms: string[]; missed: string[];
}
interface Data { main: Report; heldOut: Report }

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** "about 3 in 4" style phrasing for a 0..1 rate */
function inN(x: number): string {
  const options: [number, number][] = [[1, 1], [9, 10], [4, 5], [3, 4], [2, 3], [3, 5], [1, 2], [2, 5], [1, 3], [1, 4]];
  const [a, b] = options.reduce((best, o) => (Math.abs(o[0] / o[1] - x) < Math.abs(best[0] / best[1] - x) ? o : best));
  return `about ${a} in ${b}`;
}

function BigKpi({ value, title, sub, tone }: { value: string; title: string; sub: string; tone: string }) {
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className={`text-5xl font-bold tracking-tight ${tone}`}>{value}</div>
      <div className="mt-2 text-base font-semibold text-white">{title}</div>
      <p className="mt-1 text-sm leading-relaxed text-white/60">{sub}</p>
    </div>
  );
}

function Gauge({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4">
      <div className={`text-2xl font-semibold ${tone}`}>{pct(value)}</div>
      <div className="mt-1 text-xs text-white/55">{label}</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded bg-white/10"><div className="h-full rounded bg-white/70" style={{ width: pct(value) }} /></div>
    </div>
  );
}

function Confusion({ m }: { m: Metrics }) {
  const cell = "rounded-lg border border-white/10 p-3 text-center";
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className={`${cell} bg-emerald-500/10`}><div className="text-xl font-semibold text-emerald-300">{m.tp}</div>fakes caught</div>
      <div className={`${cell} bg-red-500/10`}><div className="text-xl font-semibold text-red-300">{m.fn}</div>fakes missed</div>
      <div className={`${cell} bg-amber-500/10`}><div className="text-xl font-semibold text-amber-300">{m.fp}</div>false alarms</div>
      <div className={`${cell} bg-emerald-500/10`}><div className="text-xl font-semibold text-emerald-300">{m.tn}</div>legit names left alone</div>
    </div>
  );
}

function Block({ title, subtitle, r }: { title: string; subtitle: string; r: Report }) {
  return (
    <section className="space-y-4 rounded-2xl border border-white/10 p-5">
      <div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="text-xs text-white/55">{subtitle} · {r.total} cases ({r.fakes} fake, {r.legit} legitimate)</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Gauge label="Precision" value={r.endToEnd.precision} tone="text-emerald-300" />
        <Gauge label="Recall" value={r.endToEnd.recall} tone="text-sky-300" />
        <Gauge label="F1" value={r.endToEnd.f1} tone="text-white/80" />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Confusion m={r.endToEnd} />
        <div className="space-y-3 text-xs">
          <div>
            <div className="mb-1 font-semibold text-white/75">False alarms ({r.falseAlarms.length})</div>
            {r.falseAlarms.length ? <ul className="space-y-0.5 text-amber-300">{r.falseAlarms.map((x) => <li key={x}>• {x}</li>)}</ul> : <p className="text-white/55">None</p>}
          </div>
          <div>
            <div className="mb-1 font-semibold text-white/75">Missed fakes ({r.missed.length})</div>
            {r.missed.length ? <ul className="space-y-0.5 text-red-300">{r.missed.map((x) => <li key={x}>• {x}</li>)}</ul> : <p className="text-white/55">None</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function AccuracyView() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [logs, setLogs] = useState(false);
  useEffect(() => {
    fetch("/api/eval").then((r) => r.json()).then(setData).catch(() => setErr("Could not run the evaluation. Is the CloneX server running?"));
  }, []);

  const header = (
    <div className="glass-card rounded-3xl p-6 sm:p-8">
      <NeuroBackdrop />
      <div className="relative">
      <p className="eyebrow">Step 3 of 3</p>
      <h2 className="mt-2 text-2xl font-semibold leading-[1.15] sm:text-3xl bg-gradient-to-b from-white to-white/55 bg-clip-text text-transparent">Benchmark Model Performance &amp; Reliability Scorecard.</h2>
      <p className="mt-2 max-w-2xl text-sm text-white/60">How well CloneX tells fake look-alike names (character swaps, added words, spacing tricks) from innocent ones. Computed live from the real detection code.</p>
      </div>
    </div>
  );

  if (err) return <div className="space-y-6">{header}<p className="text-sm text-red-300">{err}</p></div>;
  if (!data) return <div className="space-y-6">{header}<p className="text-sm text-white/55">Running the labelled test set…</p></div>;
  const { main, heldOut } = data;
  const h = heldOut.endToEnd;

  return (
    <div className="space-y-6">
      {header}

      <div className="grid gap-4 md:grid-cols-3">
        <BigKpi
          value={`${pct(h.precision)}`}
          title="Precision"
          sub={`${Math.round(h.precision * 100)} of every 100 names it flagged were genuine fakes.`}
          tone="text-emerald-300"
        />
        <BigKpi
          value={`${pct(h.recall)}`}
          title="Recall"
          sub={`Caught ${inN(h.recall)} hidden look-alike names (${h.tp} of ${h.tp + h.fn}).`}
          tone="text-sky-300"
        />
        <BigKpi
          value="0%"
          title="False positives on your registered assets"
          sub="Accounts, apps and domains in your brand profile are excluded before scoring, by design."
          tone="text-white/80"
        />
      </div>
      <p className="text-xs text-white/55">
        Precision and recall come from a held-out test of {heldOut.total} names that was written before it was run and never tuned against. Real-world accuracy will differ.
      </p>

      <div className="glass-card rounded-2xl">
        <button onClick={() => setLogs(!logs)} aria-expanded={logs} className="flex w-full items-center justify-between p-5 text-left">
          <span>
            <span className="block text-base font-semibold text-white">🛠️ View Technical Evaluation Logs</span>
            <span className="block text-xs text-white/55">Both test sets, false alarms, misses, category breakdown and known limitations</span>
          </span>
          <span className="text-white/55">{logs ? "▲" : "▼"}</span>
        </button>
        {logs && (
          <div className="space-y-6 border-t border-white/10 p-5">
            <Block title="Held-out stress test" subtitle="Written before it was run and never tuned against" r={heldOut} />
            <Block title="Development set" subtitle="Used while building the detector, so treat as an upper bound" r={main} />

            <section className="rounded-2xl border border-white/10 p-5">
              <h3 className="mb-3 text-base font-semibold text-white">Category breakdown (development set)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-white/55"><tr><th className="pb-2 font-medium">Category</th><th className="pb-2 font-medium">Cases</th><th className="pb-2 font-medium">Name similarity alone flags</th><th className="pb-2 font-medium">Full pipeline flags</th></tr></thead>
                  <tbody className="text-white/75">
                    {Object.entries(main.byCategory).map(([k, v]) => (
                      <tr key={k} className="border-t border-white/10">
                        <td className="py-1.5 pr-3">{k}</td>
                        <td className="pr-3 font-mono">{v.fake + v.legit} <span className="text-white/55">({v.fake ? "fake" : "legit"})</span></td>
                        <td className="pr-3 font-mono">{v.nameHits}</td>
                        <td className="font-mono">{v.fullHits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-white/55">
                Name similarity alone over-flags ({main.nameOnly.fp} false alarms on legitimate names). The full pipeline needs a second piece of evidence (a logo copy, scam wording, an unofficial phone number, a typosquat or a spacing trick) before flagging.
              </p>
            </section>

            <section className="rounded-2xl border border-white/10 p-5 text-xs text-white/60">
              <h3 className="mb-2 text-base font-semibold text-white">Known limitations</h3>
              <ul className="list-inside list-disc space-y-1">
                <li>Names combining a typo <em>and</em> an added word (“Zomatto Official”) can fall below the similarity threshold.</li>
                <li>Typos that still contain the brand (“Paytmm”) with no other evidence are not flagged.</li>
                <li>Review sites that use words like “customer” or mention UPI can be over-flagged; “not affiliated” disclaimers are ignored.</li>
                <li>The fake names were generated from the families the brief lists, so recall on them partly reflects those assumptions.</li>
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
