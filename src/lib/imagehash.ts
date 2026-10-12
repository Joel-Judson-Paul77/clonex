import sharp from "./sharp-config";

// Perceptual logo matching: a 64-bit difference hash + 64-bit average hash per image.
// Similar-looking images produce hashes that differ in only a few bits, even after
// resizing, re-compression or small colour changes.

export interface LogoHash {
  d: bigint; // difference hash
  a: bigint; // average hash
}

const MAX_BYTES = 2_000_000;

async function loadBuffer(src: string): Promise<Buffer | null> {
  try {
    if (src.startsWith("data:")) {
      const b64 = src.split(",")[1];
      return b64 ? Buffer.from(b64, "base64") : null;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000);
    try {
      const r = await fetch(src, { signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0 Clonex/0.1" } });
      if (!r.ok) return null;
      const ab = await r.arrayBuffer();
      return ab.byteLength > MAX_BYTES ? null : Buffer.from(ab);
    } finally {
      clearTimeout(t);
    }
  } catch {
    return null;
  }
}

async function gray(buf: Buffer, w: number, h: number): Promise<Uint8Array> {
  const { data } = await sharp(buf, { failOn: "none" })
    .flatten({ background: "#ffffff" }) // transparent PNG logos -> white
    .grayscale()
    .resize(w, h, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}

const hashCache = new Map<string, LogoHash>(); // remote icons rarely change; avoid re-downloading

export async function hashImage(src: string): Promise<LogoHash | null> {
  const remote = !src.startsWith("data:");
  if (remote && hashCache.has(src)) return hashCache.get(src)!;
  const buf = await loadBuffer(src);
  const h = buf ? await hashBuffer(buf) : null;
  if (remote && h) hashCache.set(src, h);
  return h;
}

async function hashBuffer(buf: Buffer): Promise<LogoHash | null> {
  try {
    const dpx = await gray(buf, 9, 8);
    let d = 0n;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) d = (d << 1n) | (dpx[y * 9 + x] > dpx[y * 9 + x + 1] ? 1n : 0n);

    const apx = await gray(buf, 8, 8);
    const mean = apx.reduce((s, v) => s + v, 0) / apx.length;
    let a = 0n;
    for (let i = 0; i < 64; i++) a = (a << 1n) | (apx[i] > mean ? 1n : 0n);
    return { d, a };
  } catch {
    return null;
  }
}

function hamming(x: bigint, y: bigint): number {
  let v = x ^ y;
  let n = 0;
  while (v) {
    n += Number(v & 1n);
    v >>= 1n;
  }
  return n;
}

/**
 * 0..1 where ~0 is unrelated and 1 is the same image. Unrelated images sit near
 * 0.5 raw similarity, so we rescale so noise maps to ~0.
 */
export function logoSimilarity(x: LogoHash, y: LogoHash): number {
  const raw = 1 - (hamming(x.d, y.d) + hamming(x.a, y.a)) / 128;
  return Math.max(0, Math.min(1, (raw - 0.5) / 0.5));
}

/**
 * Fakes often crop, zoom or pad the stolen logo. We hash the official logo at several
 * zoom levels and later compare a candidate against all of them (best match wins).
 */
export async function hashImageVariants(src: string): Promise<LogoHash[]> {
  const buf = await loadBuffer(src);
  if (!buf) return [];
  const out: LogoHash[] = [];
  const base = await hashBuffer(buf);
  if (base) out.push(base);
  try {
    const { width: w = 0, height: h = 0 } = await sharp(buf, { failOn: "none" }).metadata();
    if (w > 16 && h > 16) {
      for (const k of [0.9, 0.8]) {
        // zoom in: centre crop
        const cw = Math.round(w * k), ch = Math.round(h * k);
        const crop = await sharp(buf, { failOn: "none" })
          .extract({ left: Math.round((w - cw) / 2), top: Math.round((h - ch) / 2), width: cw, height: ch })
          .png()
          .toBuffer();
        const hc = await hashBuffer(crop);
        if (hc) out.push(hc);
      }
      // zoom out: white padding
      const padX = Math.round(w * 0.1), padY = Math.round(h * 0.1);
      const padded = await sharp(buf, { failOn: "none" })
        .flatten({ background: "#ffffff" })
        .extend({ top: padY, bottom: padY, left: padX, right: padX, background: "#ffffff" })
        .png()
        .toBuffer();
      const hp = await hashBuffer(padded);
      if (hp) out.push(hp);
    }
  } catch {
    /* variants are best-effort */
  }
  return out;
}

export function bestLogoSimilarity(variants: LogoHash[], candidate: LogoHash): number {
  return variants.reduce((m, v) => Math.max(m, logoSimilarity(v, candidate)), 0);
}
