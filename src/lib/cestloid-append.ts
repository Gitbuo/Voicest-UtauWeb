/**
 * @license
 * SPDX-License-Identifier: MIT
 * 
 * Cestloid Vocal Append Architecture
 * Defines all timbre presets (Appends) for the Cestloid singing synthesis engine:
 * Default, Female (Child), Mature, Weak, Clear, Power, Whisper, and Robot.
 */

export interface CestloidVoiceParams {
  append: string;
  b: number;    // Brightness (0..1)
  br: number;   // Breathiness (0..1)
  v: number;    // Vibrato (0..1)
  f: number;    // Formant shift (0.7..1.4)
  g: number;    // Gender factor (-1..1)
  t: number;    // Glottal tension (0..1)
  cl: number;   // Phonetic clarity (0.5..1.0)
  pre: number;  // Preutterance timing factor
  asp: number;  // Aspiration noise factor
}

export interface CestloidAppendPreset extends CestloidVoiceParams {
  id: string;
  index: number;
  labelKey: string;
}

export const CESTLOID_APPENDS: CestloidAppendPreset[] = [
  {
    id: 'default',
    index: 0,
    append: 'default',
    labelKey: 'app_default',
    b: 0.55,
    br: 0.10,
    v: 0.40,
    f: 1.00,
    g: 0.00,
    t: 0.55,
    cl: 0.85,
    pre: 0.48,
    asp: 0.42,
  },
  {
    id: 'female',
    index: 1,
    append: 'child',
    labelKey: 'app_female',
    b: 0.72,
    br: 0.12,
    v: 0.32,
    f: 1.22,
    g: 0.55,
    t: 0.48,
    cl: 0.90,
    pre: 0.42,
    asp: 0.35,
  },
  {
    id: 'mature',
    index: 2,
    append: 'mature',
    labelKey: 'app_mature',
    b: 0.52,
    br: 0.08,
    v: 0.52,
    f: 0.90,
    g: -0.45,
    t: 0.72,
    cl: 0.82,
    pre: 0.52,
    asp: 0.40,
  },
  {
    id: 'weak',
    index: 3,
    append: 'weak',
    labelKey: 'app_weak',
    b: 0.38,
    br: 0.38,
    v: 0.28,
    f: 1.04,
    g: 0.10,
    t: 0.22,
    cl: 0.75,
    pre: 0.40,
    asp: 0.28,
  },
  {
    id: 'clear',
    index: 4,
    append: 'clear',
    labelKey: 'app_clear',
    b: 0.75,
    br: 0.04,
    v: 0.38,
    f: 1.00,
    g: 0.00,
    t: 0.82,
    cl: 1.00,
    pre: 0.50,
    asp: 0.45,
  },
  {
    id: 'power',
    index: 5,
    append: 'power',
    labelKey: 'app_power',
    b: 0.82,
    br: 0.05,
    v: 0.48,
    f: 0.96,
    g: -0.15,
    t: 0.92,
    cl: 0.92,
    pre: 0.55,
    asp: 0.50,
  },
  {
    id: 'whisper',
    index: 6,
    append: 'whisper',
    labelKey: 'app_whisper',
    b: 0.32,
    br: 0.68,
    v: 0.15,
    f: 1.02,
    g: 0.15,
    t: 0.15,
    cl: 0.70,
    pre: 0.38,
    asp: 0.55,
  },
  {
    id: 'robot',
    index: 7,
    append: 'robot',
    labelKey: 'app_robot',
    b: 0.80,
    br: 0.02,
    v: 0.00,
    f: 1.00,
    g: 0.00,
    t: 0.95,
    cl: 1.00,
    pre: 0.35,
    asp: 0.10,
  },
];

/**
 * Get Cestloid append preset by index (0..7) or string id.
 */
export function getCestloidAppend(keyOrIndex: string | number): CestloidAppendPreset {
  if (typeof keyOrIndex === 'number') {
    return CESTLOID_APPENDS[keyOrIndex] || CESTLOID_APPENDS[0];
  }
  const clean = String(keyOrIndex).toLowerCase().trim();
  const match = CESTLOID_APPENDS.find(
    (a) => a.id === clean || a.append === clean || String(a.index) === clean
  );
  return match || CESTLOID_APPENDS[0];
}

/**
 * Applies a Cestloid Append preset to an existing voice parameter set.
 */
export function applyCestloidAppend(
  current: Partial<CestloidVoiceParams>,
  keyOrIndex: string | number
): CestloidVoiceParams {
  const preset = getCestloidAppend(keyOrIndex);
  return {
    ...current,
    append: preset.append,
    b: preset.b,
    br: preset.br,
    v: preset.v,
    f: preset.f,
    g: preset.g,
    t: preset.t,
    cl: preset.cl,
    pre: preset.pre,
    asp: preset.asp,
  };
}
