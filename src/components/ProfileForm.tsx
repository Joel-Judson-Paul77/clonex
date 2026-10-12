"use client";

import { NeuroBackdrop } from "@/components/ui/neuro-backdrop";
import { useCallback, useMemo, useState } from "react";
import { Zap } from "lucide-react";
import BrandBubbles from "@/components/BrandBubbles";
import BrandSearch from "@/components/BrandSearch";
import BasicIdentityCard from "@/components/profile/BasicIdentityCard";
import OfficialAppsCard from "@/components/profile/OfficialAppsCard";
import VerifiedChannelsCard from "@/components/profile/VerifiedChannelsCard";
import type { AutoState, Check, Checks, Kind } from "@/components/profile/shared";
import type { BrandCard } from "@/lib/brand-types";
import type { BrandProfile } from "@/lib/types";

export const EMPTY_PROFILE: BrandProfile = {
  name: "",
  handles: { bluesky: [], telegram: [], youtube: [] },
  apps: [],
  developers: [],
  domains: [],
  phones: [],
};

export const DEMO_PROFILE: BrandProfile = {
  name: "Paytm",
  handles: { bluesky: [], telegram: [], youtube: ["paytm"] },
  apps: [
    { id: "473941634", store: "app-store", label: "Paytm (iOS)" },
    { id: "net.one97.paytm", store: "play-store", label: "Paytm (Android)" },
  ],
  developers: ["One97 Communications"],
  domains: ["paytm.com"],
  phones: [],
};

type HandleKind = "youtube" | "telegram" | "bluesky";
type AutoInfo = { origin: "live" | "preset"; ios: boolean; android: boolean; domain: boolean; publisher: boolean; logo: boolean };

