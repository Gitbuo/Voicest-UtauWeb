import test from 'node:test';
import assert from 'node:assert/strict';
import { getLegatoPitch, ENTRY_GLIDE_MS } from './pitch.ts';

test('adjacent note carries previous pitch during preutterance', () => {
  const params = {
    prevPitch: 60, // C4
    curPitch: 67,  // G4
    noteStartMs: 500,
    preutterMs: 100,
    isAdjacent: true,
  };

  // At 50ms before note onset (during preutterance), should be previous note pitch
  const pitchAt450 = getLegatoPitch(450, params);
  assert.equal(pitchAt450, 60);

  // At 25ms before note onset (start of glide), still 60
  const pitchAt475 = getLegatoPitch(475, params);
  assert.equal(pitchAt475, 60);

  // At exact note start (rel = 0ms), midpoint of S-curve
  const pitchAt500 = getLegatoPitch(500, params);
  assert.ok(Math.abs(pitchAt500 - 63.5) < 1e-4);

  // At 25ms after note onset (end of glide), should be target pitch 67
  const pitchAt525 = getLegatoPitch(525, params);
  assert.equal(pitchAt525, 67);

  // Deep in the vowel (e.g. +100ms), target pitch 67
  const pitchAt600 = getLegatoPitch(600, params);
  assert.equal(pitchAt600, 67);
});

test('isolated note has no glide', () => {
  const params = {
    prevPitch: 60,
    curPitch: 67,
    noteStartMs: 2000,
    preutterMs: 100,
    isAdjacent: false,
  };
  assert.equal(getLegatoPitch(1950, params), 67);
  assert.equal(getLegatoPitch(2000, params), 67);
});
