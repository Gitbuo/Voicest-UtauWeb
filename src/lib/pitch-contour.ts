/**
 * Pitch contour generation and legato transition analysis for vocal visualization.
 * Generates high-resolution pitch curves and detects smooth legato transitions.
 */

export interface VocalNote {
  s: number;       // start in 16th steps
  l: number;       // length in 16th steps
  p: number;       // MIDI pitch
  t?: string;      // lyric / phoneme
  pc?: [number, number][]; // custom pitch points [step, pitch]
}

export interface ContourPoint {
  time: number;       // seconds
  pitch: number;      // MIDI pitch (fractional)
  hz: number;         // frequency in Hz
  noteIndex: number;  // index of active note
  isLegato: boolean;  // true if inside a legato transition zone
  lyric: string;      // syllable/lyric
}

export interface LegatoTransition {
  fromTime: number;   // seconds
  toTime: number;     // seconds
  centerTime: number; // seconds (note boundary)
  fromPitch: number;  // MIDI pitch
  toPitch: number;    // MIDI pitch
  fromLyric: string;
  toLyric: string;
}

/** Same adjacency threshold as timing.ts (ADJACENT_GAP_MS = 50 ms). */
export const ADJACENT_GAP_SEC = 0.05;

export const MIDI_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function pitchToHz(pitch: number): number {
  return 440 * Math.pow(2, (pitch - 69) / 12);
}

export function pitchToNoteName(pitch: number): string {
  const rounded = Math.round(pitch);
  const noteName = MIDI_NOTE_NAMES[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  const cents = Math.round((pitch - rounded) * 100);
  const centsStr = cents !== 0 ? (cents > 0 ? ` +${cents}c` : ` ${cents}c`) : '';
  return `${noteName}${octave}${centsStr}`;
}

/**
 * Computes high-resolution pitch contour and legato transition regions.
 */
export function generatePitchContour(
  notes: readonly VocalNote[],
  bpm = 120,
  stepResolutionMs = 5 // sample every 5ms for smooth curves
): {
  points: ContourPoint[];
  transitions: LegatoTransition[];
  timeDomain: [number, number];
  pitchDomain: [number, number];
} {
  if (!notes || !notes.length) {
    return {
      points: [],
      transitions: [],
      timeDomain: [0, 10],
      pitchDomain: [48, 72],
    };
  }

  const stepSec = 60 / bpm / 4;
  const sampleStepSec = stepResolutionMs / 1000;
  const sorted = [...notes].sort((a, b) => a.s - b.s);

  const transitions: LegatoTransition[] = [];
  const points: ContourPoint[] = [];

  // 1. Detect all adjacent legato transitions
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const prevEndSec = (prev.s + prev.l) * stepSec;
    const curStartSec = cur.s * stepSec;

    // Notes are adjacent if they touch or gap <= 50ms
    if (curStartSec - prevEndSec <= ADJACENT_GAP_SEC) {
      transitions.push({
        fromTime: Math.max(0, curStartSec - 0.025),
        toTime: curStartSec + 0.025,
        centerTime: curStartSec,
        fromPitch: prev.p,
        toPitch: cur.p,
        fromLyric: prev.t || 'a',
        toLyric: cur.t || 'a',
      });
    }
  }

  let minPitch = 127;
  let maxPitch = 0;
  const totalEndSec = (sorted[sorted.length - 1].s + sorted[sorted.length - 1].l) * stepSec + 0.1;

  // 2. Generate smooth contour across notes
  for (let idx = 0; idx < sorted.length; idx++) {
    const note = sorted[idx];
    const noteStartSec = note.s * stepSec;
    const lyric = note.t || 'a';
    const prevNote = idx > 0 ? sorted[idx - 1] : null;
    const nextNote = idx < sorted.length - 1 ? sorted[idx + 1] : null;
    const isAdjacent = prevNote ? (noteStartSec - (prevNote.s + prevNote.l) * stepSec <= ADJACENT_GAP_SEC) : false;
    const nextIsAdjacent = nextNote ? ((nextNote.s * stepSec) - (note.s + note.l) * stepSec <= ADJACENT_GAP_SEC) : false;

    // Start sampling at the transition onset (-25ms if adjacent to previous note)
    let startSampleSec = isAdjacent ? noteStartSec - 0.025 : noteStartSec;

    // End sampling where next note's transition starts (-25ms before next note start if next is adjacent)
    let endSampleSec = nextIsAdjacent
      ? (nextNote!.s * stepSec) - 0.025
      : (note.s + note.l) * stepSec;

    // Expand sampling interval if note has custom pitch curves extending before/after (e.g. breath intake/sigh)
    if (note.pc && note.pc.length > 0) {
      const minPcSec = note.pc[0][0] * stepSec;
      const maxPcSec = note.pc[note.pc.length - 1][0] * stepSec;
      startSampleSec = Math.min(startSampleSec, minPcSec);
      endSampleSec = Math.max(endSampleSec, maxPcSec);
    }

    for (let t = startSampleSec; t < endSampleSec - 1e-5; t += sampleStepSec) {
      const relSec = t - noteStartSec;
      let effectivePitch = note.p;

      // Check if inside custom pitch curve on this note
      if (note.pc && note.pc.length > 1) {
        const customStep = (t - noteStartSec) / stepSec + note.s;
        if (customStep <= note.pc[0][0]) {
          effectivePitch = note.pc[0][1];
        } else if (customStep >= note.pc[note.pc.length - 1][0]) {
          effectivePitch = note.pc[note.pc.length - 1][1];
        } else {
          let a = 0;
          while (a < note.pc.length - 2 && note.pc[a + 1][0] < customStep) a++;
          const p1 = note.pc[a];
          const p2 = note.pc[a + 1];
          const span = p2[0] - p1[0];
          const ratio = span > 0 ? (customStep - p1[0]) / span : 0;
          effectivePitch = p1[1] + (p2[1] - p1[1]) * ratio;
        }
      } else if (isAdjacent && prevNote && prevNote.p !== note.p) {
        // Automatic legato S-curve glide over [-25ms, +25ms]
        if (relSec <= -0.025) {
          effectivePitch = prevNote.p;
        } else if (relSec < 0.025) {
          const u = (relSec + 0.025) / 0.050; // 0 to 1
          const easeS = (1 - Math.cos(Math.PI * u)) / 2;
          effectivePitch = prevNote.p + (note.p - prevNote.p) * easeS;
        } else {
          effectivePitch = note.p;
        }
      }

      minPitch = Math.min(minPitch, effectivePitch);
      maxPitch = Math.max(maxPitch, effectivePitch);

      const inLegato = isAdjacent && relSec >= -0.025 && relSec <= 0.025;

      points.push({
        time: t,
        pitch: effectivePitch,
        hz: pitchToHz(effectivePitch),
        noteIndex: idx,
        isLegato: inLegato,
        lyric,
      });
    }
  }

  // Fallback defaults if notes had no pitch variation
  if (minPitch > maxPitch) {
    minPitch = 60;
    maxPitch = 64;
  }

  return {
    points,
    transitions,
    timeDomain: [0, totalEndSec],
    pitchDomain: [Math.floor(minPitch) - 2, Math.ceil(maxPitch) + 2],
  };
}
