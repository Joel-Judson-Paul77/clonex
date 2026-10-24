"use client";

import { useId } from "react";
import type { LucideIcon } from "lucide-react";
import { ExternalLink, FilePen, KeyRound, LayoutDashboard, Mail, Reply, Send, ShieldCheck, Workflow } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { NeuroBackdrop } from "@/components/ui/neuro-backdrop";

// Animated "how the n8n flow works" page. The hub-and-spoke diagram follows the 21st.dev integration card:
// the n8n workflow in the middle, what feeds it on the left and what it triggers on the right.

const WORKFLOW_URL = "https://github.com/Joel-Judson-Paul77/clonex/blob/main/n8n/clonex-takedown.workflow.json";

interface Node {
  id: string;
  label: string;
  sub: string;
  Icon: LucideIcon;
  x: number; // position in the 564 x 410 diagram
  y: number;
  /** path in the direction data flows */
  path: string;
  /** a step that is built but switched off for now */
  off?: boolean;
  delay: number;
}

const CENTER = { x: 282, y: 205 };

const NODES: Node[] = [
  { id: "app", label: "CloneX app", sub: "Review and confirm", Icon: LayoutDashboard, x: 84, y: 96, path: "M 118 96 C 190 96, 190 205, 248 205", delay: 0.1 },
  { id: "auth", label: "Password check", sub: "Wrong password: 403", Icon: KeyRound, x: 84, y: 314, path: "M 118 314 C 190 314, 190 205, 248 205", delay: 0.2 },
  { id: "gmail", label: "Gmail", sub: "Sends the notice", Icon: Mail, x: 480, y: 70, path: "M 316 205 C 390 205, 390 70, 446 70", delay: 0.3 },
  { id: "draft", label: "Gmail draft", sub: "When no email address", Icon: FilePen, x: 480, y: 205, path: "M 316 205 H 446", delay: 0.4 },
  { id: "telegram", label: "Telegram alert", sub: "Built, switched off", Icon: Send, x: 480, y: 340, path: "M 316 205 C 390 205, 390 340, 446 340", off: true, delay: 0.5 },
  { id: "reply", label: "Reply to CloneX", sub: "Only after email step", Icon: Reply, x: 282, y: 352, path: "M 282 240 V 318", delay: 0.6 },
];

