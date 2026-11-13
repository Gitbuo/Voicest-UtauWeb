/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * 10 Smart Vocal & DAW Features for Voicest:
 * 1. Smart Breath & Aspiration Inhaler (detects phrasing gaps & inserts natural breath intake)
 * 2. Smart Organic Micro-Pitch Flutter (subtle human laryngeal flutter for sustained notes)
 * 3. Smart Modal Vocal Harmonizer (musical diatonic scale harmonies: 3rd above, 3rd below, 6th)
 * 4. Smart Dynamic De-Esser (suppresses harsh sibilant bursts in s, sh, ch, ts)
 * 5. Smart Humanize Groove & Dynamics (micro-timing & metric downbeat accentuation)
 * 6. Smart Pitch Bend Snapper & Natural Portamento (S-curve transitions with laryngeal inertia)
 * 7. Smart Vocal Tract Length & Throat Resonance (acoustic formant dispersion model)
 * 8. Smart Stereo Vocal Doubler & Spatial Spreader (binaural Haas delay & micro-detune)
 * 9. Smart Phoneme Golden-Ratio Equalizer (optimal consonant-vowel duration balance)
 * 10. Smart Warm Tube Saturation & Air Band Exciter (analog warmth & studio high-shelf sheen)
 */

export interface NoteLike {
  s: number; // start in steps (1 step = 1/16 note typically)
  l: number; // length in steps
  p: number; // MIDI pitch number (e.g. 60 = C4)
  t?: string; // lyrics or phoneme
  w?: string; // word / romaji
  v?: number; // velocity / volume (0..1)
}

// -------------------------------------------------------------
// 1. Smart Breath & Aspiration Inhaler
// -------------------------------------------------------------
export interface PhraseClassification {
  noteCount: number;
  category: 'long' | 'medium' | 'short';
  targetInhaleSec: number;
}

export function classifyPhrase(noteCount: number): PhraseClassification {
  if (noteCount >= 25) {
    return { noteCount, category: 'long', targetInhaleSec: 0.75 };
  }
  if (noteCount >= 10) {
    return { noteCount, category: 'medium', targetInhaleSec: 0.55 };
  }
  return { noteCount, category: 'short', targetInhaleSec: 0.35 };
}

export interface SmartVocalBreath {
  type: 'in' | 'out'; // 'in' = inhalation (thở vào), 'out' = exhalation (thở ra)
  step: number;
  durationSteps: number;
  timeSec: number;
  durationSec: number;
  intensity: number; // Gentle / light intensity: 0.25 - 0.35
  lyric: 'br' | 'br_out';
  pitch: number;
}

export interface DetectCestloidBreathsOptions {
  stepDurationSec: number;
  phraseGapSecThreshold?: number; // default 0.75s: gaps >= threshold delimit phrases
  minInhaleRoomSec?: number; // min room before phrase to insert intake (default 0.08s)
}

/**
 * Smart Breath & Aspiration Inhaler / Exhaler for Cestloid:
 * - Inhale before long phrases (25+ notes): 0.5s gentle breath
 * - Inhale before medium phrases (10-24 notes): 0.35s gentle breath
 * - Inhale before short phrases (1-9 notes): 0.2s gentle breath
 * - Exhale short (0.2s) if next phrase is 2-3s later
 * - Exhale long (0.5s) if no notes for >= 10s or end of phrase/song
 * - All breaths are gentle/soft (< 0.40 intensity)
 */
