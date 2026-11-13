/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectPhraseBreaths,
  calculateMicroPitchFlutter,
  calculateSmartHarmony,
  isSibilantPhoneme,
  applyDeEsserGain,
  applySmartHumanize,
  calculatePortamentoGlide,
  calculateFormantShiftFactors,
  calculateStereoDoublerParams,
  balancePhonemeRatio,
  applyTubeSaturation,
  applyAirBandExciter,
  classifyPhrase,
  detectCestloidBreaths,
  applyCestloidBreathsToNotes,
  applyBreathPitchTuning,
  type NoteLike,
} from './smart-features.ts';

test('1. classifyPhrase categorizes note count into long, medium, and short with correct durations', () => {
  const long25 = classifyPhrase(25);
  assert.equal(long25.category, 'long');
  assert.equal(long25.targetInhaleSec, 0.75);

  const long30 = classifyPhrase(30);
  assert.equal(long30.category, 'long');
  assert.equal(long30.targetInhaleSec, 0.75);

  const med10 = classifyPhrase(10);
  assert.equal(med10.category, 'medium');
  assert.equal(med10.targetInhaleSec, 0.55);

  const med20 = classifyPhrase(20);
  assert.equal(med20.category, 'medium');
  assert.equal(med20.targetInhaleSec, 0.55);

  const short5 = classifyPhrase(5);
  assert.equal(short5.category, 'short');
  assert.equal(short5.targetInhaleSec, 0.35);

  const short1 = classifyPhrase(1);
  assert.equal(short1.category, 'short');
  assert.equal(short1.targetInhaleSec, 0.35);
});

test('1b. detectCestloidBreaths inserts 0.75s inhale for long phrases (25+ notes)', () => {
  const stepDur = 0.125; // 120 bpm
  // Create 26 notes
  const notes: NoteLike[] = [];
  const startStep = 16; // 2 seconds lead room
  for (let i = 0; i < 26; i++) {
    notes.push({ s: startStep + i * 2, l: 2, p: 60, t: 'la' });
  }
  const breaths = detectCestloidBreaths(notes, { stepDurationSec: stepDur });
  const inhale = breaths.find((b) => b.type === 'in');
  assert.ok(inhale, 'Must have an inhale breath');
  assert.equal(inhale.durationSec, 0.75);
  assert.ok(inhale.intensity <= 0.35, 'Breath must be gentle');
  assert.equal(inhale.lyric, 'br');
});

test('1c. detectCestloidBreaths inserts 0.55s inhale for medium phrases (10-24 notes)', () => {
  const stepDur = 0.125;
  const notes: NoteLike[] = [];
  const startStep = 16;
  for (let i = 0; i < 15; i++) {
    notes.push({ s: startStep + i * 2, l: 2, p: 60, t: 'la' });
  }
  const breaths = detectCestloidBreaths(notes, { stepDurationSec: stepDur });
  const inhale = breaths.find((b) => b.type === 'in');
  assert.ok(inhale);
  assert.equal(inhale.durationSec, 0.55);
  assert.ok(inhale.intensity <= 0.35);
});

test('1d. detectCestloidBreaths inserts 0.35s inhale for short phrases (1-9 notes)', () => {
  const stepDur = 0.125;
  const notes: NoteLike[] = [
    { s: 16, l: 2, p: 60, t: 'a' },
    { s: 18, l: 2, p: 62, t: 'me' },
  ];
  const breaths = detectCestloidBreaths(notes, { stepDurationSec: stepDur });
  const inhale = breaths.find((b) => b.type === 'in');
  assert.ok(inhale);
  assert.equal(inhale.durationSec, 0.35);
  assert.ok(inhale.intensity <= 0.35);
});

