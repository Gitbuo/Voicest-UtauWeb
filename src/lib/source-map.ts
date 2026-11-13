/**
 * Continuous time mapping from output rendering time to source audio time.
 * Prevents abrupt jumps or phase tearing when preutterance is squeezed on fast notes.
 */

export interface SourceMapParams {
  srcOffsetMs: number;
  srcConsonantMs: number;
  srcPreutterMs: number;
  srcCutoffMs: number;
  wavTotalDurMs: number;
  renderPreutterMs: number;
  consonantScale: number;
  noteDurMs: number;
  vowelSteadyMsHint?: number;
}

export function createSourceTimeMap(params: SourceMapParams): (outSec: number) => number {
  const {
    srcOffsetMs,
    srcConsonantMs,
    srcPreutterMs,
    srcCutoffMs,
    wavTotalDurMs,
    renderPreutterMs,
    consonantScale,
    noteDurMs,
    vowelSteadyMsHint,
  } = params;

  const srcAttackEndMs = srcConsonantMs > 0
    ? Math.min(wavTotalDurMs, srcOffsetMs + srcConsonantMs)
    : Math.min(wavTotalDurMs, srcOffsetMs + srcPreutterMs + 40.0);

  const srcPreutterPointMs = Math.min(srcAttackEndMs, srcOffsetMs + srcPreutterMs);
  const srcFixedConsonantDurMs = Math.max(0, srcAttackEndMs - srcPreutterPointMs);

  let srcVowelSteadyMs = 0;
  if (srcCutoffMs > 0) {
    srcVowelSteadyMs = Math.max(srcAttackEndMs, wavTotalDurMs - srcCutoffMs);
  } else if (srcCutoffMs < 0) {
    srcVowelSteadyMs = Math.min(wavTotalDurMs, Math.max(srcAttackEndMs, srcOffsetMs - srcCutoffMs));
  } else {
    srcVowelSteadyMs = Math.max(srcAttackEndMs, vowelSteadyMsHint || (srcAttackEndMs + 100));
  }

  const fullPreutterMs = srcPreutterMs * consonantScale;
  const skipSrcMs = Math.max(0, fullPreutterMs - renderPreutterMs) / consonantScale;
  const outFixedConsonantDurMs = Math.min(noteDurMs, srcFixedConsonantDurMs * consonantScale);
  const maxSrcSec = Math.max(0, (wavTotalDurMs - 1.0) / 1000.0);

  return function map(outSec: number): number {
    const outMs = outSec * 1000.0;
    let srcMs: number;
    if (outMs < renderPreutterMs) {
      srcMs = srcOffsetMs + skipSrcMs + outMs / consonantScale;
    } else if (outMs < renderPreutterMs + outFixedConsonantDurMs) {
      srcMs = srcPreutterPointMs + (outMs - renderPreutterMs) / consonantScale;
    } else {
      const tInVowel = outMs - (renderPreutterMs + outFixedConsonantDurMs);
      srcMs = srcAttackEndMs + tInVowel;
      if (srcMs > srcVowelSteadyMs) {
        const loopLen = Math.max(30.0, srcVowelSteadyMs - srcAttackEndMs);
        const over = srcMs - srcVowelSteadyMs;
        const cycle = over % (2 * loopLen);
        srcMs = cycle < loopLen ? srcVowelSteadyMs - cycle : srcAttackEndMs + (cycle - loopLen);
      }
    }
    return Math.max(0, Math.min(maxSrcSec, srcMs / 1000.0));
  };
}
