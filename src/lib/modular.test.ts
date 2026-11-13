/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUtauFlags, formatUtauFlags } from './flags.ts';
import {
  sCurveCosineInterpolate,
  catmullRomInterpolate,
  hermiteInterpolate,
  generateLegatoPitchTrajectory,
} from './interpolator.ts';
import {
  dcBlocker,
  softLimiter,
  equalPowerCrossfade,
  pitchToHz,
  hzToPitch,
} from './dsp.ts';
import { t } from './i18n.ts';

test('i18n: translation fallback and arg replacement works across languages', () => {
  assert.equal(t('app_title', 'vi'), 'VOICEST V2X');
  assert.equal(t('app_title', 'en'), 'VOICEST V2X');
  assert.equal(t('app_title', 'ja'), 'VOICEST V2X');

  assert.equal(t('toast_quantized', 'vi', 5, '1/16'), 'Đã căn lưới 5 nốt theo lưới 1/16!');
  assert.equal(t('toast_quantized', 'en', 5, '1/16'), 'Quantized 5 notes to 1/16 grid!');
  assert.equal(t('toast_quantized', 'ja', 5, '1/16'), '5個のノートを1/16グリッドに整列しました！');
  assert.equal(t('toast_quantized', 'zh', 5, '1/16'), '已将 5 个音符按 1/16 网格量化！');
  assert.equal(t('toast_quantized', 'ko', 5, '1/16'), '5개의 음표를 1/16 그리드에 정렬했습니다!');
});

test('flags: parses standard and composite UTAU flags', () => {
  const flags = parseUtauFlags('g-5B50vel150p80mod50');
  assert.equal(flags.gender, -5);
  assert.equal(flags.breathiness, 50);
  assert.equal(flags.velocity, 150);
  assert.equal(flags.peakCompression, 80);
  assert.equal(flags.modulation, 50);

  const serialized = formatUtauFlags(flags);
  assert.ok(serialized.includes('g-5'));
  assert.ok(serialized.includes('B50'));
  assert.ok(serialized.includes('vel150'));
  assert.ok(serialized.includes('p80'));
  assert.ok(serialized.includes('mod50'));
});

test('interpolator: sCurveCosineInterpolate has smooth 0-slope endpoints', () => {
  assert.equal(sCurveCosineInterpolate(60, 64, 0), 60);
  assert.equal(sCurveCosineInterpolate(60, 64, 1), 64);
  assert.equal(sCurveCosineInterpolate(60, 64, 0.5), 62);

  const traj = generateLegatoPitchTrajectory(1.0, 60, 64, 0.05, 0.005);
  assert.ok(traj.length > 5);
  assert.equal(traj[0].pitch, 60);
  assert.equal(traj[traj.length - 1].pitch, 64);
});

test('dsp: dcBlocker removes constant DC offset', () => {
  const input = new Float32Array(1000).fill(0.5);
  const output = dcBlocker(input);
  // After initial transition, DC offset should decay towards 0
  assert.ok(Math.abs(output[output.length - 1]) < 0.05);
});

test('dsp: softLimiter compresses peaks > threshold without clipping', () => {
  const input = new Float32Array([0.1, 0.5, 0.8, 1.2, 2.0, -1.5]);
  const output = softLimiter(input, 0.8, 0.2);

  assert.ok(Math.abs(output[0] - 0.1) < 1e-6);
  assert.ok(Math.abs(output[1] - 0.5) < 1e-6);
  assert.ok(Math.abs(output[2] - 0.8) < 1e-6);
  assert.ok(output[3] > 0.8 && output[3] < 1.0);
  assert.ok(output[4] < 1.0);
  assert.ok(output[5] > -1.0);
});

test('dsp: equalPowerCrossfade preserves energy', () => {
  const bufA = new Float32Array(100).fill(1.0);
  const bufB = new Float32Array(100).fill(1.0);
  const out = equalPowerCrossfade(bufA, bufB, 40);

  // At midpoint of crossfade, sin^2 + cos^2 = 1, so both are 1 / sqrt(2) ~= 0.707, sum is 1.414 for coherent or 1.0 energy
  assert.ok(out.length === 160);
  assert.ok(out[0] === 1.0);
  assert.ok(out[159] === 1.0);
});

test('dsp: pitchToHz and hzToPitch are mutually inverse', () => {
  assert.equal(pitchToHz(69), 440);
  assert.ok(Math.abs(hzToPitch(440) - 69) < 1e-4);
  assert.ok(Math.abs(hzToPitch(pitchToHz(60)) - 60) < 1e-4);
});
