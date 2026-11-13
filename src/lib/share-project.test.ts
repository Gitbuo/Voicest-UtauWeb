/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeProject,
  generateProjectShareUrl,
  parseProjectFromShareUrl,
  bytesToBase64Url,
  base64UrlToBytes,
} from './share-project.ts';

describe('Voicest V2X Project Share URL & Stability', () => {
  const sampleProject = {
    nm: 'My Stellar Melody',
    bpm: 128,
    bars: 8,
    bonus: {
      autoBreath: true,
      flutter: true,
      deEsser: true,
    },
    ch: [
      {
        id: 1,
        name: 'Vocal',
        k: 'Voice',
        v: 0.85,
        vp: { append: 'power', cl: 0.9 },
        n: [
          { s: 0, l: 4, p: 60, t: 'ka' },
          { s: 4, l: 4, p: 64, t: 'na' },
          { s: 8, l: 8, p: 67, t: 'de' },
        ],
      },
    ],
  };

  it('sanitizeProject: handles missing, invalid, or out-of-range parameters gracefully', () => {
    const corrupt = {
      bpm: 9999, // out of range
      bars: 7, // not a standard bar count
      ch: [
        {
          id: 'bad_id',
          name: 'Track with bad notes',
          k: 'UnknownInstrument',
          n: [
            { s: -10, l: -5, p: 250, t: 'invalid' },
          ],
        },
      ],
    };

    const clean = sanitizeProject(corrupt);
    assert.equal(clean.bpm, 240); // clamped
    assert.equal(clean.bars, 4); // fallback to 4
    assert.equal(clean.ch[0].k, 'Voice'); // fallback to Voice
    assert.equal(clean.ch[0].n[0].s, 0); // clamped to >= 0
    assert.equal(clean.ch[0].n[0].l, 1); // clamped to >= 1
    assert.ok(clean.ch[0].n[0].p >= 36 && clean.ch[0].n[0].p <= 96); // transposed into valid range
  });

  it('bytesToBase64Url and base64UrlToBytes: correctly encode and decode binary buffers without URL-breaking chars', () => {
    const original = new Uint8Array([0, 255, 128, 64, 32, 16, 8, 4, 2, 1, 100, 200]);
    const encoded = bytesToBase64Url(original);
    assert.ok(!encoded.includes('+'));
    assert.ok(!encoded.includes('/'));
    assert.ok(!encoded.includes('='));

    const decoded = base64UrlToBytes(encoded);
    assert.deepEqual(decoded, original);
  });

  it('generateProjectShareUrl & parseProjectFromShareUrl: compresses and reconstructs full project from URL hash', async () => {
    const { url, code } = await generateProjectShareUrl(sampleProject, 'https://ais-dev.run.app');
    assert.ok(url.startsWith('https://ais-dev.run.app#share='));
    assert.ok(code.length > 10);

    const reconstructed = await parseProjectFromShareUrl(url);
    assert.ok(reconstructed !== null);
    assert.equal(reconstructed.nm, 'My Stellar Melody');
    assert.equal(reconstructed.bpm, 128);
    assert.equal(reconstructed.bars, 8);
    assert.equal(reconstructed.ch.length, 1);
    assert.equal(reconstructed.ch[0].name, 'Vocal');
    assert.equal(reconstructed.ch[0].n.length, 3);
    assert.equal(reconstructed.ch[0].n[0].t, 'ka');
    assert.equal(reconstructed.ch[0].n[1].p, 64);
    assert.equal(reconstructed.ch[0].n[2].t, 'de');
    assert.equal(reconstructed.ch[0].vp?.append, 'power');
  });

  it('parseProjectFromShareUrl: parses query param ?project=... as well', async () => {
    const { code } = await generateProjectShareUrl(sampleProject);
    const queryUrl = `https://studio.example.com/?project=${code}`;
    const parsed = await parseProjectFromShareUrl(queryUrl);
    assert.ok(parsed !== null);
    assert.equal(parsed.nm, 'My Stellar Melody');
    assert.equal(parsed.bpm, 128);
  });
});
