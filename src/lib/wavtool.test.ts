import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  cubicInterpolate,
  linearInterpolate,
  evaluateEnvelope,
  applySoftLimiter,
  concatenateParts,
  extractWaveformEnvelope,
  type AudioPart
} from './wavtool.ts';

describe('Organum Wavtool Concatenator', () => {
  it('correctly interpolates cubic and linear samples', () => {
    const samples = new Float32Array([0.0, 0.5, 1.0, 0.5, 0.0]);
    const valLin = linearInterpolate(samples, 1.5);
    assert.strictEqual(valLin, 0.75);

    const valCubic = cubicInterpolate(samples, 1.5);
    assert.ok(valCubic > 0.7 && valCubic < 0.9);
  });

  it('evaluates piecewise linear volume envelope accurately', () => {
    const env = [
      { timeMs: 0, volume: 0 },
      { timeMs: 50, volume: 1.0 },
      { timeMs: 150, volume: 0.8 },
      { timeMs: 200, volume: 0 }
    ];

    assert.strictEqual(evaluateEnvelope(env, 0), 0);
    assert.strictEqual(evaluateEnvelope(env, 50), 1.0);
    assert.strictEqual(evaluateEnvelope(env, 25), 0.5); // mid of 0..50
    assert.strictEqual(evaluateEnvelope(env, 100), 0.9); // mid of 50..150
    assert.strictEqual(evaluateEnvelope(env, 200), 0);
    assert.strictEqual(evaluateEnvelope(env, 300), 0); // clamp end
  });

  it('soft limiter blocks DC and clamps peaks smoothly without clipping', () => {
    // Construct samples with DC offset and strong peak
    const samples = new Float32Array(500);
    for (let i = 0; i < 500; i++) {
      samples[i] = 0.5 + 0.8 * Math.sin((i / 500) * 20); // DC offset 0.5 + wave peak reaching 1.3
    }

    const limited = applySoftLimiter(samples, 0.8, 0.98);
    let max = 0;
    for (let i = 100; i < 500; i++) {
      max = Math.max(max, Math.abs(limited[i]));
    }

    assert.ok(max <= 0.985, `Peak should be kept under limit: got ${max}`);
  });

  it('concatenates audio parts with overlap-add seamlessly', () => {
    const sr = 44100;
    // Tone 1: 100ms
    const samples1 = new Float32Array(Math.round(0.1 * sr));
    for (let i = 0; i < samples1.length; i++) {
      samples1[i] = Math.sin((2 * Math.PI * 440 * i) / sr) * 0.6;
    }

    // Tone 2: 100ms overlapping Tone 1 by 20ms
    const samples2 = new Float32Array(Math.round(0.1 * sr));
    for (let i = 0; i < samples2.length; i++) {
      samples2[i] = Math.sin((2 * Math.PI * 523.25 * i) / sr) * 0.6;
    }

    const parts: AudioPart[] = [
      {
        samples: samples1,
        sampleRate: sr,
        offsetMs: 0,
        lengthMs: 100,
        fadeInMs: 5,
        fadeOutMs: 20
      },
      {
        samples: samples2,
        sampleRate: sr,
        offsetMs: 80, // 20ms overlap with part 1
        lengthMs: 100,
        fadeInMs: 20,
        fadeOutMs: 10
      }
    ];

    const out = concatenateParts(parts, { sampleRate: sr, enableLimiter: true });
    // Total duration should be 80ms + 100ms = 180ms
    const expectedSamples = Math.round((180 * sr) / 1000);
    assert.strictEqual(out.length, expectedSamples);

    // Verify non-silent output
    let max = 0;
    for (let i = 0; i < out.length; i++) {
      max = Math.max(max, Math.abs(out[i]));
    }
    assert.ok(max > 0.1, 'Output should have audible content');
  });

  it('extracts waveform envelope points for visualizer', () => {
    const sr = 44100;
    const samples = new Float32Array(Math.round(0.5 * sr));
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((i / sr) * 440 * 2 * Math.PI) * 0.7;
    }

    const waveform = extractWaveformEnvelope(samples, 50, sr);
    assert.ok(waveform.length >= 40 && waveform.length <= 60);
    assert.ok(waveform[10].rms > 0.3);
    assert.ok(waveform[10].max > 0.5);
    assert.ok(waveform[10].min < -0.5);
  });
});
