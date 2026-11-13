/**
 * Automatic Legato Pitch & Portamento model based on UTAU / OpenUTAU / WebTau.
 * Handles continuous pitch transition when adjacent notes meet.
 */

export const ENTRY_GLIDE_MS = 50; // standard UTAU portamento window (centered on note onset)
export const ENTRY_REACH_MS = 1000;

export interface PitchGlideParams {
  prevPitch: number;      // MIDI pitch of previous note (e.g. 60)
  curPitch: number;       // MIDI pitch of current note (e.g. 64)
  noteStartMs: number;    // start of current note in ms
  preutterMs: number;     // lead-in before note start in ms
  isAdjacent: boolean;    // true if previous note ends right before current note
}

/**
 * Calculates effective MIDI pitch at absolute time taMs.
 */
export function getLegatoPitch(
  taMs: number,
  params: PitchGlideParams,
  customCurve?: (relMs: number) => number | null
): number {
  const { prevPitch, curPitch, noteStartMs, isAdjacent } = params;
  const relMs = taMs - noteStartMs;

  // Custom user-drawn pitch points or curve takes precedence if specified
  if (customCurve) {
    const custom = customCurve(relMs);
    if (custom != null && isFinite(custom)) {
      return custom;
    }
  }

  // If there is no previous adjacent note, pitch is current note pitch
  if (!isAdjacent || prevPitch === curPitch) {
    return curPitch;
  }

  const halfWindow = ENTRY_GLIDE_MS / 2; // 25ms

  // Preutterance before glide window: sounds at previous note pitch
  if (relMs <= -halfWindow) {
    return prevPitch;
  }

  // Post-glide window: sounds at current note pitch
  if (relMs >= halfWindow) {
    return curPitch;
  }

  // Smooth S-curve (cosine easing) across [-25ms, +25ms] centered on note onset
  const t = (relMs + halfWindow) / ENTRY_GLIDE_MS; // 0 to 1
  const easeS = (1 - Math.cos(Math.PI * t)) / 2;
  return prevPitch + (curPitch - prevPitch) * easeS;
}
