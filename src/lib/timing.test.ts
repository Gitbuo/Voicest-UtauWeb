import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTiming, getEndMs, DEFAULT_FADE_IN_MS, DEFAULT_FADE_OUT_MS } from './timing.ts';

test('short notes squeeze preutterance without stacking sounds', () => {
  // 3 notes of 170ms with 250ms preutterance and 60ms overlap
  const inputs = [
    { start: 0, duration: 170, preutter: 250, overlap: 60 },
    { start: 170, duration: 170, preutter: 250, overlap: 60 },
    { start: 340, duration: 170, preutter: 250, overlap: 60 },
  ];
  const t = computeTiming(inputs);
  for (let i = 1; i < inputs.length; i++) {
    // The part of previous note that consonant takes is at most 50%
    assert.ok(t[i].preutter - t[i].overlap <= inputs[i - 1].duration * 0.5 + 1e-6);
    assert.ok(t[i].preutter < 250);
    assert.ok(t[i].overlap < 60);
  }
  // Previous note ends at next note start - preutter + overlap
  const prevEnd = inputs[0].start + getEndMs(inputs[0].duration, t[0]);
  const nextStart = inputs[1].start - t[1].preutter;
  assert.ok(Math.abs(prevEnd - (nextStart + t[1].overlap)) < 1e-6);
});

test('adjacent notes crossfade smoothly across overlap', () => {
  const inputs = [
    { start: 0, duration: 500, preutter: 100, overlap: 30 },
    { start: 500, duration: 500, preutter: 100, overlap: 30 },
  ];
  const t = computeTiming(inputs);
  assert.equal(t[1].preutter, 100);
  assert.equal(t[1].overlap, 30);
  assert.equal(t[1].fade_in, 30);
  assert.equal(t[0].fade_out, 30);
  assert.equal(getEndMs(inputs[0].duration, t[0]), 430); // 500 - 100 + 30 = 430
});

test('isolated note uses default fades', () => {
  const inputs = [
    { start: 0, duration: 500, preutter: 80, overlap: 20 },
    { start: 2000, duration: 500, preutter: 80, overlap: 20 },
  ];
  const t = computeTiming(inputs);
  assert.equal(t[0].fade_out, DEFAULT_FADE_OUT_MS);
  assert.equal(t[1].fade_in, DEFAULT_FADE_IN_MS);
  assert.equal(t[0].tail_adjust, 0);
});