export function detectCestloidBreaths(
  notes: readonly NoteLike[],
  options: DetectCestloidBreathsOptions,
): SmartVocalBreath[] {
  if (!notes || notes.length === 0) return [];
  const stepDurationSec = Math.max(0.001, options.stepDurationSec);
  const phraseGapSecThreshold = options.phraseGapSecThreshold ?? 0.75;
  const minInhaleRoomSec = options.minInhaleRoomSec ?? 0.08;

  // Filter out existing breath notes to avoid double-processing
  const singingNotes = notes
    .filter((n) => !/^(br|br_in|br_out|breath)$/i.test(n.t || ''))
    .sort((a, b) => a.s - b.s);

  if (singingNotes.length === 0) return [];

  // 1. Group notes into phrases based on inter-note gap
  const phrases: NoteLike[][] = [];
  let currentPhrase: NoteLike[] = [singingNotes[0]];

  for (let i = 1; i < singingNotes.length; i++) {
    const prev = singingNotes[i - 1];
    const curr = singingNotes[i];
    const prevEndSec = (prev.s + prev.l) * stepDurationSec;
    const currStartSec = curr.s * stepDurationSec;
    const gapSec = currStartSec - prevEndSec;

    if (gapSec >= phraseGapSecThreshold) {
      phrases.push(currentPhrase);
      currentPhrase = [curr];
    } else {
      currentPhrase.push(curr);
    }
  }
  if (currentPhrase.length > 0) {
    phrases.push(currentPhrase);
  }

  const result: SmartVocalBreath[] = [];

  for (let pIdx = 0; pIdx < phrases.length; pIdx++) {
    const phrase = phrases[pIdx];
    const firstNote = phrase[0];
    const lastNote = phrase[phrase.length - 1];
    const phraseStartSec = firstNote.s * stepDurationSec;
    const phraseEndSec = (lastNote.s + lastNote.l) * stepDurationSec;

    // --- INHALATION (Thở vào) ---
    const classification = classifyPhrase(phrase.length);
    const targetInhaleSec = classification.targetInhaleSec;

    // Compute available room before phrase
    let availableRoomBeforeSec = phraseStartSec;
    if (pIdx > 0) {
      const prevPhrase = phrases[pIdx - 1];
      const prevLast = prevPhrase[prevPhrase.length - 1];
      const prevEndSec = (prevLast.s + prevLast.l) * stepDurationSec;
      availableRoomBeforeSec = phraseStartSec - prevEndSec;
      // Account for previous phrase's exhalation if it exists
      const prevGapSec = phraseStartSec - prevEndSec;
      if (prevGapSec >= 1.8 && prevGapSec < 10) {
        availableRoomBeforeSec -= 0.25; // 0.2s out + 0.05s buffer
      } else if (prevGapSec >= 10) {
        availableRoomBeforeSec -= 0.6; // 0.5s out + 0.1s buffer
      }
    }

    if (availableRoomBeforeSec >= minInhaleRoomSec) {
      const inhaleDurSec = Math.min(targetInhaleSec, Math.max(minInhaleRoomSec, availableRoomBeforeSec * 0.9));
      const durSteps = Math.max(0.5, Math.round((inhaleDurSec / stepDurationSec) * 100) / 100);
      const startStep = Math.max(0, +(firstNote.s - durSteps).toFixed(2));
      result.push({
        type: 'in',
        step: startStep,
        durationSteps: durSteps,
        timeSec: +(startStep * stepDurationSec).toFixed(3),
        durationSec: +(durSteps * stepDurationSec).toFixed(3),
        intensity: 0.32, // clearly audible, natural, yet gentle intake breath (<= 0.35)
        lyric: 'br',
        pitch: Math.max(36, firstNote.p - 7),
      });
    }

    // --- EXHALATION (Thở ra) ---
    // If next phrase is in 2-3s (or up to <10s) -> 0.2s outtake breath
    // If next phrase is >= 10s or last phrase -> 0.5s outtake breath
    let gapToNextSec = 999; // effectively no next note
    if (pIdx < phrases.length - 1) {
      const nextPhrase = phrases[pIdx + 1];
      const nextStartSec = nextPhrase[0].s * stepDurationSec;
      gapToNextSec = nextStartSec - phraseEndSec;
    }

    let outDurSec = 0;
    if (gapToNextSec >= 10) {
      outDurSec = 0.75; // 10s or end of song: extended sustained exhale 0.75s
    } else if (gapToNextSec >= 1.8 && gapToNextSec < 10) {
      outDurSec = 0.35; // 2-3s gap: extended exhale 0.35s
    }

    if (outDurSec > 0) {
      const durSteps = Math.max(0.5, Math.round((outDurSec / stepDurationSec) * 100) / 100);
      const startStep = +(lastNote.s + lastNote.l).toFixed(2);
      result.push({
        type: 'out',
        step: startStep,
        durationSteps: durSteps,
        timeSec: +(startStep * stepDurationSec).toFixed(3),
        durationSec: +(durSteps * stepDurationSec).toFixed(3),
        intensity: 0.26, // clearly audible gentle exhalation sigh (<= 0.35)
        lyric: 'br_out',
        pitch: Math.max(36, lastNote.p - 9),
      });
    }
  }

  return result.sort((a, b) => a.step - b.step);
}

