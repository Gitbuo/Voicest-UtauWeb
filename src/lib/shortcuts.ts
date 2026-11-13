/**
 * @license
 * SPDX-License-Identifier: MIT
 */

export type ShortcutAction =
  | 'play_pause'
  | 'stop'
  | 'seek_home'
  | 'seek_end'
  | 'seek_back'
  | 'seek_forward'
  | 'prev_track'
  | 'next_track'
  | 'toggle_metro'
  | 'toggle_help';

export interface ShortcutEventLike {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  target?: EventTarget | null;
}

export interface ShortcutDefinition {
  action: ShortcutAction;
  keys: string[];
  labelKey: string;
}

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  { action: 'play_pause', keys: ['Space'], labelKey: 'sc_space' },
  { action: 'stop', keys: ['Esc'], labelKey: 'sc_stop' },
  { action: 'seek_home', keys: ['Home'], labelKey: 'sc_home' },
  { action: 'seek_end', keys: ['End'], labelKey: 'sc_end' },
  { action: 'seek_back', keys: ['Left', 'Right'], labelKey: 'sc_seek_step' },
  { action: 'prev_track', keys: ['['], labelKey: 'sc_prev_track' },
  { action: 'next_track', keys: [']'], labelKey: 'sc_next_track' },
  { action: 'toggle_metro', keys: ['M'], labelKey: 'sc_metro' },
  { action: 'toggle_help', keys: ['?'], labelKey: 'shortcuts_btn' },
];

export function isEditableTarget(target: EventTarget | null | undefined): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as { tagName?: string; isContentEditable?: boolean };
  if (el.isContentEditable) return true;
  const tag = (el.tagName || '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function matchGlobalShortcut(e: ShortcutEventLike): ShortcutAction | null {
  if (isEditableTarget(e.target)) return null;
  if (e.ctrlKey || e.metaKey) return null;

  const key = e.key;
  const code = e.code || '';

  if (code === 'Space' || key === ' ') {
    return e.shiftKey ? 'stop' : 'play_pause';
  }
  if (key === 'Escape') {
    return 'stop';
  }
  if (key === 'Home') {
    return 'seek_home';
  }
  if (key === 'End') {
    return 'seek_end';
  }
  if (key === 'ArrowLeft') {
    return 'seek_back';
  }
  if (key === 'ArrowRight') {
    return 'seek_forward';
  }
  if (key === '[' || (e.altKey && key === 'ArrowUp')) {
    return 'prev_track';
  }
  if (key === ']' || (e.altKey && key === 'ArrowDown')) {
    return 'next_track';
  }
  if (key === 'm' || key === 'M' || code === 'KeyM') {
    return 'toggle_metro';
  }
  if (key === '?' || key === 'F1') {
    return 'toggle_help';
  }

  return null;
}
