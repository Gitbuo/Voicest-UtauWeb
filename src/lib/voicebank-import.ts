/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * Pure helpers for UTAU voicebank import decoding, filtering, oto.ini parsing,
 * and inline lyric popover viewport clamping.
 */

export interface OtoEntryParsed {
  file: string;
  alias: string;
  offset: number;
  consonant: number;
  cutoff: number;
  preutterance: number;
  overlap: number;
}

export interface LyricPopoverRect {
  left: number;
  top: number;
  flipAbove: boolean;
}

export function decodeTextWithBom(bytes: Uint8Array): string {
  if (!bytes || !bytes.length) return '';
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      try {
        return new TextDecoder('utf-16le').decode(bytes.subarray(2)).replace(/^\uFEFF/, '');
      } catch {
        // fall through
      }
    }
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      const swapped = new Uint8Array(Math.max(0, bytes.length - 2));
      for (let i = 2; i + 1 < bytes.length; i += 2) {
        swapped[i - 2] = bytes[i + 1];
        swapped[i - 1] = bytes[i];
      }
      try {
        return new TextDecoder('utf-16le').decode(swapped).replace(/^\uFEFF/, '');
      } catch {
        // fall through
      }
    }
  }
  const hasUtf8Bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const view = hasUtf8Bom ? bytes.subarray(3) : bytes;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(view).replace(/^\uFEFF/, '');
  } catch {
    try {
      return new TextDecoder('shift_jis').decode(view).replace(/^\uFEFF/, '');
    } catch {
      return new TextDecoder('utf-8', { fatal: false }).decode(view).replace(/^\uFEFF/, '');
    }
  }
}

export function isIgnoredVbPath(rawPath: string): boolean {
  const norm = String(rawPath || '').replace(/\\/g, '/');
  if (!norm || norm.endsWith('/')) return true;
  if (/(?:^|\/)__macosx\//i.test(norm)) return true;
  const base = norm.split('/').pop() || '';
  if (!base) return true;
  if (base.startsWith('._')) return true;
  if (/^(\.ds_store|thumbs\.db|desktop\.ini)$/i.test(base)) return true;
  if (/\.(mrq|llsm|pmk|uwf|ct|sc|peak|bat|sh)$/i.test(base)) return true;
  return false;
}

export function isAudioVbFile(name: string): boolean {
  return /\.(wav|aiff?|flac|ogg|mp3)$/i.test(String(name || ''));
}

export function isSupportedVbAsset(name: string): boolean {
  return /\.(wav|aiff?|flac|ogg|mp3|ini|txt|map|frq|yaml|yml|png|jpe?g|bmp|gif|webp)$/i.test(String(name || ''));
}

export function parseOtoIni(text: string, dir = ''): OtoEntryParsed[] {
  const cleanDir = dir ? String(dir).replace(/\\/g, '/').replace(/^\.\//, '') : '';
  const normDir = cleanDir && !cleanDir.endsWith('/') ? `${cleanDir}/` : cleanDir;
  const out: OtoEntryParsed[] = [];
  const cleanText = String(text || '').replace(/^\uFEFF/, '');

  for (const rawLine of cleanText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;

    const rawFile = line.slice(0, eqIdx).trim();
    if (!isAudioVbFile(rawFile)) continue;

    const rhs = line.slice(eqIdx + 1);
    const parts = rhs.split(',');
    if (parts.length < 4) continue;

    const alias = parts[0].trim();
    const num = (idx: number): number => {
      const v = parseFloat(parts[idx] ?? '');
      return Number.isFinite(v) ? v : 0;
    };

    let filePath = rawFile.replace(/\\/g, '/').replace(/^\.\//, '');
    if (normDir && !filePath.startsWith('/')) {
      filePath = `${normDir}${filePath}`;
    }
    while (/[^/]+\/\.\.\//.test(filePath)) {
      filePath = filePath.replace(/[^/]+\/\.\.\//, '');
    }

    const baseName = filePath.split('/').pop() || filePath;
    out.push({
      file: filePath.toLowerCase(),
      alias: alias || baseName.replace(/\.(wav|aiff?|flac|ogg|mp3)$/i, ''),
      offset: num(1),
      consonant: num(2),
      cutoff: num(3),
      preutterance: num(4),
      overlap: num(5),
    });
  }

  return out;
}

export function clampLyricPopoverRect(opts: {
  noteLeft: number;
  noteTop: number;
  noteHeight: number;
  scrollLeft: number;
  scrollTop: number;
  viewportWidth: number;
  viewportHeight: number;
  popWidth: number;
  popHeight: number;
  keyWidth: number;
}): LyricPopoverRect {
  const minLeft = opts.scrollLeft + opts.keyWidth + 4;
  const maxLeft = Math.max(minLeft, opts.scrollLeft + opts.viewportWidth - opts.popWidth - 8);
  const left = Math.round(Math.max(minLeft, Math.min(maxLeft, opts.noteLeft)));

  const belowTop = opts.noteTop + opts.noteHeight + 4;
  const maxBottom = opts.scrollTop + opts.viewportHeight - 6;
  const flipAbove = belowTop + opts.popHeight > maxBottom && opts.noteTop - opts.popHeight - 4 >= opts.scrollTop;
  const top = Math.round(
    flipAbove
      ? opts.noteTop - opts.popHeight - 4
      : Math.max(opts.scrollTop + 4, Math.min(belowTop, Math.max(opts.scrollTop + 4, maxBottom - opts.popHeight)))
  );

  return { left, top, flipAbove };
}