test('1e. detectCestloidBreaths inserts 0.35s exhale if next phrase is 2-3s later, and 0.75s if >= 10s', () => {
  const stepDur = 0.125; // 8 steps = 1 sec
  // Phrase 1: 5 notes from step 16 to 26 (end at step 26 = 3.25s)
  const p1: NoteLike[] = [
    { s: 16, l: 2, p: 60, t: 'ka' },
    { s: 18, l: 2, p: 62, t: 'ra' },
    { s: 20, l: 2, p: 64, t: 'su' },
  ];
  // Phrase 2: starts 2.5 seconds later (2.5s / 0.125 = 20 steps -> step 22 + 20 = 42)
  const p2: NoteLike[] = [
    { s: 42, l: 2, p: 65, t: 'no' },
    { s: 44, l: 2, p: 67, t: 'u' },
    { s: 46, l: 2, p: 69, t: 'ta' },
  ];
  // Gap between P1 and P2 is (42 - 22) * 0.125 = 2.5s (in 2-3s window!)
  const allNotes = [...p1, ...p2];
  const breaths = detectCestloidBreaths(allNotes, { stepDurationSec: stepDur });

  // P1 should have an exhale of 0.35s
  const p1Exhale = breaths.find((b) => b.type === 'out' && b.step === 22);
  assert.ok(p1Exhale, 'P1 must have 0.35s exhale');
  assert.equal(p1Exhale.durationSec, 0.35);
  assert.equal(p1Exhale.lyric, 'br_out');
  assert.ok(p1Exhale.intensity <= 0.35);

  // P2 is the last phrase (no notes for >= 10s) -> 0.75s exhale
  const p2Exhale = breaths.find((b) => b.type === 'out' && b.step === 48);
  assert.ok(p2Exhale, 'P2 must have 0.75s exhale for >= 10s gap/end');
  assert.equal(p2Exhale.durationSec, 0.75);
  assert.equal(p2Exhale.lyric, 'br_out');
});

test('1f. applyCestloidBreathsToNotes correctly adds breath notes to note list', () => {
  const stepDur = 0.125;
  const notes: NoteLike[] = [
    { s: 16, l: 2, p: 60, t: 'do' },
    { s: 18, l: 2, p: 62, t: 're' },
  ];
  const applied = applyCestloidBreathsToNotes(notes, stepDur);
  assert.ok(applied.length > notes.length);
  assert.ok(applied.some((n) => n.t === 'br'));
  assert.ok(applied.some((n) => n.t === 'br_out'));
});

test('2. calculateMicroPitchFlutter generates subtle micro-oscillation around base pitch', () => {
  const base = 60; // C4
  const p1 = calculateMicroPitchFlutter(0.1, base, 8, 3.0);
  const p2 = calculateMicroPitchFlutter(0.25, base, 8, 3.0);
  // Must remain within ±20 cents (0.2 semitones)
  assert.ok(Math.abs(p1 - base) < 0.2);
  assert.ok(Math.abs(p2 - base) < 0.2);
  // Should oscillate over time
  assert.notEqual(p1, p2);
});

test('3. calculateSmartHarmony computes diatonic intervals matching scale degrees', () => {
  const notes: NoteLike[] = [
    { s: 0, l: 4, p: 60 }, // C4
    { s: 4, l: 4, p: 62 }, // D4
    { s: 8, l: 4, p: 64 }, // E4
  ];
  const harmony = calculateSmartHarmony(notes, 'third_above', 0, 'major');
  assert.equal(harmony.length, 3);
  // C4 (60) + 3rd in C major -> E4 (64)
  assert.equal(harmony[0].p, 64);
  // D4 (62) + 3rd in C major -> F4 (65)
  assert.equal(harmony[1].p, 65);
  // E4 (64) + 3rd in C major -> G4 (67)
  assert.equal(harmony[2].p, 67);
});

test('4. isSibilantPhoneme and applyDeEsserGain attenuate harsh high-frequency bursts', () => {
  assert.equal(isSibilantPhoneme('sa'), true);
  assert.equal(isSibilantPhoneme('shi'), true);
  assert.equal(isSibilantPhoneme('tsu'), true);
  assert.equal(isSibilantPhoneme('a'), false);
  assert.equal(isSibilantPhoneme('ma'), false);

  const loudSample = 0.9;
  const compressed = applyDeEsserGain(loudSample, true, 0.45, 0.55);
  assert.ok(compressed < loudSample);
  // Non-sibilant is unaffected
  const untouched = applyDeEsserGain(loudSample, false, 0.45, 0.55);
  assert.equal(untouched, loudSample);
});

test('5. applySmartHumanize accents metric downbeats and adds micro-timing variation', () => {
  const notes: NoteLike[] = [
    { s: 0, l: 4, p: 60, v: 0.7 },  // Downbeat 1
    { s: 2, l: 2, p: 62, v: 0.7 },  // Offbeat
    { s: 8, l: 4, p: 64, v: 0.7 },  // Midbeat 3
  ];
  const humanized = applySmartHumanize(notes, 0.1, 0.2, 123);
  assert.equal(humanized.length, 3);
  // Downbeat has higher dynamic velocity than offbeat
  assert.ok((humanized[0].v ?? 0) > (humanized[1].v ?? 0));
});

