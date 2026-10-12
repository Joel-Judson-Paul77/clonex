"use client";

import { createContext, memo, useContext, useId, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { BeamField } from "@/components/ui/beam-field";
import { FlowButton } from "@/components/ui/flow-button";

export type Kind = "bluesky" | "telegram" | "youtube" | "app-store" | "play-store" | "domain" | "phone";
export type Check = { state: "idle" | "checking" | "ok" | "bad"; message?: string };
export type Checks = Record<string, Check>;
/**
 * undefined = field was not auto-filled. "verified" = confirmed by its own check, "pending" = auto-filled from a
 * live store listing but its own check has not passed yet, "preset" = from the built-in list, not yet confirmed.
 */
export type AutoState = "verified" | "pending" | "preset" | undefined;

export const INPUT =
  "w-full rounded-[10px] border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:border-white/70 focus:outline-none focus:ring-2 focus:ring-white/30";

/** "verifiedText" says what the check actually was, e.g. a store lookup or a DNS lookup. */
export function AutoBadge({ state, verifiedText = "✓ Confirmed on the App Store / Google Play" }: { state: AutoState; verifiedText?: string }) {
  if (!state) return null;
  const amber = "mt-1 block w-fit rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300";
  if (state === "pending") return <span className={amber}>Auto-filled from the store listing — checking…</span>;
  if (state === "preset") return <span className={amber}>From built-in preset — not yet confirmed</span>;
  return <span className="mt-1 block w-fit rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">{verifiedText}</span>;
}

/** Ids of the current Field's label and hint, so the inputs inside it are announced with their label. */
const FieldIds = createContext<{ labelId?: string; hintId?: string }>({});
export function useFieldA11y() {
  const { labelId, hintId } = useContext(FieldIds);
  return { "aria-labelledby": labelId, "aria-describedby": hintId };
}

export function Field({ label, hint, badge, verifiedText, children }: { label: string; hint?: string; badge?: AutoState; verifiedText?: string; children: ReactNode }) {
  const id = useId();
  const ids = { labelId: `${id}-label`, hintId: hint ? `${id}-hint` : undefined };
  return (
    <div className="space-y-2">
      <div>
        <h3 id={ids.labelId} className="text-sm font-semibold text-white">{label}</h3>
        {hint && <p id={ids.hintId} className="text-xs text-white/55">{hint}</p>}
        <AutoBadge state={badge} verifiedText={verifiedText} />
      </div>
      <FieldIds.Provider value={ids}>{children}</FieldIds.Provider>
    </div>
  );
}

/** Collapsible card. Its open/closed state lives here, so toggling one card never touches the others. */
export function CardShell({ step, title, subtitle, summary, children }: { step: string; title: string; subtitle: string; summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section data-open={open} className="glass-card self-start rounded-2xl">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white/80">{step}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-white">{title}</span>
          <span className="block truncate text-xs text-white/55">{open ? subtitle : summary}</span>
        </span>
        <span className="text-white/55" aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="space-y-5 border-t border-white/10 p-4">{children}</div>}
    </section>
  );
}

/** A text field + "Add & verify" button, followed by the added values as status pills. */
export function AssetList({
  kind, values, placeholder, checks, onAdd, onRemove, onCheck,
}: {
  kind: Kind;
  values: string[];
  placeholder: string;
  checks: Checks;
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  onCheck: (kind: Kind, v: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const a11y = useFieldA11y();
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (values.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setNotice(`"${v}" is already in the list`);
      return;
    }
    setNotice("");
    onAdd(v);
    setDraft("");
    onCheck(kind, v);
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <BeamField className="min-w-0 flex-1">
          <input
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setNotice(""); }}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
            placeholder={placeholder}
            {...a11y}
            className={INPUT}
          />
        </BeamField>
        <FlowButton size="sm" onClick={add} className="shrink-0 self-start">
          Add &amp; verify
        </FlowButton>
      </div>
      {notice && <p role="status" className="text-xs text-amber-300">{notice}</p>}
      {values.map((v) => (
        <ValueRow key={v} kind={kind} value={v} check={checks[`${kind}:${v}`]} onCheck={onCheck} onRemove={onRemove} />
      ))}
    </div>
  );
}