export function applyCestloidBreathsToNotes(
  notes: readonly NoteLike[],
  stepDurationSec: number,
  options?: Omit<DetectCestloidBreathsOptions, 'stepDurationSec'>,
): NoteLike[] {
  const breaths = detectCestloidBreaths(notes, { ...options, stepDurationSec });
  // Keep original non-breath notes
  const preserved = notes.filter((n) => !/^(br|br_in|br_out|breath)$/i.test(n.t || ''));
  const newBreathNotes: NoteLike[] = breaths.map((b) => ({
    s: b.step,
    l: b.durationSteps,
    p: b.pitch,
    t: b.lyric,
    v: b.intensity,
  }));
  return [...preserved, ...newBreathNotes].sort((a, b) => a.s - b.s);
}

/**
 * Expresses breath inhalation and exhalation directly as pitch tuning curves (pc)
 * on the melody notes rather than creating separate note blocks (xóa nốt thở đi).
 */
export function applyBreathPitchTuning(
  notes: readonly (NoteLike & { pc?: [number, number][] })[],
  stepDurationSec: number,
  options?: Omit<DetectCestloidBreathsOptions, 'stepDurationSec'>,
): (NoteLike & { pc?: [number, number][] })[] {
  // 1. Remove separate breath notes (xóa nốt đi)
  const cleanNotes = notes
    .filter((n) => !/^(br|br_in|br_out|breath)$/i.test(n.t || ''))
    .map((n) => ({ ...n, pc: n.pc ? n.pc.map(([s, p]) => [s, p] as [number, number]) : undefined }))
    .sort((a, b) => a.s - b.s);

  if (cleanNotes.length === 0) return [];

  const breaths = detectCestloidBreaths(cleanNotes, { ...options, stepDurationSec });

  // Map each breath to the appropriate phrase note's pitch curve
  for (const b of breaths) {
    if (b.type === 'in') {
      const target = cleanNotes.find(
        (n) => Math.abs(n.s - (b.step + b.durationSteps)) < 0.25 || (n.s >= b.step && n.s <= b.step + b.durationSteps + 0.1),
      );
      if (target) {
        const existing = target.pc || [
          [target.s, target.p],
          [target.s + target.l, target.p],
        ];
        const inPts: [number, number][] = [
          [b.step, +(target.p - 1.4).toFixed(2)],
          [+(b.step + b.durationSteps * 0.5).toFixed(2), +(target.p - 0.9).toFixed(2)],
          [+(b.step + b.durationSteps * 0.85).toFixed(2), +(target.p - 0.2).toFixed(2)],
          [target.s, target.p],
        ];
        const filtered = existing.filter((p) => p[0] > target.s + 1e-4);
        target.pc = [...inPts, ...filtered].sort((x, y) => x[0] - y[0]);
      }
    } else if (b.type === 'out') {
      const target = cleanNotes.find((n) => Math.abs(n.s + n.l - b.step) < 0.25);
      if (target) {
        const existing = target.pc || [
          [target.s, target.p],
          [target.s + target.l, target.p],
        ];
        const outPts: [number, number][] = [
          [target.s + target.l, target.p],
          [+(b.step + b.durationSteps * 0.35).toFixed(2), +(target.p - 0.4).toFixed(2)],
          [+(b.step + b.durationSteps * 0.75).toFixed(2), +(target.p - 1.2).toFixed(2)],
          [+(b.step + b.durationSteps).toFixed(2), +(target.p - 1.8).toFixed(2)],
        ];
        const filtered = existing.filter((p) => p[0] < target.s + target.l - 1e-4);
        target.pc = [...filtered, ...outPts].sort((x, y) => x[0] - y[0]);
      }
    }
  }

  return cleanNotes;
}

