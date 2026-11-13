/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CESTLOID_APPENDS, getCestloidAppend, applyCestloidAppend } from './cestloid-append.ts';

test('CESTLOID_APPENDS defines all 8 standard vocal appends', () => {
  assert.equal(CESTLOID_APPENDS.length, 8);
  const ids = CESTLOID_APPENDS.map((a) => a.id);
  assert.deepEqual(ids, ['default', 'female', 'mature', 'weak', 'clear', 'power', 'whisper', 'robot']);
});

test('getCestloidAppend retrieves presets by index and name with fallback', () => {
  const female = getCestloidAppend(1);
  assert.equal(female.id, 'female');
  assert.equal(female.append, 'child');
  assert.equal(female.f, 1.22);

  const power = getCestloidAppend('power');
  assert.equal(power.id, 'power');
  assert.equal(power.t, 0.92);

  const robot = getCestloidAppend('robot');
  assert.equal(robot.id, 'robot');
  assert.equal(robot.v, 0);

  const fallback = getCestloidAppend('unknown_append');
  assert.equal(fallback.id, 'default');
});

test('applyCestloidAppend overwrites acoustic properties with preset values', () => {
  const customVoice = { b: 0.2, br: 0.9, v: 0.1 };
  const applied = applyCestloidAppend(customVoice, 'whisper');
  assert.equal(applied.append, 'whisper');
  assert.equal(applied.b, 0.32);
  assert.equal(applied.br, 0.68);
  assert.equal(applied.asp, 0.55);
});
