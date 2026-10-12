import type { Finding, ScanResult } from "./types";

export interface N8nPayload {
  event: "brandguard.scan";
  brand: string;
  scannedAt: string;
  stats: ScanResult["stats"];
  findings: Pick<
    Finding,
    "id" | "platform" | "source" | "kind" | "name" | "handle" | "url" | "score" | "severity" | "summary" | "phones"
  >[] & { signals?: string[] }[];
}

export function buildPayload(scan: ScanResult, limit = 15): N8nPayload {
  return {
    event: "brandguard.scan",
    brand: scan.brand.name,
    scannedAt: scan.scannedAt,
    stats: scan.stats,
    findings: scan.findings.slice(0, limit).map((f) => ({
      id: f.id,
      platform: f.platform,
      source: f.source,
      kind: f.kind,
      name: f.name,
      handle: f.handle,
      url: f.url,
      score: f.score,
      severity: f.severity,
      summary: f.summary,
      phones: f.phones,
      signals: f.signals.map((s) => s.label),
    })) as N8nPayload["findings"],
  };
}

export async function sendToN8n(payload: N8nPayload): Promise<{ ok: boolean; status?: number; body?: unknown; error?: string }> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return { ok: false, error: "N8N_WEBHOOK_URL is not set (add it to .env.local)" };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctl.signal,
    });
    const text = await r.text();
    let body: unknown = text;
    try { body = JSON.parse(text); } catch { /* keep text */ }
    return { ok: r.ok, status: r.status, body };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "request failed" };
  } finally {
    clearTimeout(t);
  }
}