export interface BreathPoint {
  step: number;
  timeSec: number;
  durationSec: number;
  intensity: number;
}

// Retained for backward compatibility
export function detectPhraseBreaths(
  notes: readonly NoteLike[],
  stepDurationSec: number,
  minRestSteps = 2,
  maxBreathSec = 0.22,
): BreathPoint[] {
  if (!notes || notes.length === 0) return [];
  const breaths = detectCestloidBreaths(notes, { stepDurationSec });
  return breaths
    .filter((b) => b.type === 'in')
    .map((b) => ({
      step: b.step,
      timeSec: b.timeSec,
      durationSec: b.durationSec,
      intensity: b.intensity,
    }));
}

// -------------------------------------------------------------
// 2. Smart Organic Micro-Pitch Flutter
// -------------------------------------------------------------
export function calculateMicroPitchFlutter(
  timeSec: number,
  basePitch: number,
  intensityCents = 6,
  rateHz = 2.8,
): number {
  if (intensityCents <= 0) return basePitch;
  // Natural human vocal cords fluctuate with dual low-frequency waves + a subtle chaotic drift
  const wave1 = Math.sin(2 * Math.PI * rateHz * timeSec);
  const wave2 = 0.35 * Math.sin(2 * Math.PI * (rateHz * 1.618) * timeSec + 0.4);
  const wave3 = 0.15 * Math.sin(2 * Math.PI * 0.85 * timeSec);
  const totalDriftCents = (wave1 + wave2 + wave3) * (intensityCents / 1.5);
  // Convert cents to semitones (1 semitone = 100 cents)
  return basePitch + totalDriftCents / 100;
}

// -------------------------------------------------------------
// 3. Smart Modal Vocal Harmonizer
// -------------------------------------------------------------
export type ScaleMode = 'major' | 'minor' | 'pentatonic' | 'chromatic';
export type HarmonyInterval = 'third_above' | 'third_below' | 'sixth_above' | 'octave_above' | 'octave_below';

const SCALE_INTERVALS: Record<ScaleMode, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export function calculateSmartHarmony(
  notes: readonly NoteLike[],
  interval: HarmonyInterval,
  rootNote = 0, // 0 = C, 1 = C#, 2 = D...
  scale: ScaleMode = 'major',
): NoteLike[] {
  const scaleDeg = SCALE_INTERVALS[scale] || SCALE_INTERVALS.major;

  return notes.map((n) => {
    let targetPitch = n.p;
    if (interval === 'octave_above') {
      targetPitch += 12;
    } else if (interval === 'octave_below') {
      targetPitch -= 12;
    } else {
      // Find nearest scale degree relative to root
      const semitoneInOct = ((n.p - rootNote) % 12 + 12) % 12;
      const octaveBase = Math.floor((n.p - rootNote) / 12) * 12 + rootNote;

      let closestIdx = 0;
      let minDiff = 999;
      for (let i = 0; i < scaleDeg.length; i++) {
        const diff = Math.abs(scaleDeg[i] - semitoneInOct);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = i;
        }
      }

      let degreeShift = 2; // Default 3rd above (step index + 2)
      if (interval === 'third_below') degreeShift = -2;
      else if (interval === 'sixth_above') degreeShift = 5;

      const targetDegIdx = closestIdx + degreeShift;
      const targetOctaveShift = Math.floor(targetDegIdx / scaleDeg.length);
      const wrappedIdx = ((targetDegIdx % scaleDeg.length) + scaleDeg.length) % scaleDeg.length;

      targetPitch = octaveBase + targetOctaveShift * 12 + scaleDeg[wrappedIdx];
    }

    return {
      ...n,
      p: Math.max(24, Math.min(108, targetPitch)),
    };
  });
}

