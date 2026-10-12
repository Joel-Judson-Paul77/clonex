"use client";

import { AssetList, CardShell, Field, memoWithChecks } from "./shared";
import type { Checks, Kind } from "./shared";

type HandleKind = "youtube" | "telegram" | "bluesky";

interface Props {
  handles: { bluesky: string[]; telegram: string[]; youtube: string[] };
  /** all official domains; the first is the primary one (edited in Basic Identity), the rest are listed here */
  domains: string[];
  /** what the official-account lookup found (or why it found nothing) */
  note?: string;
  checks: Checks;
  onAddHandle: (kind: HandleKind, v: string) => void;
  onRemoveHandle: (kind: HandleKind, v: string) => void;
  onAddSite: (v: string) => void;
  onRemoveSite: (v: string) => void;
  onCheck: (kind: Kind, v: string) => void;
}

function VerifiedChannelsCardBase({ handles, domains, note, checks, onAddHandle, onRemoveHandle, onAddSite, onRemoveSite, onCheck }: Props) {
  const extraSites = domains.slice(1);
  const count = handles.youtube.length + handles.telegram.length + handles.bluesky.length + extraSites.length;
  const handleList = (kind: HandleKind, label: string, placeholder: string) => (
    <Field label={label}>
      <AssetList kind={kind} values={handles[kind]} placeholder={placeholder} checks={checks} onAdd={(v) => onAddHandle(kind, v)} onRemove={(v) => onRemoveHandle(kind, v)} onCheck={onCheck} />
    </Field>
  );
  return (
    <CardShell step="b" title="Verified Channels" subtitle="Official social accounts and extra websites" summary={`${count} added`}>
      {note && (
        <p role="status" className="rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2 text-xs leading-relaxed text-white/70">{note}</p>
      )}
      {handleList("youtube", "YouTube channels", "channel handle")}
      {handleList("telegram", "Telegram channels", "brand_official")}
      {handleList("bluesky", "Bluesky accounts", "brand.bsky.social")}
      <Field label="Other websites" hint="Extra official domains (the main one is in Basic Identity).">
        <AssetList kind="domain" values={extraSites} placeholder="example.com" checks={checks} onAdd={onAddSite} onRemove={onRemoveSite} onCheck={onCheck} />
      </Field>
    </CardShell>
  );
}

const VerifiedChannelsCard = memoWithChecks(VerifiedChannelsCardBase, ["youtube", "telegram", "bluesky", "domain"]);
export default VerifiedChannelsCard;