/** One saved value with its live verification status (dot, message, Verify / remove). */
export function ValueRow({ kind, value, check, onCheck, onRemove }: {
  kind: Kind; value: string; check?: Check; onCheck: (kind: Kind, v: string) => void; onRemove: (v: string) => void;
}) {
  const c = check ?? { state: "idle" as const };
  return (
    <div className="flex items-center gap-2 rounded-[10px] border border-white/10 bg-black/40 px-3 py-2 text-sm">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          c.state === "ok" ? "bg-emerald-400" : c.state === "bad" ? "bg-amber-400" : c.state === "checking" ? "animate-pulse bg-sky-400" : "bg-zinc-600"
        }`}
      />
      <span className="min-w-0 truncate font-mono text-white/90">{value}</span>
      <span className={`min-w-0 flex-1 truncate text-xs ${c.state === "ok" ? "text-emerald-400" : c.state === "bad" ? "text-amber-400" : "text-white/55"}`} title={c.message}>
        {c.state === "checking" ? "Verifying…" : c.message ?? "Saved"}
      </span>
      {c.state !== "checking" && c.state !== "ok" && (
        <button type="button" onClick={() => onCheck(kind, value)} className="-my-1 rounded px-1.5 py-1 text-xs text-white/70 hover:underline">
          Verify
        </button>
      )}
      <button type="button" onClick={() => onRemove(value)} className="-my-1 rounded px-1.5 py-1 text-xs text-white/55 hover:text-red-400" aria-label={`Remove ${value}`}>
        ✕
      </button>
    </div>
  );
}

/**
 * A field holding ONE main value (iOS ID, Android package, primary domain). The input shows the current
 * value, so auto-filled data is visible and editable right here. The button re-verifies it, or replaces it
 * if the text was changed; clearing the box and pressing it removes the value. Mount it with
 * key={value} so the box refreshes whenever the value is changed from outside (e.g. an auto-fill).
 */
export function SingleValueField({
  kind, values, placeholder, checks, buttonLabel = "Set & verify", onSet, onRemove, onCheck,
}: {
  kind: Kind;
  values: string[];
  placeholder: string;
  checks: Checks;
  buttonLabel?: string;
  onSet: (v: string) => void;
  onRemove: (v: string) => void;
  onCheck: (kind: Kind, v: string) => void;
}) {
  const current = values[0];
  const [draft, setDraft] = useState(current ?? "");
  const a11y = useFieldA11y();
  const submit = () => {
    const v = draft.trim();
    if (!v) return current ? onRemove(current) : undefined;
    if (v === current) onCheck(kind, v);
    else onSet(v);
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <BeamField className="min-w-0 flex-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submit())}
            placeholder={placeholder}
            {...a11y}
            className={INPUT}
          />
        </BeamField>
        <FlowButton size="sm" onClick={submit} className="shrink-0 self-start">
          {buttonLabel}
        </FlowButton>
      </div>
      {values.map((v) => (
        <ValueRow key={v} kind={kind} value={v} check={checks[`${kind}:${v}`]} onCheck={onCheck} onRemove={onRemove} />
      ))}
    </div>
  );
}

/**
 * React.memo for a card that receives the whole `checks` map. Verification results for OTHER kinds of
 * asset arrive constantly; this makes a card re-render only when its own props, or the check results of
 * the asset kinds it actually displays, change.
 */
export function memoWithChecks<P extends { checks: Checks }>(Component: ComponentType<P>, kinds: Kind[]) {
  const mine = (k: string) => kinds.includes(k.split(":")[0] as Kind);
  return memo(Component, (a, b) => {
    for (const key of Object.keys(a) as (keyof P)[]) {
      if (key !== "checks" && !Object.is(a[key], b[key])) return false;
    }
    const ka = Object.keys(a.checks).filter(mine);
    const kb = Object.keys(b.checks).filter(mine);
    return ka.length === kb.length && ka.every((k) => a.checks[k] === b.checks[k]);
  });
}
