/**
 * Timing model for vocal notes based on WebTau / UTAU engine.
 * Computes exact preutterance, overlap, cross-fade and tail adjustments
 * for adjacent and short/fast notes.
 */

export interface TimingInput {
  start: number;     // ms
  duration: number;  // ms
  preutter: number;  // ms
  overlap: number;   // ms
}

export interface NoteTiming {
  preutter: number;    // effective preutterance, ms
  overlap: number;     // effective overlap, ms
  fade_in: number;     // fade-in duration, ms
  tail_adjust: number; // adjustment added to duration for sound end, ms
  fade_out: number;    // fade-out duration, ms
}

/** Two notes no further apart than this (ms) are considered adjacent/legato — shared by the engine and the F0 chart. */
export const ADJACENT_GAP_MS = 50.0;
export const DEFAULT_FADE_IN_MS = 5.0;
export const DEFAULT_FADE_OUT_MS = 35.0;

export function computeTiming(inputs: readonly TimingInput[]): NoteTiming[] {
  const out: NoteTiming[] = inputs.map(input => ({
    preutter: Math.max(0, input.preutter),
    overlap: input.overlap,
    fade_in: DEFAULT_FADE_IN_MS,
    tail_adjust: 0.0,
    fade_out: DEFAULT_FADE_OUT_MS,
  }));

  for (let idx = 1; idx < inputs.length; idx++) {
    const cur = inputs[idx];
    const prev = inputs[idx - 1];
    const prev_pre = out[idx - 1].preutter;
    const gap = cur.start - (prev.start + prev.duration);
    const adjacent = gap <= ADJACENT_GAP_MS;
    let pre = Math.max(0, cur.preutter);
    let overlap = cur.overlap;
    let max_pre = pre;

    if (adjacent) {
      if (overlap > 0.0 && pre - overlap > prev.duration * 0.5) {
        max_pre = (prev.duration * 0.5 / (pre - overlap)) * pre;
      }
      max_pre = Math.min(max_pre, prev.duration);
      if (prev_pre < 5.0) {
        max_pre = Math.min(max_pre, prev.duration + prev_pre - 5.0);
      }
    } else if (gap < pre) {
      // Small gap: consonant can fill gap but not intrude into previous note
      max_pre = gap;
    }

    max_pre = Math.max(0, max_pre);
    if (pre > max_pre) {
      const ratio = pre > 0 ? max_pre / pre : 0;
      pre = max_pre;
      overlap *= ratio;
    }

    if (overlap < 0.0) {
      overlap = Math.max(overlap, Math.min(0, 35.0 - prev.duration + pre));
    }
    if (prev.duration - pre < 5.0) {
      overlap = Math.max(overlap, 5.0 - (prev.duration - pre));
    }

    const overlapped = adjacent && overlap > 0.0;
    out[idx].preutter = pre;
    out[idx].overlap = overlap;
    out[idx].fade_in = overlapped ? overlap : DEFAULT_FADE_IN_MS;

    const tail_intrude = adjacent ? Math.max(pre, pre - overlap) : 0.0;
    const tail_overlap = adjacent ? Math.max(0.0, overlap) : 0.0;
    const cut = adjacent ? gap : 0.0;
    out[idx - 1].tail_adjust = cut - tail_intrude + tail_overlap;
    out[idx - 1].fade_out = overlapped ? tail_overlap : DEFAULT_FADE_OUT_MS;
  }

  return out;
}

/** Sound end relative to note start, in ms */
export function getEndMs(duration: number, timing: NoteTiming): number {
  return Math.max(5.0, duration + timing.tail_adjust);
}
