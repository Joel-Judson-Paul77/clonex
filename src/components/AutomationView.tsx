"use client";

import { useId } from "react";
import type { LucideIcon } from "lucide-react";
import { ExternalLink, FilePen, LayoutDashboard, Mail, Reply, ShieldCheck, Workflow } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { NeuroBackdrop } from "@/components/ui/neuro-backdrop";

// Animated "how the n8n flow works" page. The hub-and-spoke diagram follows the 21st.dev integration card:
// the n8n workflow in the middle, what feeds it on the left and what it triggers on the right.

const WORKFLOW_URL = "https://github.com/Joel-Judson-Paul77/clonex/blob/main/n8n/clonex-takedown-email.workflow.json";

interface Node {
  id: string;
  label: string;
  sub: string;
  Icon: LucideIcon;
  x: number; // position in the 564 x 410 diagram
  y: number;
  /** path in the direction data flows */
  path: string;
  delay: number;
}

const CENTER = { x: 282, y: 205 };

const NODES: Node[] = [
  { id: "app", label: "CloneX app", sub: "Confirmed case + the two email addresses", Icon: LayoutDashboard, x: 84, y: 96, path: "M 118 96 C 190 96, 190 205, 248 205", delay: 0.1 },
  { id: "approved", label: "Approved list", sub: "Only listed addresses get email", Icon: ShieldCheck, x: 84, y: 314, path: "M 118 314 C 190 314, 190 205, 248 205", delay: 0.2 },
  { id: "gmail", label: "Gmail", sub: "Emails analyst + brand security team", Icon: Mail, x: 480, y: 100, path: "M 316 205 C 390 205, 390 100, 446 100", delay: 0.3 },
  { id: "logged", label: "Logged only", sub: "When no address is approved", Icon: FilePen, x: 480, y: 310, path: "M 316 205 C 390 205, 390 310, 446 310", delay: 0.4 },
  { id: "reply", label: "Reply to CloneX", sub: "Who was emailed, who was blocked", Icon: Reply, x: 282, y: 352, path: "M 282 240 V 318", delay: 0.5 },
];

function FlowLine({ d, gradientId, animate }: { d: string; gradientId: string; animate: boolean }) {
  return (
    <>
      <path d={d} className="stroke-white/15" strokeWidth="1" fill="none" />
      {animate && (
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
      aria-label="Diagram: the CloneX app and an approved-address list feed the n8n workflow, which emails the analyst and the brand security team through Gmail, or only logs the request when no address is approved, and replies to CloneX with who was emailed."
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
          <FlowLine key={n.id} d={n.path} gradientId={gradientId} animate={!reduce} />
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
          <div className="flex size-8 items-center justify-center rounded-lg border border-white/20 bg-black text-white shadow-sm sm:size-12 sm:rounded-xl">
            <n.Icon aria-hidden="true" className="size-4 sm:size-6" />
          </div>
          <span className="text-[10px] font-semibold leading-tight text-white sm:text-xs">{n.label}</span>
          <span className="hidden text-[10px] leading-tight text-white/55 sm:block">{n.sub}</span>
        </motion.div>
      ))}
    </div>
  );
}

const STEPS = [
  { t: "You review the notice", d: "Initiate Takedown appears only on a confirmed case and opens a dialog with the threat summary, the abuse desk, an editable notice and two optional email boxes: yours (analyst copy) and the brand's security team. Nothing moves until you tick \"I am authorised to act for the brand\" and press Dispatch." },
  { t: "CloneX checks the request", d: "The server validates every field and each email address (one plain address per box), decides the mode itself (demo or live, never the browser), and rate-limits the route." },
  { t: "n8n prepares the notice", d: "A code step builds the subject line, marks demo notices clearly, and adds the platform's report-form link when the platform has no abuse email." },
  { t: "n8n checks the approved list", d: "Only addresses on n8n's own approved list are ever emailed. Any other address is blocked, and CloneX is told which ones." },
  { t: "Gmail sends it, or it is only logged", d: "If at least one address is approved, Gmail sends the notice to the analyst and the brand's security team. If none is, the request is logged and no email goes out." },
  { t: "n8n replies, CloneX updates", d: "n8n answers with who was emailed and who was blocked. CloneX shows exactly that, adds a line to the case history, and never claims an email went out when it did not." },
];

const MODES = [
  { name: "Demo mode", tag: "Default", d: "Nothing ever reaches a platform. Emails go only to the approved addresses: the analyst and the brand's security team. Simulated Instagram and X items can be dispatched here.", tone: "border-sky-500/30 bg-sky-500/[0.06]" },
  { name: "Dry run", tag: "No n8n connected", d: "The button still works but the dialog says nothing was sent, and no status changes. This is what a fresh install does.", tone: "border-amber-500/30 bg-amber-500/[0.06]" },
  { name: "Live mode", tag: "Off", d: "Needs an explicit setting and verified abuse-desk contacts. Notices would also go to the platform's abuse desk. Simulated items are refused.", tone: "border-white/15 bg-white/[0.03]" },
];

const GUARDS = [
  "Only addresses on n8n's approved list are ever emailed, so the public site cannot make Gmail send to a stranger.",
  "Each email box takes one plain address; lists, display names and header tricks are rejected before n8n is called.",
  "In this demo the webhook has no password check; the approved list is the safeguard. A shared-secret header check is the next step before any live use.",
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
            CloneX finds and explains the impersonation. When an analyst decides to act, an n8n workflow carries out the steps: it prepares the notice, emails the analyst and the brand&apos;s security team (only addresses on its approved list), and tells CloneX exactly who was emailed.
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
          <p className="mt-1 text-sm text-white/60">Left: what feeds the workflow. Right: what it triggers. Bottom: the answer it sends back, naming who was emailed and who was blocked.</p>
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
