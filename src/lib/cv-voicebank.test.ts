/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  splitMora,
  getConsonantCandidates,
  getVowelCandidates,
  resolveSeparateCV,
  calculateCVSplitTiming,
  matchCustomCVRule,
  DEFAULT_CV_PRESET_RULES,
  type CVMemberRule,
} from './cv-voicebank.ts';

test('C+V Voicebank: splitMora correctly decomposes romaji and kana syllables', () => {
  assert.deepEqual(splitMora('ka'), { consonant: 'k', vowel: 'a', original: 'ka' });
  assert.deepEqual(splitMora('ki'), { consonant: 'k', vowel: 'i', original: 'ki' });
  assert.deepEqual(splitMora('shi'), { consonant: 'sh', vowel: 'i', original: 'shi' });
  assert.deepEqual(splitMora('tsu'), { consonant: 'ts', vowel: 'u', original: 'tsu' });
  assert.deepEqual(splitMora('kya'), { consonant: 'ky', vowel: 'a', original: 'kya' });
  assert.deepEqual(splitMora('a'), { consonant: '', vowel: 'a', original: 'a' });
  assert.deepEqual(splitMora('n'), { consonant: '', vowel: 'n', original: 'n' });

  // Kana handling
  assert.deepEqual(splitMora('か'), { consonant: 'k', vowel: 'a', original: 'か' });
  assert.deepEqual(splitMora('し'), { consonant: 'sh', vowel: 'i', original: 'し' });
  assert.deepEqual(splitMora('あ'), { consonant: '', vowel: 'a', original: 'あ' });
  assert.deepEqual(splitMora('ん'), { consonant: '', vowel: 'n', original: 'ん' });
});

test('C+V Voicebank: candidate generators include uppercase and prefix/suffix variants', () => {
  const cCands = getConsonantCandidates('k');
  assert.ok(cCands.includes('K'), 'Should include uppercase K as requested by user');
  assert.ok(cCands.includes('k'), 'Should include lowercase k');
  assert.ok(cCands.includes('- k'), 'Should include prefix hyphen - k');
  assert.ok(cCands.includes('- K'), 'Should include prefix hyphen - K');

  const vCands = getVowelCandidates('a');
  assert.ok(vCands.includes('a'), 'Should include lowercase a');
  assert.ok(vCands.includes('A'), 'Should include uppercase A');
  assert.ok(vCands.includes('あ'), 'Should include kana あ');
});

test('C+V Voicebank: resolveSeparateCV finds separate "K" and "a" when "ka" is entered', () => {
  // Mock voicebank dictionary having ONLY separate consonant "K" and vowel "a"
  const mockVoicebank = new Map<string, { f: string; al: string }>([
    ['K', { f: 'k.wav', al: 'K' }],
    ['S', { f: 's.wav', al: 'S' }],
    ['a', { f: 'a.wav', al: 'a' }],
    ['i', { f: 'i.wav', al: 'i' }],
  ]);

  const finder = (alias: string) => mockVoicebank.get(alias) || null;

  // 1. Entering 'ka' should find C = 'K' and V = 'a'
  const matchKa = resolveSeparateCV('ka', finder);
  assert.equal(matchKa.isSplit, true);
  assert.equal(matchKa.consonant, 'k');
  assert.equal(matchKa.vowel, 'a');
  assert.ok(matchKa.consonantEntry);
  assert.equal(matchKa.consonantEntry.al, 'K');
  assert.ok(matchKa.vowelEntry);
  assert.equal(matchKa.vowelEntry.al, 'a');
  assert.equal(matchKa.compositeAlias, 'K+a');

  // 2. Entering 'sa' should find C = 'S' and V = 'a'
  const matchSa = resolveSeparateCV('sa', finder);
  assert.equal(matchSa.isSplit, true);
  assert.equal(matchSa.consonantEntry?.al, 'S');
  assert.equal(matchSa.vowelEntry?.al, 'a');

  // 3. Entering 'a' (pure vowel) should not split consonant
  const matchA = resolveSeparateCV('a', finder);
  assert.equal(matchA.isSplit, false);
  assert.equal(matchA.consonantEntry, null);
  assert.equal(matchA.vowelEntry?.al, 'a');
});

test('C+V Voicebank: custom mapping rules override defaults and match accurately', () => {
  const customRules: CVMemberRule[] = [
    { id: 'custom_fa', syllable: 'fa', consonant: 'F_burst', vowel: 'a_long', leadMs: 60, enabled: true },
    { id: 'custom_tu', syllable: 'tu', consonant: 'T_click', vowel: 'u_soft', leadMs: 30, enabled: true },
    { id: 'disabled_rule', syllable: 'ka', consonant: 'K_custom', vowel: 'a_custom', enabled: false },
  ];

  // Match test
  const matchedFa = matchCustomCVRule('fa', customRules);
  assert.ok(matchedFa);
  assert.equal(matchedFa.consonant, 'F_burst');
  assert.equal(matchedFa.vowel, 'a_long');
  assert.equal(matchedFa.leadMs, 60);

  // Disabled rule shouldn't match
  const matchedDisabled = matchCustomCVRule('ka', customRules);
  assert.equal(matchedDisabled, null);

  // Mock voicebank having the custom aliases
  const mockVoicebank = new Map<string, { f: string; al: string }>([
    ['F_burst', { f: 'f.wav', al: 'F_burst' }],
    ['a_long', { f: 'a.wav', al: 'a_long' }],
  ]);

  const match = resolveSeparateCV('fa', (a) => mockVoicebank.get(a) || null, { customRules });
  assert.equal(match.isSplit, true);
  assert.equal(match.consonant, 'F_burst');
  assert.equal(match.vowel, 'a_long');
  assert.equal(match.leadMs, 60);
  assert.ok(match.ruleMatched);
});

test('C+V Voicebank: DEFAULT_CV_PRESET_RULES contains standard Japanese consonant mappings', () => {
  assert.ok(DEFAULT_CV_PRESET_RULES.length >= 20);
  const kaRule = DEFAULT_CV_PRESET_RULES.find(r => r.syllable === 'ka');
  assert.ok(kaRule);
  assert.equal(kaRule.consonant, 'K');
  assert.equal(kaRule.vowel, 'a');
});

test('C+V Voicebank: calculateCVSplitTiming clamps consonant to note proportion', () => {
  const timing = calculateCVSplitTiming(0.08, 0.40, 'k');
  assert.ok(timing.consonantDurationSec > 0.03 && timing.consonantDurationSec <= 0.18);
  assert.ok(timing.consonantLeadSec > 0);
  assert.ok(timing.crossfadeSec > 0);
  assert.ok(timing.vowelDurationSec >= 0.40);
});
