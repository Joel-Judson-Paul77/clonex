"use client";

import { useEffect, useRef, useState } from "react";
import { ABUSE_DESKS } from "@/lib/takedown";
import type { TakedownConfig, TakedownRequest, TakedownResponse } from "@/lib/takedown";
import type { Finding } from "@/lib/types";

/**
 * Confirmation dialog for "Initiate Takedown". The notice text is editable. Nothing is sent until the user
 * ticks the authorisation box and presses Dispatch; the server decides where it actually goes (demo vs live).
 */
export default function TakedownModal({ f, brand, platformLabel, initialText, onClose, onDone }: {
  f: Finding;
  brand: string;
  platformLabel: string;
  initialText: string;
  onClose: () => void;
  onDone: (res: TakedownResponse) => void;
}) {
  const [text, setText] = useState(initialText);
  const [authorised, setAuthorised] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [cfg, setCfg] = useState<TakedownConfig | null>(null);
  const [copied, setCopied] = useState(false);
  const desk = ABUSE_DESKS[f.platform];
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !sending && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, sending]);

  useEffect(() => {
    let live = true;
    fetch("/api/trigger-takedown")
      .then((r) => r.json())
      .then((c: TakedownConfig) => live && setCfg(c))
      .catch(() => live && setCfg(null));
    return () => { live = false; };
  }, []);

  const canSend = authorised && text.trim().length >= 20 && !sending;

  const dispatch = async () => {
    setSending(true);
    setError("");
    const body: TakedownRequest = {
      brandName: brand,
      threatTitle: f.name,
      platform: f.platform,
      riskScore: f.score,
      severity: f.severity,
      evidenceUrl: f.url && /^https?:\/\//i.test(f.url) ? f.url : undefined,
      detectedArtifact: f.handle,
      findingSource: f.source,
      findingId: f.id,
      noticeText: text,
      authorised: true,
    };
    try {
      const r = await fetch("/api/trigger-takedown", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok && !j.status) throw new Error(j.error ?? "The takedown request failed");
      if (j.status === "failed") throw new Error(j.message);
      onDone(j as TakedownResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The takedown request failed");
      setSending(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `takedown-${(f.handle ?? f.name).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="takedown-title">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col gap-4 overflow-auto rounded-2xl border border-white/15 bg-black p-6 [&>*]:shrink-0">
        <div>
          <h3 id="takedown-title" className="text-lg font-semibold text-white">Initiate takedown</h3>
          <p className="text-xs text-white/55">Review the notice, then dispatch it through the CloneX n8n workflow.</p>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-[10px] border border-white/10 bg-white/[0.04] p-4 text-sm">
          <div><dt className="text-[11px] uppercase tracking-wide text-white/50">Brand</dt><dd className="text-white">{brand}</dd></div>
          <div><dt className="text-[11px] uppercase tracking-wide text-white/50">Platform</dt><dd className="text-white">{platformLabel}</dd></div>
          <div className="col-span-2"><dt className="text-[11px] uppercase tracking-wide text-white/50">Impersonating listing</dt><dd className="truncate text-white">{f.name}{f.handle ? <span className="font-mono text-white/60"> · {f.handle}</span> : null}</dd></div>
          <div><dt className="text-[11px] uppercase tracking-wide text-white/50">Risk score</dt><dd className="text-white">{f.score}/100 <span className="text-white/55">({f.severity})</span></dd></div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-white/50">Abuse destination</dt>
            <dd className="text-white">
              {desk.desk}
              {desk.email && <span className="block font-mono text-xs text-white/60">{desk.email}</span>}
              {desk.formUrl && <a href={desk.formUrl} target="_blank" rel="noreferrer" className="block text-xs text-white/70 hover:underline">Open the report form ↗</a>}
            </dd>
          </div>
        </dl>

        {f.source === "simulated" && (
          <p className="rounded-[10px] border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-xs text-violet-200">This is a simulated demo item, not a real account. It can only be dispatched in demo mode.</p>
        )}
        {cfg?.mode === "demo" && (
          <p className="rounded-[10px] border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">Demo mode: the notice goes to your own test inbox through n8n, not to {desk.desk}.</p>
        )}
        {cfg && !cfg.connected && (
          <p className="rounded-[10px] border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">n8n isn&apos;t connected yet (no webhook URL is set), so dispatching will be a dry run and nothing will be sent.</p>
        )}
        {desk.formUrl && !desk.email && (
          <p className="text-xs text-white/55">{desk.desk} takes reports through a web form, not email. n8n sends the notice to your security team with the form link, ready to paste.</p>
        )}

        <label className="flex min-h-0 flex-1 flex-col gap-1.5 text-xs font-medium text-white/75">
          Notice text (editable)
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            maxLength={6000}
            className="min-h-[12rem] flex-1 resize-y rounded-[10px] border border-white/15 bg-white/[0.04] p-3 font-mono text-xs leading-relaxed text-white/85 focus:border-white/70 focus:outline-none focus:ring-2 focus:ring-white/30"
          />
        </label>

        <label className="flex items-start gap-2.5 text-xs text-white/75">
          <input type="checkbox" checked={authorised} onChange={(e) => setAuthorised(e.target.checked)} className="mt-0.5 accent-white" />
          <span>I am authorised to act for {brand}, and I have checked that this listing really impersonates it. The notice is a draft: its good-faith statement must be confirmed by the rights-holder.</span>
        </label>

        {error && <p role="alert" className="rounded-[10px] border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button ref={closeRef} onClick={onClose} disabled={sending} className="btn-ghost px-4 py-2 text-xs disabled:opacity-50">Cancel</button>
          <button onClick={download} className="btn-ghost px-4 py-2 text-xs">Download .txt</button>
          <button onClick={copy} className="btn-ghost px-4 py-2 text-xs">{copied ? "Copied ✓" : "Copy"}</button>
          <button onClick={dispatch} disabled={!canSend} className="btn-primary px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50">
            {sending ? "Dispatching…" : "Dispatch Takedown Notice ➔"}
          </button>
        </div>
      </div>
    </div>
  );
}
