/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * Voicest V2X Project Share URL Generator & Stability Engine
 * Encodes projects into compact, shareable URLs using deflate compression and Base64URL.
 * Provides project sanitization, corruption recovery, and quota protection.
 */

export interface ShareableProject {
  nm: string;
  bpm: number;
  bars: number;
  sc?: number;
  rt?: number;
  swing?: number;
  bonus?: {
    autoBreath?: boolean;
    flutter?: boolean;
    deEsser?: boolean;
    humanize?: boolean;
    portamento?: boolean;
    throat?: boolean;
    doubler?: boolean;
    tubeWarmth?: boolean;
    airBand?: boolean;
    phonemeEq?: boolean;
  };
  ch: Array<{
    id: number;
    name: string;
    k: string;
    v?: number;
    cw?: string;
    vb?: string;
    vp?: Record<string, any>;
    n: Array<{
      s: number;
      l: number;
      p: number;
      t: string;
      pc?: Array<[number, number]>;
    }>;
  }>;
}

/** Sanitize project data to prevent crashes or corrupt states */
export function sanitizeProject(raw: any): ShareableProject {
  if (!raw || typeof raw !== 'object') {
    return {
      nm: 'Voicest',
      bpm: 120,
      bars: 4,
      ch: [{ id: 1, name: 'Voice', k: 'Voice', n: [{ s: 0, l: 4, p: 60, t: 'a' }] }],
    };
  }

  const bpm = typeof raw.bpm === 'number' && isFinite(raw.bpm)
    ? Math.max(40, Math.min(240, Math.round(raw.bpm)))
    : 120;

  const validBars = [2, 4, 8, 16, 32, 64, 128, 256];
  const bars = validBars.includes(+raw.bars) ? +raw.bars : 4;

  const nm = String(raw.nm || 'Voicest').slice(0, 60);

  const rawCh = Array.isArray(raw.ch) ? raw.ch.slice(0, 16) : [];
  const ch = rawCh.map((h: any, idx: number) => {
    const k = ['Voice', 'Piano', 'Musicbox', 'Violin', 'Guitar', 'Chip', 'Sample'].includes(h.k)
      ? h.k
      : 'Voice';

    const rawNotes = Array.isArray(h.n) ? h.n.slice(0, 5000) : [];
    const notes = rawNotes.map((q: any) => {
      const s = Math.max(0, Math.min(4095, Math.round(+q.s || 0)));
      const l = Math.max(1, Math.min(512, Math.round(+q.l || 1)));
      let p = Math.round(+q.p || 60);
      while (p < 36) p += 12;
      while (p > 96) p -= 12;
      const t = String(q.t || 'a').slice(0, 30);

      const noteObj: any = { s, l, p, t };
      if (Array.isArray(q.pc) && q.pc.length > 1) {
        noteObj.pc = q.pc
          .filter((pt: any) => Array.isArray(pt) && isFinite(pt[0]) && isFinite(pt[1]))
          .slice(0, 100)
          .map((pt: any) => [+pt[0], +pt[1]]);
      }
      return noteObj;
    });

    return {
      id: typeof h.id === 'number' ? h.id : idx + 1,
      name: String(h.name || `Track ${idx + 1}`).slice(0, 40),
      k,
      v: typeof h.v === 'number' && isFinite(h.v) ? Math.max(0, Math.min(1, h.v)) : 0.7,
      cw: ['square', 'sawtooth', 'triangle'].includes(h.cw) ? h.cw : 'square',
      vb: typeof h.vb === 'string' ? h.vb.slice(0, 50) : '',
      vp: h.vp && typeof h.vp === 'object' ? { ...h.vp } : {},
      n: notes,
    };
  });

  return {
    nm,
    bpm,
    bars,
    sc: typeof raw.sc === 'number' ? raw.sc : 0,
    rt: typeof raw.rt === 'number' ? raw.rt : 0,
    swing: typeof raw.swing === 'number' ? raw.swing : 0,
    bonus: raw.bonus && typeof raw.bonus === 'object' ? { ...raw.bonus } : undefined,
    ch: ch.length ? ch : [{ id: 1, name: 'Voice', k: 'Voice', n: [] }],
  };
}

/** Converts Uint8Array to base64url string */
export function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  const b64 = (typeof btoa === 'function' ? btoa(bin) : Buffer.from(bytes).toString('base64'));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Converts base64url string back to Uint8Array */
export function base64UrlToBytes(str: string): Uint8Array {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

/** Compresses a string to bytes using deflate */
export async function compressString(str: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(str);
  if (typeof CompressionStream !== 'undefined') {
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    writer.write(bytes as unknown as BufferSource);
    writer.close();
    const resp = new Response(cs.readable);
    return new Uint8Array(await resp.arrayBuffer());
  }
  // Node.js fallback
  try {
    const zlib = await import('node:zlib');
    return new Uint8Array(zlib.deflateRawSync(bytes));
  } catch (e) {
    return bytes;
  }
}

/** Decompresses bytes back to string */
export async function decompressString(compressed: Uint8Array): Promise<string> {
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      writer.write(compressed as unknown as BufferSource);
      writer.close();
      const resp = new Response(ds.readable);
      return new TextDecoder().decode(await resp.arrayBuffer());
    } catch (e) {
      // Fallback if not compressed
      return new TextDecoder().decode(compressed);
    }
  }
  // Node.js fallback
  try {
    const zlib = await import('node:zlib');
    try {
      return zlib.inflateRawSync(compressed).toString('utf-8');
    } catch {
      return Buffer.from(compressed).toString('utf-8');
    }
  } catch (e) {
    return new TextDecoder().decode(compressed);
  }
}

/** Generate a compact URL for sharing the current project */
export async function generateProjectShareUrl(project: any, baseUrl = ''): Promise<{ url: string; code: string; byteSize: number }> {
  const clean = sanitizeProject(project);
  const jsonStr = JSON.stringify(clean);
  const compressed = await compressString(jsonStr);
  const code = bytesToBase64Url(compressed);

  const cleanBase = baseUrl.replace(/#.*$/, '').replace(/[?&](share|project)=[^&]*/g, '');
  const sep = cleanBase.includes('?') ? '&' : '?';
  const url = `${cleanBase}#share=${code}`;

  return {
    url,
    code,
    byteSize: code.length,
  };
}

/** Parse project from URL hash, search query, or raw code string */
export async function parseProjectFromShareUrl(urlOrCode: string): Promise<ShareableProject | null> {
  if (!urlOrCode || typeof urlOrCode !== 'string') return null;

  let code = urlOrCode.trim();

  // Extract from #share=... or ?share=... or #project=... or ?project=...
  const match = code.match(/[#?&](?:share|project)=([A-Za-z0-9_-]+)/);
  if (match) {
    code = match[1];
  }

  // Remove potential hash or prefix if passed directly
  code = code.replace(/^[#?]/, '').replace(/^share=/, '').replace(/^project=/, '');

  try {
    const bytes = base64UrlToBytes(code);
    const jsonStr = await decompressString(bytes);
    const raw = JSON.parse(jsonStr);
    return sanitizeProject(raw);
  } catch (e) {
    console.error('Failed to parse shared project:', e);
    return null;
  }
}
