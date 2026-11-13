/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * Straycat-inspired UTAU Flag Parser and Serializer
 * Supports:
 * - g (gender / formant shift factor, e.g. g-5, g+10)
 * - B (breathiness / unvoiced gain percentage, e.g. B50)
 * - t (pitch tuning / modulation factor in cents, e.g. t+20)
 * - vel (consonant velocity factor percentage, e.g. vel150)
 * - p (peak compression / soft knee limiter amount, e.g. p80)
 * - mod (pitch modulation depth percentage, e.g. mod0, mod100)
 */

export interface UtauFlags {
  gender: number; // g: -100 to +100 (0 = neutral)
  breathiness: number; // B: 0 to 100% (default 0)
  pitchShift: number; // t: cents shift (default 0)
  velocity: number; // vel: percentage speed for consonant (default 100)
  peakCompression: number; // p: soft limiter ratio 0 to 100 (default 0)
  modulation: number; // mod: vibrato depth factor (default 100)
  raw: string;
}

export const DEFAULT_FLAGS: UtauFlags = {
  gender: 0,
  breathiness: 0,
  pitchShift: 0,
  velocity: 100,
  peakCompression: 0,
  modulation: 100,
  raw: '',
};

/**
 * Parse an UTAU flag string (e.g., "g-5B50vel120p80") into structured parameters.
 */
export function parseUtauFlags(flagStr: string = ''): UtauFlags {
  const flags: UtauFlags = { ...DEFAULT_FLAGS, raw: flagStr.trim() };
  if (!flagStr || typeof flagStr !== 'string') return flags;

  const str = flagStr.trim();

  // Parse multi-character flags first: vel<num>, mod<num>
  const velMatch = str.match(/vel([+-]?\d+)/i);
  if (velMatch) {
    flags.velocity = Math.max(10, Math.min(400, parseInt(velMatch[1], 10)));
  }

  const modMatch = str.match(/mod([+-]?\d+)/i);
  if (modMatch) {
    flags.modulation = Math.max(0, Math.min(200, parseInt(modMatch[1], 10)));
  }

  // Parse single-character flags: g, B, t, p
  const gMatch = str.match(/(?:^|[^a-zA-Z])g([+-]?\d+)/i);
  if (gMatch) {
    flags.gender = Math.max(-100, Math.min(100, parseInt(gMatch[1], 10)));
  }

  const bMatch = str.match(/(?:^|[^a-zA-Z])B([+-]?\d+)/);
  if (bMatch) {
    flags.breathiness = Math.max(0, Math.min(100, parseInt(bMatch[1], 10)));
  }

  const tMatch = str.match(/(?:^|[^a-zA-Z])t([+-]?\d+)/i);
  if (tMatch) {
    flags.pitchShift = Math.max(-1200, Math.min(1200, parseInt(tMatch[1], 10)));
  }

  const pMatch = str.match(/(?:^|[^a-zA-Z])p([+-]?\d+)/i);
  if (pMatch) {
    flags.peakCompression = Math.max(0, Math.min(100, parseInt(pMatch[1], 10)));
  }

  return flags;
}

/**
 * Format UtauFlags into standard flag string representation.
 */
export function formatUtauFlags(flags: Partial<UtauFlags>): string {
  const parts: string[] = [];
  if (flags.gender !== undefined && flags.gender !== 0) {
    parts.push(`g${flags.gender > 0 ? '+' : ''}${flags.gender}`);
  }
  if (flags.breathiness !== undefined && flags.breathiness > 0) {
    parts.push(`B${flags.breathiness}`);
  }
  if (flags.pitchShift !== undefined && flags.pitchShift !== 0) {
    parts.push(`t${flags.pitchShift > 0 ? '+' : ''}${flags.pitchShift}`);
  }
  if (flags.velocity !== undefined && flags.velocity !== 100) {
    parts.push(`vel${flags.velocity}`);
  }
  if (flags.peakCompression !== undefined && flags.peakCompression > 0) {
    parts.push(`p${flags.peakCompression}`);
  }
  if (flags.modulation !== undefined && flags.modulation !== 100) {
    parts.push(`mod${flags.modulation}`);
  }
  return parts.join('');
}
