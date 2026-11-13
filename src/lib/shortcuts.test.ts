/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { isEditableTarget, matchGlobalShortcut } from './shortcuts.ts';

test('matchGlobalShortcut maps transport and navigation keys', () => {
  assert.equal(matchGlobalShortcut({ key: ' ', code: 'Space' }), 'play_pause');
  assert.equal(matchGlobalShortcut({ key: ' ', code: 'Space', shiftKey: true }), 'stop');
  assert.equal(matchGlobalShortcut({ key: 'Escape' }), 'stop');
  assert.equal(matchGlobalShortcut({ key: 'Home' }), 'seek_home');
  assert.equal(matchGlobalShortcut({ key: 'End' }), 'seek_end');
  assert.equal(matchGlobalShortcut({ key: 'ArrowLeft' }), 'seek_back');
  assert.equal(matchGlobalShortcut({ key: 'ArrowRight' }), 'seek_forward');
  assert.equal(matchGlobalShortcut({ key: '[' }), 'prev_track');
  assert.equal(matchGlobalShortcut({ key: ']' }), 'next_track');
  assert.equal(matchGlobalShortcut({ key: 'ArrowUp', altKey: true }), 'prev_track');
  assert.equal(matchGlobalShortcut({ key: 'ArrowDown', altKey: true }), 'next_track');
  assert.equal(matchGlobalShortcut({ key: 'm' }), 'toggle_metro');
  assert.equal(matchGlobalShortcut({ key: 'M', code: 'KeyM' }), 'toggle_metro');
  assert.equal(matchGlobalShortcut({ key: '?' }), 'toggle_help');
});

test('matchGlobalShortcut ignores editable targets and modifier combos', () => {
  assert.equal(matchGlobalShortcut({ key: ' ', code: 'Space', target: { tagName: 'INPUT' } as unknown as EventTarget }), null);
  assert.equal(matchGlobalShortcut({ key: 'Home', target: { tagName: 'TEXTAREA' } as unknown as EventTarget }), null);
  assert.equal(matchGlobalShortcut({ key: 'End', target: { isContentEditable: true } as unknown as EventTarget }), null);
  assert.equal(matchGlobalShortcut({ key: ' ', code: 'Space', ctrlKey: true }), null);
  assert.equal(matchGlobalShortcut({ key: 'Home', metaKey: true }), null);
  assert.equal(isEditableTarget({ tagName: 'SELECT' } as unknown as EventTarget), true);
  assert.equal(isEditableTarget({ tagName: 'DIV' } as unknown as EventTarget), false);
});
