import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBalance, balanceGains, gainToDb } from './export-balance.ts';

test('centre balance leaves both channels at unity', () => {
  assert.deepEqual(balanceGains(0), { left: 1, right: 1 });
});

test('panning right attenuates only the left channel (and vice versa)', () => {
  assert.deepEqual(balanceGains(0.25), { left: 0.75, right: 1 });
  assert.deepEqual(balanceGains(-0.4), { left: 1, right: 0.6 });
  assert.deepEqual(balanceGains(1), { left: 0, right: 1 });
  assert.deepEqual(balanceGains(-1), { left: 1, right: 0 });
});

test('out-of-range and invalid input is clamped, never boosts', () => {
  assert.deepEqual(balanceGains(5), { left: 0, right: 1 });
  assert.deepEqual(balanceGains(-5), { left: 1, right: 0 });
  assert.deepEqual(balanceGains(NaN), { left: 1, right: 1 });
});

test('dB readout', () => {
  assert.equal(gainToDb(1), '0.0');
  assert.equal(gainToDb(0.5), '\u22126.0');
  assert.equal(gainToDb(0), '\u2212\u221e');
});

test('applyBalance silences the opposite channel at the extremes and duplicates mono', () => {
  const l = Float32Array.from([0.5, -0.5, 1]);
  const [a, b] = applyBalance(l, null, 1);
  assert.deepEqual([...a], [0, -0, 0]);
  assert.deepEqual([...b], [0.5, -0.5, 1]);
  const [c, d] = applyBalance(l, Float32Array.from([1, 1, 1]), -0.5);
  assert.deepEqual([...c], [0.5, -0.5, 1]);
  assert.deepEqual([...d], [0.5, 0.5, 0.5]);
});
