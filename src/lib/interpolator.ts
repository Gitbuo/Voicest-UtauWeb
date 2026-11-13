/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * Interpolator module inspired by Straycat & Rust-WORLD
 * Provides smooth curve mathematics for pitch bends and legato portamento.
 */

/**
 * WebTau Cosine S-Curve interpolation between p0 and p1 for u in [0, 1].
 * Yields continuous 0 velocity at start and end.
 */
export function sCurveCosineInterpolate(p0: number, p1: number, u: number): number {
  const clampedU = Math.max(0, Math.min(1, u));
  const w = (1 - Math.cos(Math.PI * clampedU)) * 0.5;
  return p0 + (p1 - p0) * w;
}

/**
 * 4-Point Catmull-Rom cubic spline interpolation.
 * p0, p1, p2, p3 are control points; interpolates between p1 and p2 for u in [0, 1].
 */
export function catmullRomInterpolate(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  u: number
): number {
  const clampedU = Math.max(0, Math.min(1, u));
  const u2 = clampedU * clampedU;
  const u3 = u2 * clampedU;

  const v0 = (p2 - p0) * 0.5;
  const v1 = (p3 - p1) * 0.5;

  return (
    (2 * p1 - 2 * p2 + v0 + v1) * u3 +
    (-3 * p1 + 3 * p2 - 2 * v0 - v1) * u2 +
    v0 * clampedU +
    p1
  );
}

/**
 * Cubic Hermite interpolation with explicit start & end tangents.
 */
export function hermiteInterpolate(
  p0: number,
  p1: number,
  m0: number,
  m1: number,
  u: number
): number {
  const clampedU = Math.max(0, Math.min(1, u));
  const u2 = clampedU * clampedU;
  const u3 = u2 * clampedU;

  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + clampedU;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;

  return h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1;
}

/**
 * Generates an interpolated pitch trajectory between two notes with a defined transition window.
 * Default transition window is 50ms (0.050 seconds), symmetrical ±25ms around boundary.
 */
export function generateLegatoPitchTrajectory(
  boundaryTimeSec: number,
  fromPitch: number,
  toPitch: number,
  windowSec: number = 0.05,
  sampleIntervalSec: number = 0.005
): Array<{ time: number; pitch: number }> {
  const halfWindow = windowSec * 0.5;
  const startTime = boundaryTimeSec - halfWindow;
  const endTime = boundaryTimeSec + halfWindow;
  const trajectory: Array<{ time: number; pitch: number }> = [];

  for (let t = startTime; t <= endTime + 1e-6; t += sampleIntervalSec) {
    const u = (t - startTime) / windowSec;
    const pitch = sCurveCosineInterpolate(fromPitch, toPitch, u);
    trajectory.push({
      time: Math.round(t * 1000) / 1000,
      pitch: Math.round(pitch * 100) / 100,
    });
  }

  return trajectory;
}
