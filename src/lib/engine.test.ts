import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTiming, getEndMs } from './timing.ts';
import { getLegatoPitch } from './pitch.ts';
import { createSourceTimeMap } from './source-map.ts';

test('combined timing and pitch for rapid note sequence', () => {
  // 16th notes at 160 BPM = 93.75 ms per note!
  const noteDuration = 93.75;
  const inputs = [
    { start: 0, duration: noteDuration, preutter: 150, overlap: 50 },
    { start: noteDuration, duration: noteDuration, preutter: 150, overlap: 50 },
    { start: noteDuration * 2, duration: noteDuration, preutter: 150, overlap: 50 },
  ];
  const t = computeTiming(inputs);

  // Each note must have positive preutter and sound end
  for (let i = 0; i < inputs.length; i++) {
    const end = getEndMs(inputs[i].duration, t[i]);
    assert.ok(end >= 5.0, `Note ${i} sound end must be >= 5ms`);
    assert.ok(t[i].preutter >= 0, `Note ${i} preutter must be >= 0`);
  }

  // Check pitch glide at second note boundary
  const p2 = {
    prevPitch: 60,
    curPitch: 64,
    noteStartMs: noteDuration,
    preutterMs: t[1].preutter,
    isAdjacent: true,
  };
  const pitchPre = getLegatoPitch(noteDuration - 30, p2);
  const pitchPost = getLegatoPitch(noteDuration + 30, p2);
  assert.equal(pitchPre, 60);
  assert.equal(pitchPost, 64);

  // Check continuous source map on short note
  const map = createSourceTimeMap({
    srcOffsetMs: 20,
    srcConsonantMs: 80,
    srcPreutterMs: 60,
    srcCutoffMs: -200,
    wavTotalDurMs: 800,
    renderPreutterMs: t[1].preutter,
    consonantScale: 1.0,
    noteDurMs: noteDuration,
  });
  const tStart = map(0);
  const tMid = map(t[1].preutter / 1000);
  assert.ok(tStart < tMid, 'Time map must be increasing');
});
