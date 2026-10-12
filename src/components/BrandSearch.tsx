"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import { BeamField } from "@/components/ui/beam-field";
import type { BrandCard, LookupResponse } from "@/lib/brand-types";
import { matchPresets } from "@/lib/brand-presets";

function Platforms({ c }: { c: BrandCard }) {
  const chip = "rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide";
  return (
    <span className="flex flex-wrap gap-1">
      {c.ios && <span className={`${chip} bg-sky-500/15 text-sky-300`}>iOS</span>}
      {c.android && <span className={`${chip} bg-emerald-500/15 text-emerald-300`}>Android</span>}
      {c.domain && <span className={`${chip} bg-violet-500/15 text-violet-300`}>Web</span>}
    </span>
  );
}

function Icon({ c }: { c: BrandCard }) {
  if (c.iconUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- remote store icon, size unknown
    return <img src={c.iconUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl border border-white/15 object-cover" />;
  }
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-base font-bold text-white/75" aria-hidden="true">
      {c.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Dedupe by store identity so a preset and its live twin are not listed twice. */
function mergeCards(live: BrandCard[], presets: BrandCard[]): BrandCard[] {
  const seen = new Set<string>();
  const out: BrandCard[] = [];
  for (const c of [...live, ...presets]) {
    const ids = [c.ios?.appId, c.android?.pkg].filter(Boolean) as string[];
    if (ids.length && ids.some((i) => seen.has(i))) continue;
    ids.forEach((i) => seen.add(i));
    out.push(c);
  }
  return out;
}

export default function BrandSearch({ onPick }: { onPick: (c: BrandCard) => void }) {
  const [q, setQ] = useState("");
  const [cards, setCards] = useState<BrandCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Instant presets while typing, then debounced live store lookup (older requests are cancelled)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setCards([]);
      setLoading(false);
      setNote("");
      return;
    }
    setCards(matchPresets(term));
    setLoading(true);
    setNote("");
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/lookup-brand?q=${encodeURIComponent(term)}`, { signal: ctl.signal });
        const j: LookupResponse = await r.json();
        setCards(mergeCards(j.cards, matchPresets(term)));
        setNote(j.note ?? (j.live.ios || j.live.android ? "" : "Stores unreachable — showing built-in presets"));
      } catch (e) {
        if ((e as Error).name !== "AbortError") setNote("Live lookup failed — showing built-in presets");
      } finally {
        if (!ctl.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const pick = (c: BrandCard) => {
    setOpen(false);
    setQ("");
    onPick(c);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, cards.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && open && cards[active]) { e.preventDefault(); pick(cards[active]); }
    else if (e.key === "Escape") setOpen(false);
  };

  const show = open && q.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative">
      <BeamField>
        <div className="flex items-center gap-3 rounded-[10px] border border-white/15 bg-white/[0.04] px-4 py-3 focus-within:border-white/70 focus-within:ring-2 focus-within:ring-white/30">
          <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-white/50" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKey}
            role="combobox"
            aria-expanded={show}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={show && active >= 0 && cards[active] ? `${listId}-${active}` : undefined}
            aria-label="Search for your brand or app"
            placeholder="Search any global brand or app (e.g. Spotify, Zomato, Binance, Paytm)…"
            className="w-full bg-transparent text-sm text-white placeholder:text-white/55 focus:outline-none"
          />
          {loading && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-white" aria-label="Searching" />}
        </div>
      </BeamField>

      {show && (
        <div id={listId} role="listbox" className="absolute left-0 right-0 z-30 mt-2 max-h-[26rem] overflow-auto rounded-2xl border border-white/15 bg-black p-2 shadow-2xl shadow-black/60">
          {cards.length === 0 && !loading && <p className="px-3 py-4 text-sm text-white/55">No matching apps found. You can still fill the form in by hand below.</p>}
          {cards.length === 0 && loading && <p className="px-3 py-4 text-sm text-white/55">Searching the App Store and Google Play…</p>}
          {cards.map((c, i) => (
            <button
              key={c.key}
              id={`${listId}-${i}`}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(c)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${i === active ? "bg-white/10" : "hover:bg-white/[0.04]"}`}
            >
              <Icon c={c} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-white">{c.name}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${c.origin === "live" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>{c.origin === "live" ? "LIVE" : "PRESET"}</span>
                </span>
                <span className="block truncate text-xs text-white/60">{c.publisher || "Unknown publisher"}</span>
                <span className="block truncate text-[11px] text-white/50">{c.ios?.title ?? c.android?.title}</span>
              </span>
              <Platforms c={c} />
            </button>
          ))}
          {note && <p className="border-t border-white/10 px-3 pt-2 text-[11px] text-amber-300">{note}</p>}
          {cards.length > 0 && <p className="px-3 pt-2 text-[11px] text-white/50">Check the publisher: official apps come from the company itself, not a similarly named developer.</p>}
        </div>
      )}
    </div>
  );
}
