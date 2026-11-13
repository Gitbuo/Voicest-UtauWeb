import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePitchContour, pitchToNoteName, pitchToHz } from './pitch-contour.ts';

test('detects legato transitions between adjacent notes', () => {
  const notes = [
    { s: 0, l: 4, p: 60, t: 'ko' },  // C4
    { s: 4, l: 4, p: 64, t: 'n' },   // E4 (adjacent to C4)
    { s: 8, l: 4, p: 67, t: 'ni' },  // G4 (adjacent to E4)
  ];

  const result = generatePitchContour(notes, 120, 5);
  assert.equal(result.transitions.length, 2);

  // Transition 1: C4 -> E4 around time = 4 * 0.125 = 0.5s
  const tr1 = result.transitions[0];
  assert.equal(tr1.fromPitch, 60);
  assert.equal(tr1.toPitch, 64);
  assert.equal(tr1.fromLyric, 'ko');
  assert.equal(tr1.toLyric, 'n');
  assert.ok(Math.abs(tr1.centerTime - 0.5) < 1e-4);

  // Transition 2: E4 -> G4 around time = 8 * 0.125 = 1.0s
  const tr2 = result.transitions[1];
  assert.equal(tr2.fromPitch, 64);
  assert.equal(tr2.toPitch, 67);
  assert.ok(Math.abs(tr2.centerTime - 1.0) < 1e-4);

  // Check that contour points exist and have legato flags
  const legatoPoints = result.points.filter(p => p.isLegato);
  assert.ok(legatoPoints.length > 0, 'Must have points flagged as legato');

  // Check pitch at exact center of transition (0.5s): midpoint between 60 and 64 = 62
  const centerPoint = result.points.find(p => Math.abs(p.time - 0.5) < 0.003);
  assert.ok(centerPoint, 'Must have point near center time');
  assert.ok(Math.abs(centerPoint.pitch - 62) < 0.2);
});

test('pitchToNoteName formats note and octave correctly', () => {
  assert.equal(pitchToNoteName(60), 'C4');
  assert.equal(pitchToNoteName(69), 'A4');
  assert.equal(pitchToNoteName(61), 'C#4');
});

test('pitchToHz matches standard concert pitch A440', () => {
  assert.equal(pitchToHz(69), 440);
  assert.ok(Math.abs(pitchToHz(60) - 261.6255) < 0.01); // C4
});