async function verify(kind: Kind, value: string): Promise<{ ok: boolean; message: string; detail?: Record<string, string> }> {
  try {
    const r = await fetch("/api/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, value }) });
    const j = await r.json();
    // 400 / 429 answers carry { error } instead of { ok, message }; show that text rather than a blank status
    if (typeof j.ok !== "boolean") return { ok: false, message: j.error ?? "Verification failed - try again, or save without verifying" };
    return j;
  } catch {
    return { ok: false, message: "Could not reach CloneX - check your connection and try again" };
  }
}

/**
 * Step 1 container. It owns the shared profile state and the handlers (all referentially stable), and lays
 * out three independent cards. Each card is memoised on its own slice of the state, so editing a field in
 * one card does not re-render the other two.
 */
export default function ProfileForm({ initial, onSave }: { initial: BrandProfile; onSave: (p: BrandProfile) => void }) {
  const [p, setP] = useState<BrandProfile>(initial);
  const [checks, setChecks] = useState<Checks>({});
  const [error, setError] = useState("");
  // which fields were auto-filled from a registry lookup, and where that data came from
  const [auto, setAuto] = useState<AutoInfo | null>(null);
  const [toast, setToast] = useState("");

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }, []);

  // ---- shared handlers (stable identity: they only use functional state updates) ----
  const runCheck = useCallback(async (kind: Kind, value: string) => {
    const key = `${kind}:${value}`;
    setChecks((c) => ({ ...c, [key]: { state: "checking" } }));
    const res = await verify(kind, value);
    setChecks((c) => ({ ...c, [key]: { state: res.ok ? "ok" : "bad", message: res.message } }));
    // verified apps tell us the real publisher name -> use it to exclude the official app's publisher
    const dev = res.detail?.developer;
    // compare case-insensitively: stores spell the same company "Bundl Technologies" / "BUNDL TECHNOLOGIES"
    if (res.ok && dev) setP((cur) => (cur.developers.some((d) => d.toLowerCase() === dev.toLowerCase()) ? cur : { ...cur, developers: [...cur.developers, dev] }));
    const icon = res.detail?.iconDataUrl;
    if (res.ok && icon) setP((cur) => (cur.logoDataUrl ? cur : { ...cur, logoDataUrl: icon })); // use the official app icon as the logo
  }, []);

  const onName = useCallback((v: string) => setP((c) => ({ ...c, name: v })), []);

  const onLogo = useCallback((file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Logo must be an image file");
    if (file.size > 1_000_000) return setError("Logo must be under 1 MB");
    setError("");
    const fr = new FileReader();
    fr.onload = () => setP((cur) => ({ ...cur, logoDataUrl: String(fr.result) }));
    fr.readAsDataURL(file);
  }, []);

  const onPrimaryDomain = useCallback((v: string) => {
    setP((c) => ({ ...c, domains: [v, ...c.domains.slice(1).filter((d) => d !== v)] }));
    runCheck("domain", v);
  }, [runCheck]);
  const onClearPrimaryDomain = useCallback(() => setP((c) => ({ ...c, domains: c.domains.slice(1) })), []);

  const onAddHandle = useCallback((k: HandleKind, v: string) => setP((c) => ({ ...c, handles: { ...c.handles, [k]: [...c.handles[k], v] } })), []);
  const onRemoveHandle = useCallback((k: HandleKind, v: string) => setP((c) => ({ ...c, handles: { ...c.handles, [k]: c.handles[k].filter((x) => x !== v) } })), []);

  const onAddSite = useCallback((v: string) => setP((c) => ({ ...c, domains: c.domains.includes(v) ? c.domains : [...c.domains, v] })), []);
  const onRemoveSite = useCallback((v: string) => setP((c) => ({ ...c, domains: c.domains.filter((d, i) => i === 0 || d !== v) })), []);

  // replace the MAIN app of a store (the first one), keep any extra apps, then verify the new ID
  const onSetApp = useCallback((store: "app-store" | "play-store", id: string) => {
    setP((c) => {
      const same = c.apps.filter((a) => a.store === store);
      const others = c.apps.filter((a) => a.store !== store);
      return { ...c, apps: [...others, { id, store }, ...same.slice(1).filter((a) => a.id !== id)] };
    });
    runCheck(store, id);
  }, [runCheck]);
  const onRemoveApp = useCallback((id: string) => setP((c) => ({ ...c, apps: c.apps.filter((a) => a.id !== id) })), []);
  const onAddPhone = useCallback((v: string) => setP((c) => ({ ...c, phones: [...c.phones, v] })), []);
  const onRemovePhone = useCallback((v: string) => setP((c) => ({ ...c, phones: c.phones.filter((x) => x !== v) })), []);
  const onRemoveDeveloper = useCallback((v: string) => setP((c) => ({ ...c, developers: c.developers.filter((x) => x !== v) })), []);

  /** One click: fill every field from a store-registry card, then verify each asset against the live stores. */
  const applyBrand = useCallback((c: BrandCard) => {
    setP((cur) => ({
      ...cur,
      name: c.name,
      logoDataUrl: undefined,
      apps: [
        ...(c.ios ? [{ id: c.ios.appId, store: "app-store" as const, label: c.ios.title }] : []),
        ...(c.android ? [{ id: c.android.pkg, store: "play-store" as const, label: c.android.title }] : []),
      ],
      // the App Store seller and the Google Play developer are often different legal names of the same company
      developers: [c.publisher, c.android?.developer]
        .filter((d): d is string => !!d)
        .filter((d, i, all) => all.findIndex((x) => x.toLowerCase() === d.toLowerCase()) === i),
      domains: c.domain ? [c.domain] : [],
    }));
    setChecks({});
    setError("");
    setAuto({ origin: c.origin, ios: !!c.ios, android: !!c.android, domain: !!c.domain, publisher: !!c.publisher, logo: true });
    flash(`Loaded official registry profile for ${c.name}`);
    // logo: fetch the store icon through our proxy so it is stored with the profile
    if (c.iconUrl) {
      fetch(`/api/icon?url=${encodeURIComponent(c.iconUrl)}`)
        .then((r) => r.json())
        .then((j) => j.dataUrl && setP((cur) => (cur.logoDataUrl ? cur : { ...cur, logoDataUrl: j.dataUrl })))
        .catch(() => undefined);
    }
    if (c.ios) runCheck("app-store", c.ios.appId); // also fills publisher + logo if missing
    if (c.android) runCheck("play-store", c.android.pkg);
    if (c.domain) runCheck("domain", c.domain);
  }, [flash, runCheck]);

  const loadDemo = useCallback(() => {
    setP(DEMO_PROFILE);
    setChecks({});
    setError("");
    setAuto(null);
    // verify the demo assets so publishers and the official logo auto-fill
    DEMO_PROFILE.apps.forEach((a) => runCheck(a.store, a.id));
    DEMO_PROFILE.domains.forEach((d) => runCheck("domain", d));
    DEMO_PROFILE.handles.youtube.forEach((h) => runCheck("youtube", h));
  }, [runCheck]);

  // ---- per-card badge states: plain strings, so a card re-renders only when its own badge actually changes ----
  const okFor = (kinds: Kind[]) => Object.entries(checks).some(([k, v]) => (v as Check).state === "ok" && kinds.includes(k.split(":")[0] as Kind));
  const badge = (kinds: Kind[], used: boolean): AutoState => (!auto || !used ? undefined : auto.origin === "live" || okFor(kinds) ? "verified" : "preset");
  const bName = badge(["app-store", "play-store"], true);
  const bLogo = badge(["app-store", "play-store"], !!auto?.logo && !!p.logoDataUrl);
  // The domain comes from the store listing's website field, so the listing alone doesn't confirm it:
  // only its own DNS check does.
  const bDomain: AutoState = !auto?.domain ? undefined : okFor(["domain"]) ? "verified" : auto.origin === "live" ? "pending" : "preset";
  const bIos = badge(["app-store"], !!auto?.ios);
  const bAndroid = badge(["play-store"], !!auto?.android);
  const bPublisher = badge(["app-store", "play-store"], !!auto?.publisher);
  const basicBadges = useMemo(() => ({ name: bName, logo: bLogo, domain: bDomain }), [bName, bLogo, bDomain]);
  const appBadges = useMemo(() => ({ ios: bIos, android: bAndroid, publisher: bPublisher }), [bIos, bAndroid, bPublisher]);

  const save = () => {
    if (Object.values(checks).some((c) => c.state === "checking")) return;
    if (p.name.trim().length < 3) return setError("Brand name is required (3+ characters)");
    const anyAsset = p.domains.length + p.apps.length + p.handles.bluesky.length + p.handles.telegram.length + p.handles.youtube.length;
    if (!anyAsset) return setError("Add at least one official asset (domain, handle or app) so we know what NOT to flag");
    setError("");
    onSave(p);
  };

  const unverified = Object.values(checks).filter((c) => c.state === "bad").length;
  // saving mid-verification would drop the auto-filled logo and publishers, weakening the scan
  const busy = Object.values(checks).some((c) => c.state === "checking");

  return (
    <div className="space-y-6">
      {/* Step banner */}
      <div className="glass-card rounded-3xl p-6 sm:p-8">
        <NeuroBackdrop />
        <div className="relative">
        <p className="eyebrow">Step 1 of 3</p>
        <h2 className="mt-2 text-2xl font-semibold leading-[1.15] sm:text-3xl bg-gradient-to-b from-white to-white/55 bg-clip-text text-transparent">Define your official brand assets so CloneX never flags your real accounts.</h2>
        <p className="mt-2 max-w-2xl text-sm text-white/60">Search for your brand and CloneX fills in the name, logo, app IDs, publisher and website from the App Store and Google Play. You can edit anything afterwards.</p>
        <p className="mt-6 text-base font-semibold text-white">Which brand or app do you want to protect?</p>
        <p className="mt-1 text-xs text-white/55">Pick one of the popular brands below, or search for yours.</p>
        <div className="mt-3 space-y-3">
          <BrandSearch onPick={applyBrand} />
          <BrandBubbles onPick={applyBrand} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/55">
          <span>No time? </span>
          <button type="button" onClick={loadDemo} className="btn-ghost px-4 py-1.5 text-xs font-medium"><Zap aria-hidden="true" className="mr-1.5 inline h-3.5 w-3.5 -translate-y-px" />Load Demo Profile (Paytm)</button>
          <span>fills and verifies every field in one click.</span>
        </div>
        </div>
      </div>

      {/* Three independent cards */}
      <div className="step-grid grid grid-cols-1 items-start gap-4">
        <BasicIdentityCard
          name={p.name}
          logoDataUrl={p.logoDataUrl}
          domains={p.domains}
          checks={checks}
          badges={basicBadges}
          onName={onName}
          onLogo={onLogo}
          onPrimaryDomain={onPrimaryDomain}
          onClearPrimaryDomain={onClearPrimaryDomain}
          onCheck={runCheck}
        />
        <VerifiedChannelsCard
          handles={p.handles}
          domains={p.domains}
          checks={checks}
          onAddHandle={onAddHandle}
          onRemoveHandle={onRemoveHandle}
          onAddSite={onAddSite}
          onRemoveSite={onRemoveSite}
          onCheck={runCheck}
        />
        <OfficialAppsCard
          apps={p.apps}
          phones={p.phones}
          developers={p.developers}
          checks={checks}
          badges={appBadges}
          onSetApp={onSetApp}
          onRemoveApp={onRemoveApp}
          onAddPhone={onAddPhone}
          onRemovePhone={onRemovePhone}
          onRemoveDeveloper={onRemoveDeveloper}
          onCheck={runCheck}
        />
      </div>

      {error && <p className="rounded-[10px] border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      {unverified > 0 && <p className="text-xs text-amber-400">{unverified} asset(s) could not be verified. You can still save, but unverified assets may be wrong.</p>}

      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl border border-emerald-500/40 bg-emerald-950 px-4 py-3 text-sm font-medium text-emerald-200 shadow-xl shadow-black/50">
          ✓ {toast}
        </div>
      )}

      {/* CTA bar, anchored beneath the grid */}
      <div className="sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0b0b0b]/85 p-4 shadow-2xl shadow-black/60 backdrop-blur-md">
        <p className="text-sm text-white/60">{busy ? "Verifying your assets with the live platforms…" : "Done? Save the profile and start monitoring."}</p>
        <button type="button" onClick={save} disabled={busy} className="btn-primary px-6 py-2.5 text-sm disabled:cursor-wait disabled:opacity-50">
          {busy ? "Verifying…" : "Save & go to Step 2 ➔"}
        </button>
      </div>
    </div>
  );
}
