"use client";

import { useRef } from "react";
import { BeamField } from "@/components/ui/beam-field";
import { CardShell, Field, INPUT, SingleValueField, memoWithChecks } from "./shared";
import type { AutoState, Checks, Kind } from "./shared";

interface Props {
  name: string;
  logoDataUrl?: string;
  /** all official domains; the first one is the primary domain shown here */
  domains: string[];
  checks: Checks;
  badges: { name: AutoState; logo: AutoState; domain: AutoState };
  onName: (v: string) => void;
  onLogo: (file?: File) => void;
  onPrimaryDomain: (v: string) => void;
  onClearPrimaryDomain: () => void;
  onCheck: (kind: Kind, v: string) => void;
}

function BasicIdentityCardBase({ name, logoDataUrl, domains, checks, badges, onName, onLogo, onPrimaryDomain, onClearPrimaryDomain, onCheck }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const primary = domains[0];

  return (
    <CardShell step="a" title="Basic Identity" subtitle="Brand name, logo and main website" summary={name ? `${name}${logoDataUrl ? " · logo set" : ""}` : "Not set"}>
      <Field label="Brand name" badge={badges.name} hint="The name scammers will imitate. All look-alike detection starts here.">
        <BeamField>
          <input value={name} onChange={(e) => onName(e.target.value)} placeholder="e.g. Paytm" aria-label="Brand name" className={INPUT} />
        </BeamField>
      </Field>

      <Field label="Official logo" badge={badges.logo} hint="Used to spot copied icons and avatars. Auto-filled from the store listing.">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-28 w-full items-center justify-center overflow-hidden rounded-[10px] border border-dashed border-white/15 bg-white/[0.04] text-xs text-white/55 hover:border-white/40"
        >
          {logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data-URL preview; next/image doesn't apply
            <img src={logoDataUrl} alt="Official logo" className="h-full object-contain p-2" />
          ) : (
            "Click to upload (PNG/JPG, under 1 MB)"
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
      </Field>

      <Field label="Primary domain" badge={badges.domain} verifiedText="✓ Domain resolves (DNS check)" hint="Sites on your domains are never flagged.">
        <SingleValueField
          key={`domain-${primary ?? ""}`}
          kind="domain"
          values={primary ? [primary] : []}
          placeholder="example.com"
          checks={checks}
          onSet={onPrimaryDomain}
          onRemove={onClearPrimaryDomain}
          onCheck={onCheck}
        />
      </Field>
    </CardShell>
  );
}

const BasicIdentityCard = memoWithChecks(BasicIdentityCardBase, ["domain"]);
export default BasicIdentityCard;
