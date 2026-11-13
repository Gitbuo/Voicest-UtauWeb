/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * Rust-WORLD inspired DSP Utilities
 * Provides DC blocking, soft saturation limiting, and equal-power crossfading.
 */

/**
 * High-pass DC Blocker filter (cutoff ~15Hz at 44.1kHz).
 * Formula: y[n] = x[n] - x[n-1] + r * y[n-1], where r ~= 0.9975
 */
export function dcBlocker(
  samples: Float32Array,
  r: number = 0.9975
): Float32Array {
  const len = samples.length;
  const out = new Float32Array(len);
  let xp = 0;
  let yp = 0;

  for (let i = 0; i < len; i++) {
    const x = samples[i];
    const y = x - xp + r * yp;
    xp = x;
    yp = y;
    out[i] = y;
  }
  return out;
}

/**
 * Soft saturation limiter using tanh curve to prevent harsh digital clipping.
 * Preserves dynamics while smoothing peaks that exceed threshold.
 */
export function softLimiter(
  samples: Float32Array,
  threshold: number = 0.8,
  knee: number = 0.2
): Float32Array {
  const len = samples.length;
  const out = new Float32Array(len);

  for (let i = 0; i < len; i++) {
    let v = samples[i];
    const abs = Math.abs(v);
    if (abs > threshold) {
      const sign = v < 0 ? -1 : 1;
      const over = abs - threshold;
      v = sign * (threshold + knee * Math.tanh(over / knee));
    }
    out[i] = v;
  }
  return out;
}

/**
 * Equal-Power Quarter-Sine Crossfade between buffer A and buffer B.
 * Avoids energy drop (3dB dip) of linear crossfades and eliminates clicks.
 */
export function equalPowerCrossfade(
  bufferA: Float32Array,
  bufferB: Float32Array,
  crossfadeLength: number
): Float32Array {
  const fadeLen = Math.min(crossfadeLength, bufferA.length, bufferB.length);
  const totalLen = bufferA.length + bufferB.length - fadeLen;
  const out = new Float32Array(totalLen);

  // 1. Copy initial non-overlapping part of bufferA
  const preFadeLen = bufferA.length - fadeLen;
  out.set(bufferA.subarray(0, preFadeLen), 0);

  // 2. Crossfade region
  for (let i = 0; i < fadeLen; i++) {
    const u = i / Math.max(1, fadeLen);
    const gainA = Math.cos(u * (Math.PI * 0.5));
    const gainB = Math.sin(u * (Math.PI * 0.5));
    out[preFadeLen + i] =
      bufferA[preFadeLen + i] * gainA + bufferB[i] * gainB;
  }

  // 3. Copy remaining non-overlapping part of bufferB
  out.set(bufferB.subarray(fadeLen), bufferA.length);

  return out;
}

/**
 * Converts MIDI pitch number to fundamental frequency in Hz.
 * A4 = 69 = 440 Hz.
 */
export function pitchToHz(pitch: number): number {
  return 440 * Math.pow(2, (pitch - 69) / 12);
}

/**
 * Converts frequency in Hz to MIDI pitch number.
 */
export function hzToPitch(hz: number): number {
  if (hz <= 0) return 0;
  return 69 + 12 * Math.log2(hz / 440);
}