// -------------------------------------------------------------
// 4. Smart Dynamic De-Esser
// -------------------------------------------------------------
const SIBILANT_REGEX = /^(s|sh|ch|ts|z|j|c)/i;

export function isSibilantPhoneme(lyricOrPhoneme?: string): boolean {
  if (!lyricOrPhoneme) return false;
  const clean = lyricOrPhoneme.replace(/^[~_\-\s]+/, '').toLowerCase();
  return SIBILANT_REGEX.test(clean);
}

export function applyDeEsserGain(
  sample: number,
  isSibilant: boolean,
  threshold = 0.45,
  maxReduction = 0.55,
): number {
  if (!isSibilant) return sample;
  const abs = Math.abs(sample);
  if (abs <= threshold) return sample;
  // Soft compression curve over threshold
  const excess = abs - threshold;
  const reduction = Math.min(maxReduction, excess * 0.7);
  const factor = 1 - reduction;
  return sample * factor;
}

// -------------------------------------------------------------
// 5. Smart Humanize Groove & Dynamics
// -------------------------------------------------------------
export function applySmartHumanize(
  notes: readonly NoteLike[],
  timingJitterTicks = 0.15, // fraction of step
  dynamicsAmount = 0.12,
  seed = 42,
): NoteLike[] {
  let rng = seed;
  const random = () => {
    rng = (rng * 1664525 + 1013904223) % 4294967296;
    return rng / 4294967296;
  };

  return notes.map((n) => {
    // Metric hierarchy: beat 1 (step%16===0) & beat 3 (step%16===8) are strong
    const beat16 = Math.round(n.s) % 16;
    const isDownbeat = beat16 === 0;
    const isMidbeat = beat16 === 8;
    const isOffbeat = beat16 % 4 !== 0;

    let metricWeight = 1.0;
    if (isDownbeat) metricWeight += dynamicsAmount * 0.9;
    else if (isMidbeat) metricWeight += dynamicsAmount * 0.45;
    else if (isOffbeat) metricWeight -= dynamicsAmount * 0.55;

    // Small jitter
    const jitter = (random() - 0.5) * 2 * timingJitterTicks;
    const newStart = Math.max(0, +(n.s + jitter).toFixed(3));

    // Dynamic velocity
    const baseVel = n.v ?? 0.75;
    const newVel = Math.max(0.2, Math.min(1.0, +(baseVel * metricWeight).toFixed(3)));

    return {
      ...n,
      s: newStart,
      v: newVel,
    };
  });
}

// -------------------------------------------------------------
// 6. Smart Pitch Bend Snapper & Natural Portamento
// -------------------------------------------------------------
export function calculatePortamentoGlide(
  pitchFrom: number,
  pitchTo: number,
  transitionDurationMs = 85,
  steps = 10,
): { timeMs: number; pitch: number }[] {
  const result: { timeMs: number; pitch: number }[] = [];
  const semitoneDelta = pitchTo - pitchFrom;
  const absDelta = Math.abs(semitoneDelta);

  // Scaled duration: larger pitch leaps take slightly longer due to physical vocal fold inertia
  const effectiveDurationMs = Math.max(
    40,
    Math.min(180, transitionDurationMs * (1 + Math.min(0.6, absDelta * 0.05))),
  );

  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    // Human S-curve transition with smooth acceleration and deceleration
    const sCurve = 0.5 * (1 - Math.cos(Math.PI * u));
    const currentPitch = +(pitchFrom + semitoneDelta * sCurve).toFixed(3);
    result.push({
      timeMs: Math.round(u * effectiveDurationMs),
      pitch: currentPitch,
    });
  }

  return result;
}

