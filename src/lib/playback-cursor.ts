/**
 * @license
 * SPDX-License-Identifier: MIT
 * 
 * OpenUTAU-Inspired Playback Cursor & Position Marker Engine
 * Formats measures, beats, ticks, and handles smooth ruler scrubbing & cursor positioning.
 */

export interface OpenUtauPositionInfo {
  measure: number; // 1-based measure index (e.g. 1, 2, 3...)
  beat: number;    // 1-based beat index (e.g. 1, 2, 3, 4)
  tick: number;    // 1-based 16th tick subdivision (1..4)
  timeText: string; // e.g. "0:04.5"
  badge: string;    // e.g. "M3.2 · 0:04.5"
}

/**
 * Converts playback time in seconds to OpenUTAU measure notation (e.g. M3.2 · 0:04.5).
 */
export function formatOpenUtauTimeline(timeSec: number, bpm = 120): OpenUtauPositionInfo {
  const safeTime = Math.max(0, isFinite(timeSec) ? timeSec : 0);
  const safeBpm = Math.max(40, Math.min(240, isFinite(bpm) ? bpm : 120));

  const beatSec = 60 / safeBpm;
  const totalBeats = safeTime / beatSec;
  const measure = Math.floor(totalBeats / 4) + 1;
  const beat = (Math.floor(totalBeats) % 4) + 1;
  const tick = Math.floor((totalBeats - Math.floor(totalBeats)) * 4) + 1;

  const minutes = Math.floor(safeTime / 60);
  const seconds = (safeTime % 60).toFixed(1).padStart(4, '0');
  const timeText = `${minutes}:${seconds}`;
  const badge = `M${measure}.${beat} · ${timeText}`;

  return { measure, beat, tick, timeText, badge };
}

/**
 * Snaps a target timeline scrub time (seconds) to musical grid steps (1/16, 1/8, 1/4, etc.).
 */
export function snapPlaybackTime(timeSec: number, bpm = 120, grid = 1): number {
  const safeTime = Math.max(0, isFinite(timeSec) ? timeSec : 0);
  const safeBpm = Math.max(40, Math.min(240, isFinite(bpm) ? bpm : 120));
  const stepSec = 15 / safeBpm; // 16th step duration in seconds
  const quantum = stepSec * Math.max(0.25, grid);

  return Math.round(safeTime / quantum) * quantum;
}

/**
 * Computes pixel X offset of the playback cursor in piano roll canvas given step width CW.
 */
export function calculateCursorPx(timeSec: number, bpm = 120, stepWidthPx = 26, keyWidthPx = 40): number {
  const safeTime = Math.max(0, isFinite(timeSec) ? timeSec : 0);
  const safeBpm = Math.max(40, Math.min(240, isFinite(bpm) ? bpm : 120));
  const stepSec = 15 / safeBpm;
  const step = safeTime / stepSec;

  return keyWidthPx + step * stepWidthPx;
}
