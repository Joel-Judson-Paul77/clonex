"use client";

import { useEffect, useRef, useState } from "react";
import { ABUSE_DESKS, cleanEmail } from "@/lib/takedown";
import type { TakedownConfig, TakedownRequest, TakedownResponse } from "@/lib/takedown";
import type { Finding } from "@/lib/types";

const ANALYST_EMAIL_KEY = "clonex.analystEmail.v1";

function readStored(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeStored(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* storage unavailable: the boxes just start empty next time */
  }
}

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
  // Who gets a copy by email: the analyst (remembered in this browser) and the brand's security team (remembered per brand).
  const companyKey = `clonex.companyEmail.v1:${brand}`;
  const [analystEmail, setAnalystEmail] = useState(() => readStored(ANALYST_EMAIL_KEY));
  const [companyEmail, setCompanyEmail] = useState(() => readStored(companyKey));
  const badEmail = [analystEmail, companyEmail].some((e) => e.trim() && !cleanEmail(e));
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

  const canSend = authorised && text.trim().length >= 20 && !sending && !badEmail;

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
      analystEmail: analystEmail.trim() || undefined,
      companyEmail: companyEmail.trim() || undefined,
    };
    writeStored(ANALYST_EMAIL_KEY, analystEmail.trim());
    writeStored(companyKey, companyEmail.trim());
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim)] p-4" role="dialog" aria-modal="true" aria-labelledby="takedown-title">
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
          <p className="rounded-[10px] border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">Demo mode: nothing is sent to {desk.desk}. n8n emails the notice only to the addresses below, and only if they are on its approved list.</p>
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

        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ["Your email (analyst copy)", analystEmail, setAnalystEmail, "you@example.com"],
            [`${brand} security team email`, companyEmail, setCompanyEmail, "security@brand.com"],
          ] as const).map(([label, value, set, placeholder]) => (
            <label key={label} className="flex flex-col gap-1.5 text-xs font-medium text-white/75">
              {label}
              <input
                type="email"
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                maxLength={254}
                aria-invalid={!!value.trim() && !cleanEmail(value)}
                className="rounded-[10px] border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-white/70 focus:outline-none aria-[invalid=true]:border-red-500/60"
              />
            </label>
          ))}
        </div>
        {badEmail && <p className="text-xs text-red-300">Check the email addresses: each box takes one plain address.</p>}

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
