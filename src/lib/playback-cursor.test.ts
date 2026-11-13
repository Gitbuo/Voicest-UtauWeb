/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatOpenUtauTimeline,
  snapPlaybackTime,
  calculateCursorPx,
} from './playback-cursor.ts';

test('formatOpenUtauTimeline computes exact measure, beat and timestamp', () => {
  // At 120 BPM: 1 beat = 0.5s, 1 measure (4 beats) = 2.0s
  // 0s -> Measure 1, Beat 1
  const t0 = formatOpenUtauTimeline(0, 120);
  assert.equal(t0.measure, 1);
  assert.equal(t0.beat, 1);
  assert.equal(t0.timeText, '0:00.0');
  assert.equal(t0.badge, 'M1.1 · 0:00.0');

  // 2.0s -> Measure 2, Beat 1
  const t2 = formatOpenUtauTimeline(2.0, 120);
  assert.equal(t2.measure, 2);
  assert.equal(t2.beat, 1);
  assert.equal(t2.timeText, '0:02.0');

  // 3.5s -> Measure 2, Beat 4
  const t35 = formatOpenUtauTimeline(3.5, 120);
  assert.equal(t35.measure, 2);
  assert.equal(t35.beat, 4);
  assert.equal(t35.timeText, '0:03.5');
  assert.equal(t35.badge, 'M2.4 · 0:03.5');
});

test('snapPlaybackTime snaps cleanly to musical grid subdivisions', () => {
  // At 120 BPM, step = 0.125s (1/16 note)
  // Grid 1 = 1/16 = 0.125s
  assert.equal(snapPlaybackTime(0.12, 120, 1), 0.125);
  assert.equal(snapPlaybackTime(0.24, 120, 1), 0.25);

  // Grid 4 = 1/4 note (beat) = 0.5s
  assert.equal(snapPlaybackTime(0.48, 120, 4), 0.5);
  assert.equal(snapPlaybackTime(0.80, 120, 4), 1.0);
});

test('calculateCursorPx converts time to canvas pixel coordinate', () => {
  // 120 BPM -> 1 step = 0.125s
  // At 0s, X = keyWidth (40px)
  assert.equal(calculateCursorPx(0, 120, 26, 40), 40);

  // At 0.125s (1 step), X = 40 + 26 = 66px
  assert.equal(calculateCursorPx(0.125, 120, 26, 40), 66);
});