// -------------------------------------------------------------
// 7. Smart Vocal Tract Length & Throat Resonance
// -------------------------------------------------------------
export function calculateFormantShiftFactors(
  vocalTractLengthRatio = 1.0, // 0.85 (child/feminine) to 1.15 (deep/masculine)
): { f1Mult: number; f2Mult: number; f3Mult: number } {
  // Acoustic physics: formant frequencies are inversely proportional to vocal tract length
  const clampedRatio = Math.max(0.75, Math.min(1.3, vocalTractLengthRatio));
  const baseShift = 1 / clampedRatio;
  return {
    f1Mult: +(baseShift ** 0.92).toFixed(4),
    f2Mult: +(baseShift ** 1.0).toFixed(4),
    f3Mult: +(baseShift ** 1.05).toFixed(4),
  };
}

// -------------------------------------------------------------
// 8. Smart Stereo Vocal Doubler & Spatial Spreader
// -------------------------------------------------------------
export function calculateStereoDoublerParams(
  spreadRatio = 0.65, // 0..1
): { leftDelayMs: number; rightDelayMs: number; leftDetuneCents: number; rightDetuneCents: number } {
  const clamped = Math.max(0, Math.min(1, spreadRatio));
  return {
    leftDelayMs: +(12 * clamped).toFixed(2),
    rightDelayMs: +(22 * clamped).toFixed(2),
    leftDetuneCents: +(-5.5 * clamped).toFixed(2),
    rightDetuneCents: +(5.5 * clamped).toFixed(2),
  };
}

// -------------------------------------------------------------
// 9. Smart Phoneme Golden-Ratio Equalizer
// -------------------------------------------------------------
export function balancePhonemeRatio(
  rawConsonantMs: number,
  totalNoteDurationMs: number,
  idealRatio = 0.28, // consonant takes up to ~28% of total duration on normal notes
): { consonantMs: number; vowelMs: number } {
  const safeTotal = Math.max(20, totalNoteDurationMs);
  // Cap consonant duration on fast notes so the vowel has enough room to sound clearly
  const maxConsonantMs = safeTotal * 0.42;
  const minConsonantMs = Math.min(30, safeTotal * 0.15);
  const targetConsonantMs = Math.max(minConsonantMs, Math.min(rawConsonantMs, maxConsonantMs));
  const consonantMs = Math.round(Math.min(targetConsonantMs, safeTotal * idealRatio + 15));
  const vowelMs = Math.max(10, safeTotal - consonantMs);

  return { consonantMs, vowelMs };
}

// -------------------------------------------------------------
// 10. Smart Warm Tube Saturation & Air Band Exciter
// -------------------------------------------------------------
export function applyTubeSaturation(sample: number, drive = 0.25): number {
  if (drive <= 0) return Math.max(-1, Math.min(1, sample));
  // Warm soft-knee analog saturation: tanh with subtle 2nd-order even harmonic warmth
  const x = sample * (1 + drive * 1.5);
  const evenHarmonic = 0.08 * drive * (x * x - 0.5);
  const saturated = Math.tanh(x) + evenHarmonic;
  // Normalize output gain to avoid clipping
  return Math.max(-1, Math.min(1, saturated / (1 + drive * 0.4)));
}

export function applyAirBandExciter(sample: number, airAmount = 0.18): number {
  if (airAmount <= 0) return sample;
  // High-frequency harmonic excitement (>10kHz air presence)
  const highSheen = (sample - Math.tanh(sample * 0.9)) * airAmount * 1.2;
  return Math.max(-1, Math.min(1, sample + highSheen));
}
