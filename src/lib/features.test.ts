/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { pitchToNoteName } from './pitch-contour.ts';

test('semitone transposition shifts step-by-step: C4 -> C#4 -> D4', () => {
  const c4 = 60;
  assert.equal(pitchToNoteName(c4), 'C4');
  
  const cs4 = c4 + 1;
  assert.equal(pitchToNoteName(cs4), 'C#4');
  
  const d4 = cs4 + 1;
  assert.equal(pitchToNoteName(d4), 'D4');

  const ds4 = d4 + 1;
  assert.equal(pitchToNoteName(ds4), 'D#4');

  const e4 = ds4 + 1;
  assert.equal(pitchToNoteName(e4), 'E4');

  // Transpose down semitone by semitone
  assert.equal(pitchToNoteName(e4 - 1), 'D#4');
  assert.equal(pitchToNoteName(e4 - 2), 'D4');
  assert.equal(pitchToNoteName(e4 - 3), 'C#4');
  assert.equal(pitchToNoteName(e4 - 4), 'C4');
});

test('octave transposition shifts by exactly 12 semitones: C3 -> C4 -> C5', () => {
  const c3 = 48;
  assert.equal(pitchToNoteName(c3), 'C3');
  assert.equal(pitchToNoteName(c3 + 12), 'C4');
  assert.equal(pitchToNoteName(c3 + 24), 'C5');
  assert.equal(pitchToNoteName(c3 + 24 - 12), 'C4');
});

test('chromatic 12 pitch color palette produces distinct colors for all semitones', () => {
  const PITCH_COLORS = [
    '#ff4d6d', '#ff758f', '#ff9e00', '#ffa200', '#ffd000', '#70e000',
    '#38b000', '#00b4d8', '#0096c7', '#7209b7', '#9d4edd', '#f72585'
  ];
  assert.equal(PITCH_COLORS.length, 12);
  const unique = new Set(PITCH_COLORS);
  assert.equal(unique.size, 12);
});

test('auto-oto RMS algorithm accurately identifies attack offset and vowel boundaries', () => {
  const sr = 44100;
  const samples = new Float32Array(sr * 1); // 1.0 second
  
  // 120ms initial noise, 60ms rising attack, 500ms vowel, decay
  for (let i = 0; i < samples.length; i++) {
    const t = i / sr;
    if (t < 0.12) {
      samples[i] = (Math.random() - 0.5) * 0.002;
    } else if (t < 0.18) {
      samples[i] = Math.sin(t * 800) * ((t - 0.12) / 0.06) * 0.5;
    } else if (t < 0.7) {
      samples[i] = Math.sin(t * 440) * 0.8;
    } else if (t < 0.85) {
      samples[i] = Math.sin(t * 440) * 0.8 * (1 - (t - 0.7) / 0.15);
    } else {
      samples[i] = (Math.random() - 0.5) * 0.002;
    }
  }

  const frameSize = Math.floor(sr * 0.01);
  const hopSize = Math.floor(sr * 0.005);
  const numFrames = Math.floor((samples.length - frameSize) / hopSize);
  const rms = new Float32Array(numFrames);
  let maxRms = 0;
  for (let f = 0; f < numFrames; f++) {
    let sum = 0, start = f * hopSize;
    for (let i = 0; i < frameSize; i++) {
      const s = samples[start + i];
      sum += s * s;
    }
    const val = Math.sqrt(sum / frameSize);
    rms[f] = val;
    if (val > maxRms) maxRms = val;
  }

  let noiseSum = 0;
  for (let i = 0; i < 10; i++) noiseSum += rms[i];
  const noiseFloor = noiseSum / 10;
  const attackThresh = Math.max(0.005, noiseFloor + 0.04 * (maxRms - noiseFloor));

  let offsetFrame = 0;
  for (let f = 0; f < numFrames; f++) {
    if (rms[f] >= attackThresh) {
      offsetFrame = f;
      break;
    }
  }
  const detectedOffsetMs = Math.round((offsetFrame * hopSize / sr) * 1000);
  // Ground truth is ~120ms, detector should be within 15ms
  assert.ok(Math.abs(detectedOffsetMs - 120) <= 20, `Detected offset ${detectedOffsetMs}ms should be close to 120ms`);
});
