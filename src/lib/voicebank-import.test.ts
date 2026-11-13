/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeTextWithBom,
  isIgnoredVbPath,
  isSupportedVbAsset,
  isAudioVbFile,
  parseOtoIni,
  clampLyricPopoverRect,
} from './voicebank-import.ts';

function encodeUtf16LeWithBom(str: string): Uint8Array {
  const out = new Uint8Array(2 + str.length * 2);
  out[0] = 0xff;
  out[1] = 0xfe;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    out[2 + i * 2] = code & 0xff;
    out[2 + i * 2 + 1] = code >> 8;
  }
  return out;
}

function encodeUtf16BeWithBom(str: string): Uint8Array {
  const out = new Uint8Array(2 + str.length * 2);
  out[0] = 0xfe;
  out[1] = 0xff;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    out[2 + i * 2] = code >> 8;
    out[2 + i * 2 + 1] = code & 0xff;
  }
  return out;
}

describe('Voicebank Import & Lyric Popover Helpers', () => {
  it('decodeTextWithBom handles UTF-16LE, UTF-16BE, UTF-8 BOM, and UTF-8 text', () => {
    const sample = 'a.wav=あ,10,50,-80,20,10';
    assert.equal(decodeTextWithBom(encodeUtf16LeWithBom(sample)), sample);
    assert.equal(decodeTextWithBom(encodeUtf16BeWithBom(sample)), sample);

    const utf8Bytes = new TextEncoder().encode(sample);
    const utf8WithBom = new Uint8Array(3 + utf8Bytes.length);
    utf8WithBom[0] = 0xef;
    utf8WithBom[1] = 0xbb;
    utf8WithBom[2] = 0xbf;
    utf8WithBom.set(utf8Bytes, 3);
    assert.equal(decodeTextWithBom(utf8WithBom), sample);
    assert.equal(decodeTextWithBom(utf8Bytes), sample);
  });

  it('filters out macOS AppleDouble, __MACOSX folders, and resampler cache files', () => {
    assert.equal(isIgnoredVbPath('__MACOSX/MyVB/._oto.ini'), true);
    assert.equal(isIgnoredVbPath('MyVB/._a.wav'), true);
    assert.equal(isIgnoredVbPath('MyVB/.DS_Store'), true);
    assert.equal(isIgnoredVbPath('MyVB/Thumbs.db'), true);
    assert.equal(isIgnoredVbPath('MyVB/a_wav.llsm'), true);
    assert.equal(isIgnoredVbPath('MyVB/voice.mrq'), true);
    assert.equal(isIgnoredVbPath('MyVB/oto.ini'), false);
    assert.equal(isIgnoredVbPath('MyVB/character.png'), false);
    assert.equal(isIgnoredVbPath('MyVB/a.wav'), false);
  });

  it('recognizes all supported audio, metadata, and character image formats', () => {
    assert.equal(isAudioVbFile('ka.wav'), true);
    assert.equal(isAudioVbFile('ka.flac'), true);
    assert.equal(isAudioVbFile('ka.ogg'), true);
    assert.equal(isAudioVbFile('ka.mp3'), true);
    assert.equal(isAudioVbFile('ka.aiff'), true);
    assert.equal(isAudioVbFile('character.png'), false);

    assert.equal(isSupportedVbAsset('character.png'), true);
    assert.equal(isSupportedVbAsset('character.yaml'), true);
    assert.equal(isSupportedVbAsset('oto.ini'), true);
    assert.equal(isSupportedVbAsset('prefix.map'), true);
    assert.equal(isSupportedVbAsset('a_wav.frq'), true);
    assert.equal(isSupportedVbAsset('installer.exe'), false);
  });

  it('parseOtoIni handles UTF-8 BOM, ./ prefix, relative dirs, and 3-5 numeric columns', () => {
    const ini = [
      '\uFEFF# comment',
      './ka.wav=か,12.5,80,-120.5,35,15',
      'ki.flac=,5,60,-90',
      'subdir\\ku.wav=く,1e1,40,-50,15,5',
      'badline_without_equals',
    ].join('\n');

    const rows = parseOtoIni(ini, 'cv_dir');
    assert.equal(rows.length, 3);
    assert.equal(rows[0].file, 'cv_dir/ka.wav');
    assert.equal(rows[0].alias, 'か');
    assert.equal(rows[0].preutterance, 35);
    assert.equal(rows[0].overlap, 15);

    assert.equal(rows[1].file, 'cv_dir/ki.flac');
    assert.equal(rows[1].alias, 'ki');
    assert.equal(rows[1].preutterance, 0);

    assert.equal(rows[2].file, 'cv_dir/subdir/ku.wav');
    assert.equal(rows[2].offset, 10);
  });

  it('clampLyricPopoverRect keeps popover inside visible viewport and flips near bottom', () => {
    const rightEdge = clampLyricPopoverRect({
      noteLeft: 950,
      noteTop: 120,
      noteHeight: 14,
      scrollLeft: 200,
      scrollTop: 0,
      viewportWidth: 800,
      viewportHeight: 400,
      popWidth: 230,
      popHeight: 68,
      keyWidth: 34,
    });
    assert.ok(rightEdge.left <= 200 + 800 - 230 - 8);
    assert.equal(rightEdge.flipAbove, false);

    const bottomEdge = clampLyricPopoverRect({
      noteLeft: 100,
      noteTop: 370,
      noteHeight: 14,
      scrollLeft: 0,
      scrollTop: 0,
      viewportWidth: 800,
      viewportHeight: 400,
      popWidth: 230,
      popHeight: 68,
      keyWidth: 34,
    });
    assert.equal(bottomEdge.flipAbove, true);
    assert.ok(bottomEdge.top < 370);
  });
});
