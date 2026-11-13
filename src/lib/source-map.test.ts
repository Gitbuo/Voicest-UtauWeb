import test from 'node:test';
import assert from 'node:assert/strict';
import { createSourceTimeMap } from './source-map.ts';

test('source time mapping is strictly monotonic and continuous across vowel onset', () => {
  const map = createSourceTimeMap({
    srcOffsetMs: 50,
    srcConsonantMs: 120,
    srcPreutterMs: 90,
    srcCutoffMs: -300,
    wavTotalDurMs: 1000,
    renderPreutterMs: 60, // squeezed from 90 to 60 on fast note!
    consonantScale: 1.0,
    noteDurMs: 200,
  });

  // At outSec = 0: offset + skipped lead
  const t0 = map(0);
  assert.equal(t0, 0.08); // 50ms + 30ms = 80ms

  // At outSec = 0.060 (the preutterance point / vowel onset)
  const tVowel = map(0.060);
  assert.equal(tVowel, 0.14); // 50ms + 90ms = 140ms

  // Check continuity around boundary 0.060s
  const justBefore = map(0.0599);
  const justAfter = map(0.0601);
  assert.ok(justBefore <= tVowel && tVowel <= justAfter);
  assert.ok(justAfter - justBefore < 0.001); // smooth, no 200ms jump!
});