function FlowLine({ d, gradientId, off, animate }: { d: string; gradientId: string; off?: boolean; animate: boolean }) {
  return (
    <>
      <path d={d} className="stroke-white/15" strokeWidth="1" fill="none" strokeDasharray={off ? "4 5" : undefined} />
      {!off && animate && (
        <motion.path
          d={d}
          stroke={`url(#${gradientId})`}
          strokeWidth="2"
          fill="none"
          strokeDasharray="40 160"
          initial={{ strokeDashoffset: 200 }}
          animate={{ strokeDashoffset: -200 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />
      )}
    </>
  );
}

function FlowDiagram() {
  const uid = useId();
  const reduce = useReducedMotion();
  const gradientId = `${uid}-flow`;
  return (
    <div
      className="relative aspect-[564/410] w-full"
      role="img"
      aria-label="Diagram: the CloneX app and a password check feed the n8n workflow, which sends a Gmail message or saves a draft, can alert Telegram (currently off) and replies to CloneX."
    >
      <svg className="pointer-events-none absolute inset-0 h-full w-full text-white" viewBox="0 0 564 410" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="564" y2="0">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="currentColor" stopOpacity="0.85" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        {NODES.map((n) => (
          <FlowLine key={n.id} d={n.path} gradientId={gradientId} off={n.off} animate={!reduce} />
        ))}
      </svg>

      {/* centre: the n8n workflow */}
      <div
        className="absolute z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
        style={{ left: `${(CENTER.x / 564) * 100}%`, top: `${(CENTER.y / 410) * 100}%` }}
      >
        <div className="relative flex items-center justify-center rounded-xl border border-white/20 bg-black p-1.5 shadow-xl sm:rounded-2xl sm:p-2.5">
          <div className="rounded-lg border border-white/10 p-1.5 sm:rounded-xl sm:p-3">
            <Workflow aria-hidden="true" className="size-5 text-white sm:size-9" />
          </div>
          {!reduce && (
            <motion.div
              className="absolute inset-0 rounded-xl border-2 border-white/20 sm:rounded-2xl"
              animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0, 0.35] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
          )}
        </div>
        <span className="text-[10px] font-semibold text-white sm:text-xs">n8n workflow</span>
      </div>

      {NODES.map((n) => (
        <motion.div
          key={n.id}
          initial={reduce ? false : { opacity: 0, scale: 0.85 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: n.delay }}
          style={{ left: `${(n.x / 564) * 100}%`, top: `${(n.y / 410) * 100}%` }}
          className="absolute z-10 flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-center sm:w-32"
        >
          <div className={`flex size-8 items-center justify-center rounded-lg border bg-black shadow-sm sm:size-12 sm:rounded-xl ${n.off ? "border-dashed border-white/25 text-white/45" : "border-white/20 text-white"}`}>
            <n.Icon aria-hidden="true" className="size-4 sm:size-6" />
          </div>
          <span className={`text-[10px] font-semibold leading-tight sm:text-xs ${n.off ? "text-white/55" : "text-white"}`}>{n.label}</span>
          <span className="hidden text-[10px] leading-tight text-white/55 sm:block">{n.sub}</span>
        </motion.div>
      ))}
    </div>
  );
}

const STEPS = [
  { t: "You review the notice", d: "Initiate Takedown opens a dialog with the threat summary, the abuse desk and an editable notice. Nothing moves until you tick \"I am authorised to act for the brand\" and press Dispatch." },
  { t: "CloneX checks and signs the request", d: "The server validates every field, picks the recipient itself (the browser can never choose it), and adds a shared password header before calling n8n." },
  { t: "n8n checks the password", d: "The webhook accepts only requests that carry the password. Without it, or with a wrong one, n8n answers 403 and nothing runs." },
  { t: "n8n prepares the notice", d: "A code step builds the subject line, marks demo notices clearly, and adds the platform's report-form link when the platform has no abuse email." },
  { t: "Email or draft", d: "If there is a recipient, Gmail sends the notice. If not (for example web-form-only platforms), it is saved as a Gmail draft for a person to review and send." },
  { t: "n8n replies, CloneX updates", d: "n8n answers only after the email step succeeds. CloneX then shows the success message and marks the card TAKEDOWN PENDING. A failure shows an error instead; it never claims a notice was sent when it was not." },
];

const MODES = [
  { name: "Demo mode", tag: "Default", d: "Every notice goes to one fixed test inbox, set inside n8n. Nothing ever reaches a platform. Simulated Instagram and X items can be dispatched here.", tone: "border-sky-500/30 bg-sky-500/[0.06]" },
  { name: "Dry run", tag: "No n8n connected", d: "The button still works but the dialog says nothing was sent, and no status changes. This is what a fresh install does.", tone: "border-amber-500/30 bg-amber-500/[0.06]" },
  { name: "Live mode", tag: "Off", d: "Needs an explicit setting and verified abuse-desk contacts. Notices would go to the platform's abuse desk. Simulated items are refused.", tone: "border-white/15 bg-white/[0.03]" },
];

const GUARDS = [
  "The recipient is fixed inside n8n, so a forged request cannot make Gmail email someone else.",
  "A shared password protects the webhook; the app stores it as a secret.",
  "Eight requests a minute per visitor, size limits and field checks on the takedown route.",
  "The notice is a draft: its good-faith statement must be confirmed by the rights-holder.",
];

export default function AutomationView() {
  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-6 sm:p-8">
        <NeuroBackdrop />
        <div className="relative">
          <p className="eyebrow">Bonus · Automation</p>
          <h2 className="mt-2 bg-gradient-to-b from-white to-white/55 bg-clip-text text-2xl font-semibold leading-[1.15] text-transparent sm:text-3xl">
            From a flagged listing to a takedown notice, with n8n doing the legwork.
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-white/60">
            CloneX finds and explains the impersonation. When an analyst decides to act, an n8n workflow carries out the steps: it checks the request, writes the email, sends it or saves a draft for review, and tells CloneX what happened.
          </p>
          <a href={WORKFLOW_URL} target="_blank" rel="noreferrer" className="btn-ghost mt-5 inline-flex items-center gap-2 px-4 py-2 text-xs">
            View the workflow file <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        </div>
      </div>

      <section className="glass-card overflow-hidden rounded-2xl">
        <div className="relative p-4 sm:p-8">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.12]"
            style={{ backgroundImage: "radial-gradient(circle, rgb(var(--ink)) 1px, transparent 1px)", backgroundSize: "28px 28px" }}
          />
          <div className="relative mx-auto max-w-2xl">
            <FlowDiagram />
          </div>
        </div>
        <div className="border-t border-white/10 p-5 sm:p-6">
          <h3 className="text-lg font-semibold text-white">The workflow at a glance</h3>
          <p className="mt-1 text-sm text-white/60">Left: what feeds the workflow. Right: what it triggers. Bottom: the answer it sends back. The Telegram alert is built but switched off until a bot is connected.</p>
        </div>
      </section>

      <section aria-labelledby="steps-title" className="glass-card rounded-2xl p-5 sm:p-8">
        <h3 id="steps-title" className="text-lg font-semibold text-white">What happens when you press Initiate Takedown</h3>
        <ol className="mt-5 grid gap-3 md:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.t} className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 font-mono text-sm font-semibold text-white">{i + 1}</span>
              <div>
                <p className="text-sm font-semibold text-white">{s.t}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/65">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="modes-title" className="space-y-3">
        <h3 id="modes-title" className="text-lg font-semibold text-white">Three modes, so a demo is never a real report</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {MODES.map((m) => (
            <div key={m.name} className={`rounded-2xl border p-5 ${m.tone}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-base font-semibold text-white">{m.name}</p>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">{m.tag}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/65">{m.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="guards-title" className="glass-card rounded-2xl p-5 sm:p-8">
        <h3 id="guards-title" className="flex items-center gap-2 text-lg font-semibold text-white">
          <ShieldCheck aria-hidden="true" className="size-5 text-emerald-300" /> Safeguards
        </h3>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {GUARDS.map((g) => (
            <li key={g} className="flex gap-3 text-sm leading-relaxed text-white/70">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-300" />
              {g}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
