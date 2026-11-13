/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * Stereo balance used by the "Export Audio" dialog (mirrors expGains / expApplyBalance
 * in public/voicest.html). The balance only attenuates the opposite channel, so it is
 * 0 dB at the centre and can never add gain (=> can never introduce clipping).
 */

export interface BalanceGains {
  left: number;
  right: number;
}

/** @param balance -1 (full left) … 0 (centre) … +1 (full right) */
export function balanceGains(balance: number): BalanceGains {
  const v = Math.max(-1, Math.min(1, Number.isFinite(balance) ? balance : 0));
  return { left: v > 0 ? 1 - v : 1, right: v < 0 ? 1 + v : 1 };
}

/** Linear gain -> dB string with a typographic minus; silence is "−∞". */
export function gainToDb(gain: number): string {
  return gain <= 0 ? '\u2212\u221e' : (20 * Math.log10(gain)).toFixed(1).replace('-', '\u2212');
}

/** Returns new left/right sample arrays with the balance applied (mono input is duplicated). */
export function applyBalance(left: Float32Array, right: Float32Array | null, balance: number): [Float32Array, Float32Array] {
  const { left: gl, right: gr } = balanceGains(balance);
  const r = right ?? left;
  const outL = new Float32Array(left.length);
  const outR = new Float32Array(left.length);
  for (let i = 0; i < left.length; i++) {
    outL[i] = left[i] * gl;
    outR[i] = r[i] * gr;
  }
  return [outL, outR];
}
