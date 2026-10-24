"use client";

import { STATUS_LABEL, TRANSITIONS, type CaseRecord, type CaseStatus } from "@/lib/cases";

const CHIP: Record<CaseStatus, string> = {
  new: "bg-sky-500/15 text-sky-300",
  "under-review": "bg-violet-500/15 text-violet-300",
  confirmed: "bg-red-500/15 text-red-300",
  "false-positive": "bg-white/10 text-white/60",
  closed: "bg-emerald-500/15 text-emerald-300",
};

const ACTION: Record<CaseStatus, { label: string; cls: string }> = {
  new: { label: "Reopen as new", cls: "btn-ghost" },
  "under-review": { label: "Start review", cls: "btn-ghost" },
  confirmed: { label: "Confirm impersonation", cls: "bg-red-600 text-always-white hover:bg-red-500" },
  "false-positive": { label: "Mark false positive", cls: "btn-ghost" },
  closed: { label: "Close case", cls: "bg-emerald-600 text-always-white hover:bg-emerald-500" },
};

export function StatusChip({ status }: { status: CaseStatus }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CHIP[status]}`}>{STATUS_LABEL[status]}</span>;
}

/** One button per move the analyst may make from the current status. */
export function CaseActions({ status, onMove }: { status: CaseStatus; onMove: (to: CaseStatus) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {TRANSITIONS[status].map((to) => (
        <button key={to} type="button" onClick={() => onMove(to)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${ACTION[to].cls}`}>
          {status !== "new" && (status === "closed" || status === "false-positive") && to === "under-review" ? "Reopen" : ACTION[to].label}
        </button>
      ))}
    </div>
  );
}

export function CaseHistory({ record }: { record?: CaseRecord }) {
  const events = record?.history ?? [];
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/55">Case history</h4>
      {events.length === 0 ? (
        <p className="text-xs text-white/55">No analyst action yet. This detection is new.</p>
      ) : (
        <ol className="space-y-2 border-l border-white/15 pl-4">
          {[...events].reverse().map((e, i) => (
            <li key={i} className="text-xs">
              <span className="text-white/90">
                {e.from === e.to ? <b>{e.note}</b> : <><b>{STATUS_LABEL[e.from ?? "new"]}</b> → <b>{STATUS_LABEL[e.to]}</b></>}
              </span>
              <span className="block text-[11px] text-white/55">
                {e.by} · {new Date(e.at).toLocaleString()}
                {e.from !== e.to && e.note ? ` · ${e.note}` : ""}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