test('6. calculatePortamentoGlide creates smooth S-curve transitions', () => {
  const points = calculatePortamentoGlide(60, 67, 90, 8);
  assert.equal(points.length, 9);
  assert.equal(points[0].pitch, 60);
  assert.equal(points[points.length - 1].pitch, 67);
  // Monotonic progression for ascending leap
  for (let i = 1; i < points.length; i++) {
    assert.ok(points[i].pitch >= points[i - 1].pitch);
  }
});

test('7. calculateFormantShiftFactors scales formants based on vocal tract length', () => {
  const child = calculateFormantShiftFactors(0.85); // Shorter vocal tract -> higher formant frequencies
  const mature = calculateFormantShiftFactors(1.15); // Longer vocal tract -> lower formant frequencies
  assert.ok(child.f1Mult > 1.0);
  assert.ok(child.f2Mult > 1.0);
  assert.ok(mature.f1Mult < 1.0);
  assert.ok(mature.f2Mult < 1.0);
});

test('8. calculateStereoDoublerParams calculates Haas binaural micro-delays', () => {
  const params = calculateStereoDoublerParams(0.7);
  assert.ok(params.leftDelayMs > 0);
  assert.ok(params.rightDelayMs > params.leftDelayMs);
  assert.ok(params.leftDetuneCents < 0);
  assert.ok(params.rightDetuneCents > 0);
});

test('9. balancePhonemeRatio preserves minimum vowel space on fast notes', () => {
  // Short 16th note (100ms) with a 60ms raw consonant
  const fast = balancePhonemeRatio(60, 100);
  assert.ok(fast.vowelMs >= 50); // Vowel must have breathing room
  assert.ok(fast.consonantMs <= 50);

  // Long note (800ms) with 60ms raw consonant
  const long = balancePhonemeRatio(60, 800);
  assert.ok(long.vowelMs > 600);
});

test('10. applyTubeSaturation and applyAirBandExciter enrich harmonic spectrum', () => {
  const clean = 0.5;
  const warm = applyTubeSaturation(clean, 0.4);
  assert.ok(isFinite(warm));
  assert.ok(Math.abs(warm) <= 1.0);

  const air = applyAirBandExciter(clean, 0.25);
  assert.ok(isFinite(air));
  assert.ok(Math.abs(air) <= 1.0);
});

test('1g. applyBreathPitchTuning expresses breath via pitch tuning and deletes breath notes', () => {
  const stepDur = 0.125;
  const notesWithLegacyBreath: NoteLike[] = [
    { s: 14, l: 2, p: 53, t: 'br' }, // separate breath note that should be deleted
    { s: 16, l: 4, p: 60, t: 'ka' },
    { s: 20, l: 4, p: 62, t: 'ra' },
    { s: 24, l: 2, p: 51, t: 'br_out' }, // separate breath note that should be deleted
  ];

  const tuned = applyBreathPitchTuning(notesWithLegacyBreath, stepDur);

  // 1. Separate breath notes are removed
  assert.equal(tuned.length, 2, 'Must remove all separate breath notes');
  assert.ok(!tuned.some((n) => /^(br|br_in|br_out|breath)$/i.test(n.t || '')));

  // 2. First note has pitch tuning (pc) with breath intake swoop
  const first = tuned[0];
  assert.ok(first.pc && first.pc.length > 2, 'First note must have pitch tuning curve');
  const startPitchPt = first.pc[0];
  assert.ok(startPitchPt[0] < first.s, 'Pitch tuning curve starts before note for breath intake');
  assert.ok(startPitchPt[1] < first.p, 'Breath intake starts below note pitch');

  // 3. Last note has pitch tuning (pc) with breath release sigh
  const last = tuned[1];
  assert.ok(last.pc && last.pc.length > 2, 'Last note must have pitch tuning curve');
  const endPitchPt = last.pc[last.pc.length - 1];
  assert.ok(endPitchPt[0] > last.s + last.l, 'Pitch tuning curve extends after note for breath release');
  assert.ok(endPitchPt[1] < last.p, 'Breath release sigh curves downward');
});
