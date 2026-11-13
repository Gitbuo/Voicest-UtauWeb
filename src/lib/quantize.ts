/**
 * Pure Quantize and Legato Timing Alignment Module for Voicest
 * 
 * In Voicest:
 * - 1 bar = 16 steps (4 beats of 4 sixteenth-notes each)
 * - 1 step = 1/16th note
 * - 2 steps = 1/8th note
 * - 4 steps = 1/4th note (1 beat)
 * - 0.5 steps = 1/32nd note
 * - 0.25 steps = 1/64th note
 * - 4/3 steps (~1.3333 steps) = 1/8th note triplet (3 notes in 4 steps)
 * - 2/3 steps (~0.6667 steps) = 1/16th note triplet (3 notes in 2 steps)
 */

export type GridResolution = '1/4' | '1/8' | '1/16' | '1/32' | '1/64' | '1/8T' | '1/16T' | number;

export interface VoicestNote {
  s: number; // start step
  l: number; // length in steps
  p: number; // pitch (MIDI note number 0-127)
  t?: string; // lyric (e.g., 'a', 'ka')
  w?: string; // display word
  pc?: [number, number][]; // pitch curve control points [[step, pitch], ...]
  al?: string; // alias
  [key: string]: any;
}

export interface QuantizeOptions {
  /**
   * Grid size in steps or string label:
   * '1/4' = 4, '1/8' = 2, '1/16' = 1, '1/32' = 0.5, '1/64' = 0.25,
   * '1/8T' = 4/3, '1/16T' = 2/3
   */
  grid?: GridResolution;
  /**
   * Whether to snap note start positions to grid
   */
  snapStart?: boolean;
  /**
   * Whether to snap note lengths to grid multiples
   */
  snapLength?: boolean;
  /**
   * Automatically close micro-gaps between consecutive notes so legato triggers smoothly
   */
  autoLegato?: boolean;
  /**
   * Maximum gap in steps to consider two notes as intended legato (default 1.0 step)
   */
  legatoThreshold?: number;
  /**
   * Prevent adjacent notes from overlapping (truncating length to next note start)
   */
  preventOverlap?: boolean;
  /**
   * Minimum note length in steps
   */
  minDuration?: number;
}

/**
 * Converts a grid resolution string or number into step units.
 */
export function gridToStep(grid: GridResolution): number {
  if (typeof grid === 'number') {
    return Math.max(0.125, grid);
  }
  switch (grid) {
    case '1/4': return 4;
    case '1/8': return 2;
    case '1/16': return 1;
    case '1/32': return 0.5;
    case '1/64': return 0.25;
    case '1/8T': return 4 / 3;
    case '1/16T': return 2 / 3;
    default: return 1;
  }
}

/**
 * Snaps a value to the nearest multiple of step size with clean floating-point precision.
 */
export function snapToGrid(value: number, stepSize: number): number {
  if (stepSize <= 0) return value;
  const snapped = Math.round(value / stepSize) * stepSize;
  // Round to 4 decimal places to eliminate IEEE 754 precision artifacts (e.g. 1.0000000000000002)
  return Math.round(snapped * 10000) / 10000;
}

/**
 * Quantizes a list of notes according to grid and legato alignment rules.
 * This guarantees adjacent fast notes have seamless transitions with zero rhythm drift.
 */
export function quantizeNotes(notes: VoicestNote[], options: QuantizeOptions = {}): VoicestNote[] {
  if (!notes || notes.length === 0) return [];

  const gridStep = gridToStep(options.grid ?? '1/16');
  const snapStart = options.snapStart ?? true;
  const snapLength = options.snapLength ?? true;
  const autoLegato = options.autoLegato ?? true;
  const legatoThreshold = options.legatoThreshold ?? Math.max(1.0, gridStep);
  const preventOverlap = options.preventOverlap ?? true;
  const minDuration = options.minDuration ?? Math.min(1.0, gridStep);

  // Deep clone notes and sort by start step
  const sorted: VoicestNote[] = notes.map(n => ({
    ...n,
    pc: n.pc ? n.pc.map(pt => [...pt] as [number, number]) : undefined
  })).sort((a, b) => a.s - b.s || a.p - b.p);

  // Step 1: Snap individual note start and length
  for (let i = 0; i < sorted.length; i++) {
    const note = sorted[i];
    const origStart = note.s;

    if (snapStart) {
      note.s = Math.max(0, snapToGrid(note.s, gridStep));
    }

    if (snapLength) {
      const snappedLen = snapToGrid(note.l, gridStep);
      note.l = Math.max(minDuration, snappedLen);
    } else {
      note.l = Math.max(minDuration, note.l);
    }

    // Shift pitch curve points if note start changed
    if (note.pc && note.pc.length > 0 && note.s !== origStart) {
      const delta = note.s - origStart;
      note.pc = note.pc.map(([st, pt]) => [
        Math.round((st + delta) * 10000) / 10000,
        pt
      ]);
    }
  }

  // Step 2: Auto-Legato alignment & Overlap resolution between consecutive notes
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];

    const curEnd = cur.s + cur.l;
    const gap = next.s - curEnd;

    // If there is an overlap (gap < 0)
    if (gap < -1e-4) {
      if (preventOverlap) {
        // Truncate current note so it ends exactly where next note begins
        const newLen = Math.max(minDuration, next.s - cur.s);
        cur.l = Math.round(newLen * 10000) / 10000;
      }
    } 
    // If there is a small gap within legato threshold, close it for seamless legato
    else if (autoLegato && gap > 1e-4 && gap <= legatoThreshold + 1e-4) {
      // Extend current note length to meet next note onset seamlessly
      cur.l = Math.round((next.s - cur.s) * 10000) / 10000;
    }
  }

  return sorted;
}

/**
 * Specifically aligns note boundaries so adjacent notes have zero gap and zero overlap,
 * allowing Voicest's 50ms S-curve legato glide to trigger flawlessly.
 */
export function alignLegatoNotes(notes: VoicestNote[], maxGapSteps: number = 1.0): VoicestNote[] {
  return quantizeNotes(notes, {
    snapStart: false,
    snapLength: false,
    autoLegato: true,
    legatoThreshold: maxGapSteps,
    preventOverlap: true
  });
}
