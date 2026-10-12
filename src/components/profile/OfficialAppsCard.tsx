"use client";

import { AssetList, CardShell, Field, SingleValueField, memoWithChecks } from "./shared";
import type { AutoState, Checks, Kind } from "./shared";
import type { BrandProfile } from "@/lib/types";

interface Props {
  apps: BrandProfile["apps"];
  phones: string[];
  developers: string[];
  checks: Checks;
  badges: { ios: AutoState; android: AutoState; publisher: AutoState };
  /** replace (or set) the main app ID of a store */
  onSetApp: (store: "app-store" | "play-store", id: string) => void;
  onRemoveApp: (id: string) => void;
  onAddPhone: (v: string) => void;
  onRemovePhone: (v: string) => void;
  onRemoveDeveloper: (v: string) => void;
  onCheck: (kind: Kind, v: string) => void;
}

function OfficialAppsCardBase({ apps, phones, developers, checks, badges, onSetApp, onRemoveApp, onAddPhone, onRemovePhone, onRemoveDeveloper, onCheck }: Props) {
  const ios = apps.filter((a) => a.store === "app-store").map((a) => a.id);
  const android = apps.filter((a) => a.store === "play-store").map((a) => a.id);
  return (
    <CardShell step="c" title="Official Apps & Contacts" subtitle="Store listings, publishers and support numbers" summary={`${apps.length} app(s) · ${developers.length} publisher(s) · ${phones.length} number(s)`}>
      <Field label="iOS App Store ID" badge={badges.ios} hint="App ID or bundle ID. The publisher and logo are added automatically.">
        <SingleValueField key={`ios-${ios[0] ?? ""}`} kind="app-store" values={ios} placeholder="e.g. 473941634 or com.company.app" checks={checks} onSet={(v) => onSetApp("app-store", v)} onRemove={onRemoveApp} onCheck={onCheck} />
      </Field>
      <Field label="Google Play package" badge={badges.android} hint="The package name from the Play Store URL.">
        <SingleValueField key={`and-${android[0] ?? ""}`} kind="play-store" values={android} placeholder="e.g. net.one97.paytm" checks={checks} onSet={(v) => onSetApp("play-store", v)} onRemove={onRemoveApp} onCheck={onCheck} />
      </Field>
      <Field label="Publisher names" badge={badges.publisher} hint="Developer names that legitimately publish your apps. Auto-filled from verified apps.">
        <div className="flex flex-wrap gap-2">
          {developers.length === 0 && <span className="text-xs text-white/50">None yet</span>}
          {developers.map((d) => (
            <span key={d} className="flex max-w-full items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs text-white/90">
              <span className="truncate">{d}</span>
              <button type="button" onClick={() => onRemoveDeveloper(d)} className="text-white/55 hover:text-red-400" aria-label={`Remove ${d}`}>✕</button>
            </span>
          ))}
        </div>
      </Field>
      <Field label="Support numbers" hint="Any other number in a listing is flagged as unofficial.">
        <AssetList kind="phone" values={phones} placeholder="1800 123 4567" checks={checks} onAdd={onAddPhone} onRemove={onRemovePhone} onCheck={onCheck} />
      </Field>
    </CardShell>
  );
}

const OfficialAppsCard = memoWithChecks(OfficialAppsCardBase, ["app-store", "play-store", "phone"]);
export default OfficialAppsCard;
