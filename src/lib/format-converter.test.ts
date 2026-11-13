/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMusicXml,
  exportMusicXml,
  parseVsqx,
  exportVsqx,
  parseCcs,
  exportCcs,
  parseVoicestNative,
  exportVoicestNative,
  parseUst,
  exportUst,
  parseUstx,
  exportUstx,
  parseSvp,
  exportSvp,
  parseVpr,
  exportVpr,
  isBreathLyric,
} from './format-converter.ts';
import type { ConvertedProject } from './format-converter.ts';

describe('Voicest V2X Multi-Format Converter', () => {
  const sampleProject: ConvertedProject = {
    name: 'Song of Stars',
    bpm: 132,
    bars: 4,
    tracks: [
      {
        name: 'Vocal Melody',
        k: 'Voice',
        notes: [
          { s: 0, l: 4, p: 60, t: 'sa' },
          { s: 4, l: 4, p: 62, t: 'ku' },
          { s: 8, l: 8, p: 64, t: 'ra' },
        ],
      },
    ],
  };

  it('MusicXML: exports well-formed XML and parses back preserving notes, pitches, and lyrics', () => {
    const xml = exportMusicXml(sampleProject);
    assert.ok(xml.includes('<work-title>Song of Stars</work-title>'));
    assert.ok(xml.includes('<sound tempo="132"/>'));
    assert.ok(xml.includes('<text>sa</text>'));
    assert.ok(xml.includes('<text>ku</text>'));
    assert.ok(xml.includes('<text>ra</text>'));

    const parsed = parseMusicXml(xml);
    assert.equal(parsed.name, 'Song of Stars');
    assert.equal(parsed.bpm, 132);
    assert.equal(parsed.tracks.length, 1);
    assert.equal(parsed.tracks[0].notes.length, 3);
    assert.equal(parsed.tracks[0].notes[0].t, 'sa');
    assert.equal(parsed.tracks[0].notes[0].s, 0);
    assert.equal(parsed.tracks[0].notes[0].l, 4);
    assert.equal(parsed.tracks[0].notes[0].p, 60);
    assert.equal(parsed.tracks[0].notes[1].s, 4);
    assert.equal(parsed.tracks[0].notes[1].p, 62);
    assert.equal(parsed.tracks[0].notes[2].l, 8);
    assert.equal(parsed.tracks[0].notes[2].p, 64);
  });

  it('MusicXML: splits barline-crossing notes with <tie> and merges them back on import', () => {
    const crossBarProject: ConvertedProject = {
      name: 'Barline Tie Test',
      bpm: 120,
      bars: 2,
      tracks: [
        {
          name: 'Lead',
          k: 'Voice',
          notes: [
            { s: 12, l: 8, p: 67, t: 'la' }, // starts step 12 in m1, crosses barline at step 16 to step 20 in m2
          ],
        },
      ],
    };
    const xml = exportMusicXml(crossBarProject);
    assert.ok(xml.includes('<tie type="start"/>'));
    assert.ok(xml.includes('<tie type="stop"/>'));

    const parsed = parseMusicXml(xml);
    assert.equal(parsed.tracks[0].notes.length, 1);
    assert.equal(parsed.tracks[0].notes[0].s, 12);
    assert.equal(parsed.tracks[0].notes[0].l, 8);
    assert.equal(parsed.tracks[0].notes[0].p, 67);
    assert.equal(parsed.tracks[0].notes[0].t, 'la');
  });

  it('VSQX: exports and parses Vocaloid 3/4 projects including pitch bend curves', () => {
    const pitchedProject: ConvertedProject = {
      name: 'VSQX Pitch Test',
      bpm: 132,
      bars: 4,
      tracks: [
        {
          name: 'Vocaloid Lead',
          k: 'Voice',
          notes: [
            { s: 0, l: 4, p: 60, t: 'sa', pc: [[0, 58.5], [2, 60.0], [4, 60.0]] },
            { s: 4, l: 4, p: 62, t: 'ku' },
          ],
        },
      ],
    };

    const vsqxXml = exportVsqx(pitchedProject);
    assert.ok(vsqxXml.includes('<seqName><![CDATA[VSQX Pitch Test]]></seqName>'));
    assert.ok(vsqxXml.includes('<bpm>13200</bpm>'));
    assert.ok(vsqxXml.includes('<v id="S">24</v>'));
    assert.ok(vsqxXml.includes('<v id="P">'));

    const parsed = parseVsqx(vsqxXml);
    assert.equal(parsed.bpm, 132);
    assert.equal(parsed.tracks.length, 1);
    assert.equal(parsed.tracks[0].notes.length, 2);
    assert.equal(parsed.tracks[0].notes[0].t, 'sa');
    assert.equal(parsed.tracks[0].notes[0].p, 60);
    assert.ok(parsed.tracks[0].notes[0].pc && parsed.tracks[0].notes[0].pc.length >= 2);
    assert.ok(parsed.tracks[0].notes[0].pc[0][1] < 59.5);
  });

  it('CCS: exports and parses CeVIO XML projects at 960 PPQ (240 ticks/step)', () => {
    const ccsXml = exportCcs(sampleProject);
    assert.ok(ccsXml.includes('Tempo="132"'));
    assert.ok(ccsXml.includes('Lyric="sa"'));
    assert.ok(ccsXml.includes('Clock="960"')); // step 4 * 240 = 960 ticks

    const parsed = parseCcs(ccsXml);
    assert.equal(parsed.bpm, 132);
    assert.equal(parsed.tracks.length, 1);
    assert.equal(parsed.tracks[0].name, 'Vocal Melody');
    assert.equal(parsed.tracks[0].notes.length, 3);
    assert.equal(parsed.tracks[0].notes[0].t, 'sa');
    assert.equal(parsed.tracks[0].notes[0].p, 60);
    assert.equal(parsed.tracks[0].notes[1].s, 4);
    assert.equal(parsed.tracks[0].notes[2].l, 8);
  });

  it('UST: exports and parses UTAU v1.2 Mode2 pitch curves and embedded VoicestProject', () => {
    const pitchedUst: ConvertedProject = {
      name: 'UTAU Test',
      bpm: 120,
      bars: 4,
      tracks: [
        {
          name: 'UTAU Vocal',
          k: 'Voice',
          notes: [
            { s: 2, l: 4, p: 64, t: 'mi', pc: [[2, 62.5], [3, 64.0], [6, 64.0]] },
            { s: 6, l: 4, p: 65, t: 'fa' },
          ],
        },
      ],
    };

    const ust = exportUst(pitchedUst, false);
    assert.ok(ust.includes('Mode2=True'));
    assert.ok(ust.includes('Lyric=R')); // rest before step 2
    assert.ok(ust.includes('PBType=5'));

    const parsed = parseUst(ust);
    assert.equal(parsed.bpm, 120);
    assert.equal(parsed.tracks[0].notes.length, 2);
    assert.equal(parsed.tracks[0].notes[0].s, 2);
    assert.equal(parsed.tracks[0].notes[0].t, 'mi');
    assert.ok(parsed.tracks[0].notes[0].pc && parsed.tracks[0].notes[0].pc.length >= 2);

    const embeddedUst = exportUst(pitchedUst, true);
    assert.ok(embeddedUst.includes('VoicestProject='));
    const parsedLossless = parseUst(embeddedUst);
    assert.equal(parsedLossless.name, 'UTAU Test');
    assert.equal(parsedLossless.tracks[0].name, 'UTAU Vocal');
    assert.equal(parsedLossless.tracks[0].notes[0].pc?.length, 3);
  });

  it('USTX: exports and parses OpenUtau multi-track projects with pitch curves', () => {
    const ustxProj: ConvertedProject = {
      name: 'OpenUtau Piece',
      bpm: 145,
      bars: 4,
      tracks: [
        {
          name: 'Main Singer',
          k: 'Voice',
          notes: [
            { s: 0, l: 4, p: 67, t: 'ra', pc: [[0, 65.5], [2, 67], [4, 67]] },
            { s: 4, l: 4, p: 69, t: 'ri' },
          ],
        },
      ],
    };

    const yaml = exportUstx(ustxProj);
    assert.ok(yaml.includes('ustx_version: 0.6'));
    assert.ok(yaml.includes('tempos:'));
    assert.ok(yaml.includes('time_signatures:'));
    assert.ok(yaml.includes('pitch:'));

    const parsed = parseUstx(yaml);
    assert.equal(parsed.bpm, 145);
    assert.equal(parsed.tracks[0].name, 'Main Singer');
    assert.equal(parsed.tracks[0].notes.length, 2);
    assert.equal(parsed.tracks[0].notes[0].t, 'ra');
    assert.ok(parsed.tracks[0].notes[0].pc && parsed.tracks[0].notes[0].pc.length === 3);
  });

  it('SVP: exports and parses Synthesizer V projects with pitchDelta and instrumental flag', () => {
    const svpProj: ConvertedProject = {
      name: 'SynthV Session',
      bpm: 128,
      bars: 4,
      tracks: [
        {
          name: 'AI Vocal',
          k: 'Voice',
          pan: -0.25,
          notes: [
            { s: 0, l: 4, p: 62, t: 'ta', pc: [[0, 60.5], [2, 62], [4, 62]] },
          ],
        },
        {
          name: 'Accompaniment Piano',
          k: 'Piano',
          notes: [{ s: 0, l: 8, p: 48, t: 'a' }],
        },
      ],
    };

    const json = exportSvp(svpProj);
    const parsed = parseSvp(json);
    assert.equal(parsed.bpm, 128);
    assert.equal(parsed.tracks.length, 2);
    assert.equal(parsed.tracks[0].k, 'Voice');
    assert.equal(parsed.tracks[0].pan, -0.25);
    assert.ok(parsed.tracks[0].notes[0].pc && parsed.tracks[0].notes[0].pc.length >= 2);
    assert.equal(parsed.tracks[1].k, 'Piano');
  });

  it('VPR: exports and parses Vocaloid 5/6 projects with pitchBend controllers and pan/mute', () => {
    const vprProj: ConvertedProject = {
      name: 'V5 Song',
      bpm: 118,
      bars: 4,
      tracks: [
        {
          name: 'V5 Vocal',
          k: 'Voice',
          pan: 0.5,
          m: 1,
          notes: [
            { s: 0, l: 4, p: 65, t: 'na', pc: [[0, 63.5], [2, 65], [4, 65]] },
          ],
        },
      ],
    };

    const json = exportVpr(vprProj);
    const parsed = parseVpr(json);
    assert.equal(parsed.name, 'V5 Song');
    assert.equal(parsed.bpm, 118);
    assert.equal(parsed.tracks[0].m, 1);
    assert.equal(parsed.tracks[0].pan, 0.5);
    assert.equal(parsed.tracks[0].notes[0].t, 'na');
    assert.ok(parsed.tracks[0].notes[0].pc && parsed.tracks[0].notes[0].pc.length >= 2);
  });

  it('isBreathLyric: accurately distinguishes breath markers from singing syllables', () => {
    assert.equal(isBreathLyric('br'), true);
    assert.equal(isBreathLyric('br_in'), true);
    assert.equal(isBreathLyric('br_out'), true);
    assert.equal(isBreathLyric('breath'), true);
    assert.equal(isBreathLyric('ka'), false);
    assert.equal(isBreathLyric('sa'), false);
    assert.equal(isBreathLyric('a'), false);
  });

  it('Voicest Native Project: exports lossless .voi JSON and imports faithfully with pan, mute, solo', () => {
    const multiProject: ConvertedProject = {
      name: 'Full Band Session',
      bpm: 140,
      bars: 8,
      tracks: [
        {
          id: 1,
          name: 'Lead Vocal',
          k: 'Voice',
          v: 0.85,
          m: 0,
          s: 0,
          pan: -0.2,
          append: 'power',
          notes: [{ s: 0, l: 8, p: 69, t: 'la', pc: [[0, 69], [4, 69.4], [8, 69]] }],
        },
        {
          id: 2,
          name: 'Electric Bass',
          k: 'Bass',
          v: 0.75,
          m: 0,
          s: 0,
          pan: 0,
          notes: [{ s: 0, l: 16, p: 40, t: 'a' }],
        },
      ],
    };

    const nativeJson = exportVoicestNative(multiProject);
    assert.ok(nativeJson.includes('"version": "2.0-V2X"'));
    assert.ok(nativeJson.includes('"Full Band Session"'));
    assert.ok(nativeJson.includes('"pan": -0.2'));

    const parsed = parseVoicestNative(nativeJson);
    assert.equal(parsed.name, 'Full Band Session');
    assert.equal(parsed.bpm, 140);
    assert.equal(parsed.tracks.length, 2);
    assert.equal(parsed.tracks[0].k, 'Voice');
    assert.equal(parsed.tracks[0].pan, -0.2);
    assert.equal(parsed.tracks[0].append, 'power');
    assert.equal(parsed.tracks[0].notes[0].pc?.length, 3);
    assert.equal(parsed.tracks[1].k, 'Bass');
    assert.equal(parsed.tracks[1].pan, 0);
  });

  it('MusicXML: exports Bass track with F clef and programs, parses instrument types', () => {
    const bandProject: ConvertedProject = {
      name: 'Orchestral Piece',
      bpm: 100,
      bars: 4,
      tracks: [
        {
          name: 'Flute Solo',
          k: 'Flute',
          notes: [{ s: 0, l: 4, p: 72, t: 'a' }],
        },
        {
          name: 'Double Bass',
          k: 'Bass',
          notes: [{ s: 0, l: 4, p: 36, t: 'a' }],
        },
      ],
    };

    const xml = exportMusicXml(bandProject);
    assert.ok(xml.includes('<sign>F</sign><line>4</line>')); // Bass clef for Bass
    assert.ok(xml.includes('<midi-program>74</midi-program>')); // Flute
    assert.ok(xml.includes('<midi-program>34</midi-program>')); // Bass

    const parsed = parseMusicXml(xml);
    assert.equal(parsed.tracks.length, 2);
    assert.equal(parsed.tracks[0].k, 'Flute');
    assert.equal(parsed.tracks[1].k, 'Bass');
  });
});
