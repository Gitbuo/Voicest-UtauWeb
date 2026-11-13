/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * Voicest V2X Multi-Format Converter
 * Supports bidirectional import & export for:
 * - MusicXML (.musicxml, .xml)
 * - VSQX (Vocaloid 3/4)
 * - VPR (Vocaloid 5/6)
 * - CCS / CCSS (CeVIO Creative Studio & CeVIO AI)
 * - UST (UTAU v1.2 with Mode2 pitch curves)
 * - USTX (OpenUtau multi-track with pitch curves)
 * - SVP (Synthesizer V Studio with pitchDelta curves)
 * - Voicest Native Project (.voi, .voicest, .json)
 */

export interface ConvertedNote {
  s: number; // 1/16 step position (0-based)
  l: number; // Duration in 1/16 steps (>= 1)
  p: number; // MIDI pitch number (36-96 typically)
  t: string; // Lyric / phoneme
  pc?: Array<[number, number]>; // Pitch curve points [step, pitch]
}

export type InstrumentKind =
  | 'Piano'
  | 'EPiano'
  | 'Musicbox'
  | 'Violin'
  | 'Strings'
  | 'Guitar'
  | 'Bass'
  | 'Brass'
  | 'Flute'
  | 'Chip'
  | 'Voice'
  | 'Sample';

export interface ConvertedTrack {
  id?: number;
  name: string;
  notes: ConvertedNote[];
  k?: InstrumentKind | string; // Voice, Piano, Bass, Strings, Brass, Flute, etc.
  v?: number; // Volume 0..1
  m?: number; // Mute 0/1
  s?: number; // Solo 0/1
  pan?: number; // Stereo Pan -1..1
  append?: string; // Cestloid append timbre
}

export interface ConvertedProject {
  name: string;
  bpm: number;
  bars: number;
  tracks: ConvertedTrack[];
  scale?: number;
  root?: number;
}

const STEP_MIDI_LO = 36;
const STEP_MIDI_HI = 96;

/** Clamps pitch to valid singing synth range */
export function clampPitch(p: number): number {
  if (!isFinite(p)) return 60;
  let pitch = Math.round(p);
  while (pitch < STEP_MIDI_LO) pitch += 12;
  while (pitch > STEP_MIDI_HI) pitch -= 12;
  return pitch;
}

// ==========================================
// 1. MusicXML Parser & Exporter
// ==========================================

const STEP_TO_SEMITONE: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};
const SEMITONE_TO_STEP: Array<{ step: string; alter: number }> = [
  { step: 'C', alter: 0 },
  { step: 'C', alter: 1 },
  { step: 'D', alter: 0 },
  { step: 'D', alter: 1 },
  { step: 'E', alter: 0 },
  { step: 'F', alter: 0 },
  { step: 'F', alter: 1 },
  { step: 'G', alter: 0 },
  { step: 'G', alter: 1 },
  { step: 'A', alter: 0 },
  { step: 'A', alter: 1 },
  { step: 'B', alter: 0 },
];

export function detectInstrumentFromTrackName(name: string): InstrumentKind {
  const lower = name.toLowerCase();
  if (/bass|contrabass|double\s*bass|fretless/i.test(lower)) return 'Bass';
  if (/electric\s*piano|rhodes|wurlitzer|epiano|e-piano/i.test(lower)) return 'EPiano';
  if (/piano|grand|keyboard|clav/i.test(lower)) return 'Piano';
  if (/music\s*box|celesta|glock/i.test(lower)) return 'Musicbox';
  if (/violin|fiddle/i.test(lower)) return 'Violin';
  if (/strings|orchestra|cello|viola|ensemble/i.test(lower)) return 'Strings';
  if (/guitar|acoustic|electric\s*guitar|nylon/i.test(lower)) return 'Guitar';
  if (/brass|trumpet|trombone|horn|tuba/i.test(lower)) return 'Brass';
  if (/flute|piccolo|recorder|pan flute/i.test(lower)) return 'Flute';
  if (/chip|8-bit|8bit|square|chiptune|retro/i.test(lower)) return 'Chip';
  if (/vocal|voice|lead\s*vox|singer|singing|choir|soprano|alto|tenor/i.test(lower)) return 'Voice';
  return 'Voice';
}

const INSTRUMENT_MIDI_PROGRAM: Record<string, number> = {
  Piano: 1,
  EPiano: 5,
  Musicbox: 11,
  Guitar: 25,
  Bass: 34,
  Violin: 41,
  Strings: 49,
  Voice: 55,
  Brass: 62,
  Flute: 74,
  Chip: 81,
  Sample: 1,
};

function detectInstrumentFromMidiProgram(prog: number): InstrumentKind {
  if (prog >= 1 && prog <= 4) return 'Piano';
  if (prog >= 5 && prog <= 8) return 'EPiano';
  if (prog >= 9 && prog <= 16) return 'Musicbox';
  if (prog >= 25 && prog <= 32) return 'Guitar';
  if (prog >= 33 && prog <= 40) return 'Bass';
  if (prog >= 41 && prog <= 44) return 'Violin';
  if (prog >= 45 && prog <= 52) return 'Strings';
  if (prog >= 53 && prog <= 56) return 'Voice';
  if (prog >= 57 && prog <= 64) return 'Brass';
  if (prog >= 73 && prog <= 80) return 'Flute';
  if (prog >= 81 && prog <= 88) return 'Chip';
  return 'Voice';
}

/** Parse a MusicXML score-partwise file */
export function parseMusicXml(xmlText: string): ConvertedProject {
  let bpm = 120;
  const tempoMatch = xmlText.match(/tempo="([0-9.]+)"/) || xmlText.match(/<per-minute>([0-9.]+)<\/per-minute>/);
  if (tempoMatch) {
    const val = parseFloat(tempoMatch[1]);
    if (val >= 40 && val <= 240) bpm = Math.round(val);
  }

  let title = 'MusicXML Project';
  const titleMatch = xmlText.match(/<work-title>([\s\S]*?)<\/work-title>/) || xmlText.match(/<movement-title>([\s\S]*?)<\/movement-title>/);
  if (titleMatch) title = titleMatch[1].trim();

  const parts: ConvertedTrack[] = [];
  const partRegex = /<part\s+id="([^"]+)">([\s\S]*?)<\/part>/g;
  let partMatch: RegExpExecArray | null;

  while ((partMatch = partRegex.exec(xmlText)) !== null) {
    const partId = partMatch[1];
    const partBody = partMatch[2];

    const scorePartRe = new RegExp(`<score-part\\s+id="${partId}">([\\s\\S]*?)<\\/score-part>`, 'i');
    const spBody = xmlText.match(scorePartRe)?.[1] || '';
    const nameMatch = spBody.match(/<part-name>([\s\S]*?)<\/part-name>/i);
    const instNameMatch = spBody.match(/<instrument-name>([\s\S]*?)<\/instrument-name>/i);
    const midiProgMatch = spBody.match(/<midi-program>(\d+)<\/midi-program>/i);

    const trackName = nameMatch ? nameMatch[1].trim() : `Part ${partId}`;
    let detectedKind: InstrumentKind = detectInstrumentFromTrackName(trackName);
    if (detectedKind === 'Voice' && instNameMatch) {
      const fromInst = detectInstrumentFromTrackName(instNameMatch[1].trim());
      if (fromInst !== 'Voice') detectedKind = fromInst;
    }
    if (detectedKind === 'Voice' && midiProgMatch) {
      const prog = parseInt(midiProgMatch[1], 10);
      const fromProg = detectInstrumentFromMidiProgram(prog);
      if (fromProg !== 'Voice' || (instNameMatch && /voice|vocal/i.test(instNameMatch[1]))) {
        detectedKind = fromProg;
      }
    }

    let currentStep = 0;
    let lastOnsetStep = 0;
    let divisions = 480;
    const notes: ConvertedNote[] = [];
    const activeTies = new Map<number, ConvertedNote>();
    let hasRealLyrics = false;

    const measureRegex = /<measure\b[^>]*>([\s\S]*?)<\/measure>/g;
    let mMatch: RegExpExecArray | null;

    while ((mMatch = measureRegex.exec(partBody)) !== null) {
      const mBody = mMatch[1];

      const divMatch = mBody.match(/<divisions>(\d+)<\/divisions>/);
      if (divMatch) divisions = Math.max(1, parseInt(divMatch[1], 10));

      const tokenRegex = /<(note|backup|forward)\b[^>]*>([\s\S]*?)<\/\1>/g;
      let tMatch: RegExpExecArray | null;

      while ((tMatch = tokenRegex.exec(mBody)) !== null) {
        const tag = tMatch[1];
        const body = tMatch[2];

        const durMatch = body.match(/<duration>(\d+)<\/duration>/);
        const durDiv = durMatch ? Math.max(1, parseInt(durMatch[1], 10)) : divisions;
        const stepLength = Math.max(1, Math.round((durDiv * 4) / divisions));

        if (tag === 'backup') {
          currentStep = Math.max(0, currentStep - stepLength);
          continue;
        }
        if (tag === 'forward') {
          currentStep += stepLength;
          continue;
        }

        const isRest = /<rest\b/i.test(body);
        const isChord = /<chord\b/i.test(body);
        const onsetStep = isChord ? lastOnsetStep : currentStep;

        if (!isChord) {
          lastOnsetStep = currentStep;
          currentStep += stepLength;
        }

        if (isRest) continue;

        let pitch = 60;
        const stepMatch = body.match(/<step>([A-G])<\/step>/);
        const octMatch = body.match(/<octave>(\d+)<\/octave>/);
        const altMatch = body.match(/<alter>([+-]?\d+)<\/alter>/);

        if (stepMatch && octMatch) {
          const stepLetter = stepMatch[1];
          const octave = parseInt(octMatch[1], 10);
          const alter = altMatch ? parseInt(altMatch[1], 10) : 0;
          const semi = STEP_TO_SEMITONE[stepLetter] ?? 0;
          pitch = clampPitch((octave + 1) * 12 + semi + alter);
        }

        const hasTieStop = /<tie\b[^>]*type="stop"/i.test(body) || /<tied\b[^>]*type="stop"/i.test(body);
        const hasTieStart = /<tie\b[^>]*type="start"/i.test(body) || /<tied\b[^>]*type="start"/i.test(body);

        if (hasTieStop && activeTies.has(pitch)) {
          const prev = activeTies.get(pitch)!;
          prev.l += stepLength;
          if (!hasTieStart) {
            activeTies.delete(pitch);
          }
          continue;
        }

        let lyric = 'a';
        const lyricMatch = body.match(/<text>([\s\S]*?)<\/text>/);
        if (lyricMatch) {
          const lText = lyricMatch[1].trim();
          if (lText) {
            lyric = lText;
            if (lText.toLowerCase() !== 'a' || detectedKind === 'Voice') {
              hasRealLyrics = true;
            }
          }
        }

        const noteObj: ConvertedNote = {
          s: onsetStep,
          l: stepLength,
          p: pitch,
          t: lyric,
        };
        notes.push(noteObj);
        if (hasTieStart) {
          activeTies.set(pitch, noteObj);
        }
      }
    }

    if (notes.length > 0) {
      parts.push({
        name: trackName,
        k: hasRealLyrics ? 'Voice' : detectedKind,
        notes,
      });
    }
  }

  if (!parts.length) {
    parts.push({
      name: 'Vocal',
      k: 'Voice',
      notes: [{ s: 0, l: 4, p: 60, t: 'a' }],
    });
  }

  const maxStep = Math.max(...parts.flatMap(p => p.notes.map(n => n.s + n.l)), 64);
  const bars = Math.max(4, Math.ceil(maxStep / 16));

  return {
    name: title,
    bpm,
    bars,
    tracks: parts,
  };
}

/** Export track notes to standard MusicXML score-partwise */
export function exportMusicXml(project: ConvertedProject): string {
  const divisions = 4; // 1 step (1/16) = 1 division, 1 quarter note (4 steps) = 4 divisions
  const tracks = project.tracks.length ? project.tracks : [{ name: 'Vocal', notes: [] }];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work>
    <work-title>${escapeXml(project.name || 'Voicest Project')}</work-title>
  </work>
  <part-list>
`;

  tracks.forEach((tr, idx) => {
    const instKind = tr.k || 'Voice';
    const prog = INSTRUMENT_MIDI_PROGRAM[instKind] || 55;
    xml += `    <score-part id="P${idx + 1}">
      <part-name>${escapeXml(tr.name || `Track ${idx + 1}`)}</part-name>
      <score-instrument id="P${idx + 1}-I1">
        <instrument-name>${escapeXml(instKind)}</instrument-name>
      </score-instrument>
      <midi-instrument id="P${idx + 1}-I1">
        <midi-program>${prog}</midi-program>
      </midi-instrument>
    </score-part>
`;
  });

  xml += `  </part-list>
`;

  tracks.forEach((tr, tIdx) => {
    const isBass = tr.k === 'Bass';
    const clefXml = isBass
      ? `<clef><sign>F</sign><line>4</line></clef>`
      : `<clef><sign>G</sign><line>2</line></clef>`;

    xml += `  <part id="P${tIdx + 1}">
`;
    const sorted = [...tr.notes].sort((a, b) => a.s - b.s);
    const totalSteps = sorted.length ? Math.max(...sorted.map(n => n.s + n.l)) : 16;
    const numMeasures = Math.max(1, Math.ceil(totalSteps / 16));

    // Split notes that cross barlines into tied segments so every 4/4 measure balances cleanly
    const segs: Array<{ s: number; l: number; p: number; t: string; tieStart?: boolean; tieStop?: boolean; emitLyric: boolean }> = [];
    for (const n of sorted) {
      const isVoiceTrack = tr.k === 'Voice' || Boolean(n.t && n.t.toLowerCase() !== 'a');
      let rem = n.l;
      let segStart = n.s;
      let first = true;
      while (rem > 0) {
        const mEnd = (Math.floor(segStart / 16) + 1) * 16;
        const take = Math.min(rem, mEnd - segStart);
        segs.push({
          s: segStart,
          l: take,
          p: n.p,
          t: n.t,
          tieStop: !first,
          tieStart: rem > take,
          emitLyric: first && isVoiceTrack,
        });
        segStart += take;
        rem -= take;
        first = false;
      }
    }

    let noteIdx = 0;
    for (let m = 0; m < numMeasures; m++) {
      const mStart = m * 16;
      const mEnd = mStart + 16;
      let curStep = mStart;

      xml += `    <measure number="${m + 1}">
`;
      if (m === 0) {
        xml += `      <attributes>
        <divisions>${divisions}</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        ${clefXml}
      </attributes>
      <direction placement="above">
        <sound tempo="${project.bpm || 120}"/>
      </direction>
`;
      }

      while (noteIdx < segs.length && segs[noteIdx].s < mEnd) {
        const n = segs[noteIdx];
        if (n.s > curStep) {
          const restLen = Math.min(n.s - curStep, mEnd - curStep);
          xml += `      <note>
        <rest/>
        <duration>${restLen}</duration>
      </note>
`;
          curStep += restLen;
        }

        if (curStep >= mEnd) break;

        const effectiveLen = Math.min(n.l, mEnd - curStep);
        const semiInOct = ((n.p % 12) + 12) % 12;
        const octave = Math.floor(n.p / 12) - 1;
        const { step, alter } = SEMITONE_TO_STEP[semiInOct];
        const tieXml = `${n.tieStop ? '<tie type="stop"/>' : ''}${n.tieStart ? '<tie type="start"/>' : ''}`;

        xml += `      <note>
        <pitch>
          <step>${step}</step>
          ${alter ? `<alter>${alter}</alter>` : ''}
          <octave>${octave}</octave>
        </pitch>
        <duration>${effectiveLen}</duration>
        ${tieXml}
        ${n.emitLyric ? `<lyric><text>${escapeXml(n.t || 'a')}</text></lyric>` : ''}
      </note>
`;
        curStep += effectiveLen;
        noteIdx++;
      }

      if (curStep < mEnd) {
        const remainingRest = mEnd - curStep;
        xml += `      <note>
        <rest/>
        <duration>${remainingRest}</duration>
      </note>
`;
      }

      xml += `    </measure>
`;
    }

    xml += `  </part>
`;
  });

  xml += `</score-partwise>
`;
  return xml;
}

// ==========================================
// 2. VSQX (Vocaloid 3/4) Parser & Exporter
// ==========================================

function buildPitchCurveFromEvents(
  pitEvents: Array<[number, number]>,
  pbsEvents: Array<[number, number]>,
  stepStart: number,
  stepLen: number,
  basePitch: number,
  ticksPerStep = 120,
): Array<[number, number]> | undefined {
  if (!pitEvents.length) return undefined;
  const valAt = (tick: number): number => {
    let v = 0;
    for (const [t, val] of pitEvents) {
      if (t <= tick) v = val;
      else break;
    }
    return v;
  };
  const sensAt = (tick: number): number => {
    let s = 2;
    for (const [t, val] of pbsEvents) {
      if (t <= tick) s = val || 2;
      else break;
    }
    return s;
  };
  const numPts = Math.max(2, Math.ceil(stepLen * 2));
  const curve: Array<[number, number]> = [];
  let maxDev = 0;
  for (let i = 0; i <= numPts; i++) {
    const xStep = stepStart + (stepLen * i) / numPts;
    const tick = Math.round(xStep * ticksPerStep);
    const semiDev = (valAt(tick) / 8192) * sensAt(tick);
    maxDev = Math.max(maxDev, Math.abs(semiDev));
    curve.push([Math.round(xStep * 1000) / 1000, Math.round((basePitch + semiDev) * 1000) / 1000]);
  }
  return maxDev > 0.03 ? curve : undefined;
}

export function parseVsqx(xmlText: string): ConvertedProject {
  let bpm = 120;
  const bpmMatch = xmlText.match(/<bpm>(\d+)<\/bpm>/);
  if (bpmMatch) {
    const val = parseInt(bpmMatch[1], 10);
    bpm = Math.round(val / 100);
    if (bpm < 40 || bpm > 240) bpm = 120;
  }

  const preMatch = xmlText.match(/<preMeasure>(\d+)<\/preMeasure>/);
  const preMeasures = preMatch ? parseInt(preMatch[1], 10) : 0;
  const resMatch = xmlText.match(/<resolution>(\d+)<\/resolution>/);
  const resolution = resMatch ? Math.max(1, parseInt(resMatch[1], 10)) : 480;
  const barTicks = resolution * 4;

  const tracks: ConvertedTrack[] = [];
  const trackRegex = /<vsTrack\b[^>]*>([\s\S]*?)<\/vsTrack>/g;
  let trMatch: RegExpExecArray | null;

  while ((trMatch = trackRegex.exec(xmlText)) !== null) {
    const trBody = trMatch[1];
    const nameMatch = trBody.match(/<name><!\[CDATA\[([\s\S]*?)\]\]><\/name>/) || trBody.match(/<name>([\s\S]*?)<\/name>/);
    const trackName = nameMatch ? nameMatch[1].trim() : 'Vocaloid Track';

    const partRegex = /<(?:musicalPart|vsPart)\b[^>]*>([\s\S]*?)<\/(?:musicalPart|vsPart)>/g;
    let pMatch: RegExpExecArray | null;
    const notes: ConvertedNote[] = [];
    const pitEvents: Array<[number, number]> = [];
    const pbsEvents: Array<[number, number]> = [];

    while ((pMatch = partRegex.exec(trBody)) !== null) {
      const pBody = pMatch[1];
      const partPosMatch = pBody.match(/<(?:posTick|t)>(\d+)<\/(?:posTick|t)>/);
      const rawPartPos = partPosMatch ? parseInt(partPosMatch[1], 10) : 0;
      const partOffTick = Math.max(0, rawPartPos - preMeasures * barTicks);

      const ccRegex = /<(?:cc|mCtrl)\b[^>]*>([\s\S]*?)<\/(?:cc|mCtrl)>/g;
      let cMatch: RegExpExecArray | null;
      while ((cMatch = ccRegex.exec(pBody)) !== null) {
        const cBody = cMatch[1];
        const tMatch = cBody.match(/<(?:posTick|t)>(\d+)<\/(?:posTick|t)>/);
        const vMatch = cBody.match(/<(?:attr|v)\s+id="([^"]+)">([+-]?\d+)<\/(?:attr|v)>/);
        if (tMatch && vMatch) {
          const absTick = partOffTick + parseInt(tMatch[1], 10);
          const id = vMatch[1];
          const val = parseInt(vMatch[2], 10);
          if (id === 'P' || id === 'PIT') pitEvents.push([absTick, val]);
          else if (id === 'S' || id === 'PBS') pbsEvents.push([absTick, val]);
        }
      }

      const noteRegex = /<note\b[^>]*>([\s\S]*?)<\/note>/g;
      let nMatch: RegExpExecArray | null;

      while ((nMatch = noteRegex.exec(pBody)) !== null) {
        const nBody = nMatch[1];
        const posMatch = nBody.match(/<(?:posTick|t)>(\d+)<\/(?:posTick|t)>/);
        const durMatch = nBody.match(/<(?:durTick|dur)>(\d+)<\/(?:durTick|dur)>/);
        const numMatch = nBody.match(/<(?:noteNum|n)>(\d+)<\/(?:noteNum|n)>/);
        const lyrMatch = nBody.match(/<(?:lyric|y)><!\[CDATA\[([\s\S]*?)\]\]><\/(?:lyric|y)>/) || nBody.match(/<(?:lyric|y)>([\s\S]*?)<\/(?:lyric|y)>/);

        if (posMatch && durMatch && numMatch) {
          const tick = partOffTick + parseInt(posMatch[1], 10);
          const dur = parseInt(durMatch[1], 10);
          const ticksPerStep = resolution / 4;
          const step = Math.round(tick / ticksPerStep);
          const length = Math.max(1, Math.round(dur / ticksPerStep));
          const pitch = clampPitch(parseInt(numMatch[1], 10));
          const lyric = lyrMatch ? lyrMatch[1].trim() : 'a';

          notes.push({ s: step, l: length, p: pitch, t: lyric || 'a' });
        }
      }
    }

    pitEvents.sort((a, b) => a[0] - b[0]);
    pbsEvents.sort((a, b) => a[0] - b[0]);
    if (pitEvents.length) {
      const ticksPerStep = resolution / 4;
      for (const n of notes) {
        const pc = buildPitchCurveFromEvents(pitEvents, pbsEvents, n.s, n.l, n.p, ticksPerStep);
        if (pc) n.pc = pc;
      }
    }

    if (notes.length) {
      tracks.push({ name: trackName, k: 'Voice', notes });
    }
  }

  if (!tracks.length) {
    tracks.push({ name: 'Vocaloid Track', k: 'Voice', notes: [{ s: 0, l: 4, p: 60, t: 'a' }] });
  }

  const maxStep = Math.max(...tracks.flatMap(t => t.notes.map(n => n.s + n.l)), 64);
  return {
    name: 'VSQX Project',
    bpm,
    bars: Math.max(4, Math.ceil(maxStep / 16)),
    tracks,
  };
}

export function exportVsqx(project: ConvertedProject): string {
  const bpmCenti = Math.round((project.bpm || 120) * 100);
  const tracks = project.tracks.length ? project.tracks : [{ name: 'Track 1', notes: [] }];

  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<vsq4 xmlns="http://www.yamaha.co.jp/vocaloid/schema/vsq4/"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="http://www.yamaha.co.jp/vocaloid/schema/vsq4/ vsq4.xsd">
  <vender><![CDATA[Yamaha corporation]]></vender>
  <version><![CDATA[4.0.0.3]]></version>
  <vVoiceTable>
    <vVoice>
      <bs>0</bs>
      <pc>0</pc>
      <id><![CDATA[Cestloid]]></id>
      <name><![CDATA[Cestloid]]></name>
    </vVoice>
  </vVoiceTable>
  <mixer>
    <masterUnit>
      <oDev>0</oDev>
      <rLvl>0</rLvl>
      <vol>0</vol>
    </masterUnit>
    <vsUnit>
      <tNo>0</tNo>
      <iGin>0</iGin>
      <sLvl>-898</sLvl>
      <sEnable>0</sEnable>
      <m>0</m>
      <s>0</s>
      <pan>64</pan>
      <vol>0</vol>
    </vsUnit>
  </mixer>
  <masterTrack>
    <seqName><![CDATA[${escapeCdata(project.name || 'Voicest Project')}]]></seqName>
    <comment><![CDATA[Created in Voicest V2X]]></comment>
    <resolution>480</resolution>
    <preMeasure>4</preMeasure>
    <timeSig>
      <m>0</m>
      <nu>4</nu>
      <de>4</de>
    </timeSig>
    <tempo>
      <posTick>0</posTick>
      <bpm>${bpmCenti}</bpm>
    </tempo>
  </masterTrack>
`;

  tracks.forEach((tr, tIdx) => {
    const sorted = [...tr.notes].sort((a, b) => a.s - b.s);
    const maxTick = sorted.length ? Math.max(...sorted.map(n => (n.s + n.l) * 120)) : 76800;

    xml += `  <vsTrack>
    <tNo>${tIdx}</tNo>
    <name><![CDATA[${escapeCdata(tr.name || `Track ${tIdx + 1}`)}]]></name>
    <comment><![CDATA[Voicest Track]]></comment>
    <musicalPart>
      <posTick>7680</posTick>
      <playTime>${Math.max(76800, maxTick + 1920)}</playTime>
      <name><![CDATA[Part 1]]></name>
      <comment><![CDATA[]]></comment>
      <singer>
        <posTick>0</posTick>
        <vBS>0</vBS>
        <vPC>0</vPC>
      </singer>
`;

    const pitList: Array<{ tick: number; val: number }> = [];
    sorted.forEach(n => {
      if (n.pc && n.pc.length > 1) {
        n.pc.forEach(q => {
          const val = Math.max(-8192, Math.min(8191, Math.round(((q[1] - n.p) / 24) * 8192)));
          pitList.push({ tick: Math.max(0, Math.round(q[0] * 120)), val });
        });
        pitList.push({ tick: Math.max(0, Math.round((n.s + n.l) * 120)), val: 0 });
      }
    });
    if (pitList.length) {
      pitList.sort((a, b) => a.tick - b.tick);
      xml += `      <cc><t>0</t><v id="S">24</v></cc>\n`;
      for (const p of pitList) {
        xml += `      <cc><t>${p.tick}</t><v id="P">${p.val}</v></cc>\n`;
      }
    }

    sorted.forEach(n => {
      xml += `      <note>
        <posTick>${n.s * 120}</posTick>
        <durTick>${n.l * 120}</durTick>
        <noteNum>${n.p}</noteNum>
        <velocity>64</velocity>
        <lyric><![CDATA[${escapeCdata(n.t || 'a')}]]></lyric>
        <phnms><![CDATA[${escapeCdata(n.t || 'a')}]]></phnms>
      </note>
`;
    });

    xml += `    </musicalPart>
  </vsTrack>
`;
  });

  xml += `</vsq4>
`;
  return xml;
}

// ==========================================
// 3. CeVIO CCS / CCSS Parser & Exporter
// ==========================================

const CEVIO_TICKS_PER_STEP = 240; // 960 PPQ -> 240 ticks per 1/16th step

export function parseCcs(xmlText: string): ConvertedProject {
  let bpm = 120;
  const tempoMatch = xmlText.match(/Tempo="([0-9.]+)"/) || xmlText.match(/<Sound\b[^>]*Tempo="([0-9.]+)"/);
  if (tempoMatch) {
    const val = parseFloat(tempoMatch[1]);
    if (val >= 40 && val <= 240) bpm = Math.round(val);
  }

  const tracks: ConvertedTrack[] = [];
  const unitRegex = /<Unit\b([^>]*)>([\s\S]*?)<\/Unit>/g;
  let uMatch: RegExpExecArray | null;

  while ((uMatch = unitRegex.exec(xmlText)) !== null) {
    const uAttrs = uMatch[1];
    const uBody = uMatch[2];
    const groupNameMatch = uBody.match(/<Group\b[^>]*Name="([^"]+)"/) || uAttrs.match(/Name="([^"]+)"/);
    const trackName = groupNameMatch ? groupNameMatch[1].trim() : 'CeVIO Track';

    const noteRegex = /<Note\b([^>]*)\/?>/g;
    let nMatch: RegExpExecArray | null;
    const notes: ConvertedNote[] = [];

    while ((nMatch = noteRegex.exec(uBody)) !== null) {
      const attrs = nMatch[1];
      const clockMatch = attrs.match(/Clock="(\d+)"/);
      const durMatch = attrs.match(/Duration="(\d+)"/);
      const stepMatch = attrs.match(/PitchStep="(\d+)"/);
      const octMatch = attrs.match(/PitchOctave="(\d+)"/);
      const lyrMatch = attrs.match(/Lyric="([^"]*)"/);

      if (clockMatch && durMatch && stepMatch && octMatch) {
        const clock = parseInt(clockMatch[1], 10);
        const dur = parseInt(durMatch[1], 10);
        const step = Math.round(clock / CEVIO_TICKS_PER_STEP);
        const length = Math.max(1, Math.round(dur / CEVIO_TICKS_PER_STEP));
        const pitchStep = parseInt(stepMatch[1], 10);
        const pitchOct = parseInt(octMatch[1], 10);
        const pitch = clampPitch((pitchOct + 1) * 12 + pitchStep);
        const lyric = lyrMatch ? lyrMatch[1].trim() : 'a';

        notes.push({ s: step, l: length, p: pitch, t: lyric || 'a' });
      }
    }

    if (notes.length) {
      tracks.push({ name: trackName, k: 'Voice', notes });
    }
  }

  if (!tracks.length) {
    tracks.push({ name: 'CeVIO Track', k: 'Voice', notes: [{ s: 0, l: 4, p: 60, t: 'a' }] });
  }

  const maxStep = Math.max(...tracks.flatMap(t => t.notes.map(n => n.s + n.l)), 64);
  return {
    name: 'CeVIO Project',
    bpm,
    bars: Math.max(4, Math.ceil(maxStep / 16)),
    tracks,
  };
}

export function exportCcs(project: ConvertedProject): string {
  const tracks = project.tracks.length ? project.tracks : [{ name: 'Vocal', notes: [] }];

  let xml = `<?xml version="1.0" encoding="utf-8"?>
<Scenario xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Sequence Id="">
    <Scene>
      <Units>
`;

  tracks.forEach((tr, tIdx) => {
    const sorted = [...tr.notes].sort((a, b) => a.s - b.s);

    xml += `        <Unit Version="1.0" Id="${tIdx + 1}" Category="SingerSong">
          <Group Id="${tIdx + 1}" Category="SingerSong" Name="${escapeXml(tr.name || `Track ${tIdx + 1}`)}" />
          <Song Version="1.07">
            <Tempo>
              <Sound Clock="0" Tempo="${project.bpm || 120}" />
            </Tempo>
            <Beat>
              <Time Clock="0" Beats="4" BeatType="4" />
            </Beat>
            <Score>
`;

    sorted.forEach(n => {
      const clock = Math.round(n.s * CEVIO_TICKS_PER_STEP);
      const dur = Math.max(60, Math.round(n.l * CEVIO_TICKS_PER_STEP));
      const pitchStep = ((n.p % 12) + 12) % 12;
      const pitchOct = Math.floor(n.p / 12) - 1;

      xml += `              <Note Clock="${clock}" Duration="${dur}" PitchStep="${pitchStep}" PitchOctave="${pitchOct}" Lyric="${escapeXml(n.t || 'a')}" />
`;
    });

    xml += `            </Score>
          </Song>
        </Unit>
`;
  });

  xml += `      </Units>
    </Scene>
  </Sequence>
</Scenario>
`;
  return xml;
}

// ==========================================
// 4. Native Voicest Project Lossless Export & Import
// ==========================================

export function exportVoicestNative(project: ConvertedProject): string {
  const payload = {
    version: '2.0-V2X',
    nm: project.name || 'Voicest',
    bpm: project.bpm || 120,
    bars: project.bars || 4,
    sc: project.scale ?? 0,
    rt: project.root ?? 0,
    ch: project.tracks.map((tr, idx) => ({
      id: tr.id ?? idx + 1,
      name: tr.name || `Track ${idx + 1}`,
      k: tr.k || 'Voice',
      v: tr.v ?? 0.7,
      m: tr.m ? 1 : 0,
      s: tr.s ? 1 : 0,
      pan: typeof tr.pan === 'number' ? tr.pan : 0,
      vp: { append: tr.append || 'default' },
      n: tr.notes.map(n => ({
        s: n.s,
        l: n.l,
        p: n.p,
        t: n.t,
        ...(n.pc ? { pc: n.pc } : {}),
      })),
    })),
  };
  return JSON.stringify(payload, null, 2);
}

export function parseVoicestNative(jsonStr: string): ConvertedProject {
  const o = JSON.parse(jsonStr);
  if (!o || !Array.isArray(o.ch)) throw new Error('Invalid Voicest project format');

  return {
    name: o.nm || 'Voicest',
    bpm: typeof o.bpm === 'number' && o.bpm >= 40 && o.bpm <= 240 ? Math.round(o.bpm) : 120,
    bars: typeof o.bars === 'number' && o.bars >= 2 ? o.bars : 4,
    scale: o.sc ?? 0,
    root: o.rt ?? 0,
    tracks: o.ch.map((h: any, idx: number) => ({
      id: h.id ?? idx + 1,
      name: h.name || `Track ${idx + 1}`,
      k: h.k || 'Voice',
      v: typeof h.v === 'number' ? h.v : 0.7,
      m: h.m ? 1 : 0,
      s: h.s ? 1 : 0,
      pan: typeof h.pan === 'number' ? h.pan : 0,
      append: h.vp?.append || 'default',
      notes: (Array.isArray(h.n) ? h.n : []).map((q: any) => ({
        s: Math.max(0, Math.round(+q.s || 0)),
        l: Math.max(1, Math.round(+q.l || 1)),
        p: clampPitch(+q.p || 60),
        t: String(q.t || 'a'),
        ...(Array.isArray(q.pc) ? { pc: q.pc } : {}),
      })),
    })),
  };
}

// ==========================================
// 5. Breath Marker & Phrasing Helpers
// ==========================================

export function isBreathLyric(lyric: string): boolean {
  if (!lyric) return false;
  const clean = lyric.trim().toLowerCase();
  return /^(br|br_in|br_out|in|out|breath|hh|asp|息|吸|呼)(\b|_|[0-9]|$)/i.test(clean);
}

// ==========================================
// 6. UTAU UST (v1.2) Parser & Exporter
// ==========================================

export function exportUst(project: ConvertedProject, embedVoicest = false): string {
  const bpm = project.bpm || 120;
  const voiceTrack = project.tracks.find(t => t.k === 'Voice') || project.tracks[0] || { name: 'Vocal', notes: [] };
  const sorted = [...voiceTrack.notes].sort((a, b) => a.s - b.s);

  let out = `[#VERSION]\r\nUST Version1.2\r\n[#SETTING]\r\nTempo=${bpm}\r\nTracks=1\r\nProjectName=${project.name || 'Voicest'}\r\nMode2=True\r\n`;

  if (embedVoicest) {
    const rawNative = exportVoicestNative(project);
    const b64 = Buffer.from(rawNative, 'utf-8').toString('base64');
    out += `VoicestProject=${b64}\r\n`;
  }

  let curStep = 0;
  let noteIndex = 0;
  const pad = (idx: number) => `[#${String(idx).padStart(4, '0')}]\r\n`;

  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i];
    if (n.s > curStep) {
      const restLen = (n.s - curStep) * 120; // 1 step = 120 ticks
      out += `${pad(noteIndex++)}Length=${restLen}\r\nLyric=R\r\nNoteNum=60\r\n`;
      curStep = n.s;
    }

    const dur = n.l * 120;
    out += `${pad(noteIndex++)}Length=${dur}\r\nLyric=${n.t || 'a'}\r\nNoteNum=${n.p}\r\n`;

    if (n.pc && n.pc.length > 1) {
      const stepMs = 15000 / bpm;
      const pbsX = (n.pc[0][0] - n.s) * stepMs;
      const pbsY = (n.pc[0][1] - n.p) * 10;
      const pbw: number[] = [];
      const pby: number[] = [];

      for (let j = 1; j < n.pc.length; j++) {
        const deltaMs = (n.pc[j][0] - n.pc[j - 1][0]) * stepMs;
        const curY = (n.pc[j][1] - n.p) * 10;
        pbw.push(Math.round(deltaMs * 10) / 10);
        pby.push(Math.round(curY * 10) / 10);
      }

      out += `PBType=5\r\nPBS=${pbsX.toFixed(1)};${pbsY.toFixed(1)}\r\n`;
      out += `PBW=${pbw.join(',')}\r\n`;
      out += `PBY=${pby.join(',')}\r\n`;
    }

    curStep = n.s + n.l;
  }

  out += '[#TRACKEND]\r\n';
  return out;
}

export function parseUst(ustText: string): ConvertedProject {
  // Check for embedded lossless Voicest native payload
  const matchEmbedded = ustText.match(/VoicestProject=([A-Za-z0-9+/=]+)/);
  if (matchEmbedded) {
    try {
      const decoded = Buffer.from(matchEmbedded[1], 'base64').toString('utf-8');
      return parseVoicestNative(decoded);
    } catch (e) {}
  }

  let bpm = 120;
  const bpmMatch = ustText.match(/Tempo=([0-9.]+)/i);
  if (bpmMatch) {
    const val = parseFloat(bpmMatch[1]);
    if (val >= 40 && val <= 240) bpm = Math.round(val);
  }

  let projectName = 'UTAU Project';
  const nameMatch = ustText.match(/ProjectName=([^\r\n]+)/i);
  if (nameMatch) projectName = nameMatch[1].trim();

  const notes: ConvertedNote[] = [];
  const blocks = ustText.split(/\[#\d{4}\]/);
  let curStep = 0;

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const lenMatch = block.match(/Length=(\d+)/i);
    const lyrMatch = block.match(/Lyric=([^\r\n]+)/i);
    const numMatch = block.match(/NoteNum=(\d+)/i);

    if (lenMatch && lyrMatch && numMatch) {
      const lengthTicks = parseInt(lenMatch[1], 10);
      const stepDuration = Math.max(1, Math.round(lengthTicks / 120));
      const lyric = lyrMatch[1].trim();
      const pitch = clampPitch(parseInt(numMatch[1], 10));

      if (lyric.toUpperCase() === 'R') {
        curStep += stepDuration;
        continue;
      }

      const noteObj: ConvertedNote = {
        s: curStep,
        l: stepDuration,
        p: pitch,
        t: lyric || 'a',
      };

      // Extract Mode2 pitch bend if present
      const pbsMatch = block.match(/PBS=([^\r\n]+)/i);
      const pbwMatch = block.match(/PBW=([^\r\n]+)/i);
      const pbyMatch = block.match(/PBY=([^\r\n]+)/i);

      if (pbsMatch && pbwMatch && pbyMatch) {
        try {
          const [startXStr, startYStr] = pbsMatch[1].split(';');
          const startX = parseFloat(startXStr) || 0;
          const startY = parseFloat(startYStr) || 0;
          const stepMs = 15000 / bpm;
          const widths = pbwMatch[1].split(',').map(s => parseFloat(s) || 0);
          const yVals = pbyMatch[1].split(',').map(s => parseFloat(s) || 0);

          const curve: Array<[number, number]> = [];
          let timeMs = startX;
          curve.push([curStep + timeMs / stepMs, pitch + startY / 10]);

          for (let k = 0; k < Math.min(widths.length, yVals.length); k++) {
            timeMs += widths[k];
            curve.push([curStep + timeMs / stepMs, pitch + yVals[k] / 10]);
          }

          if (curve.length > 1) {
            noteObj.pc = curve;
          }
        } catch (e) {}
      }

      notes.push(noteObj);
      curStep += stepDuration;
    }
  }

  const maxStep = notes.length ? Math.max(...notes.map(n => n.s + n.l)) : 16;
  return {
    name: projectName,
    bpm,
    bars: Math.max(4, Math.ceil(maxStep / 16)),
    tracks: [{ name: 'Vocal', k: 'Voice', notes }],
  };
}

// ==========================================
// 7. OpenUtau USTX Parser & Exporter
// ==========================================

export function exportUstx(project: ConvertedProject): string {
  const bpm = project.bpm || 120;
  const tracks = project.tracks.filter(t => t.k === 'Voice').length
    ? project.tracks.filter(t => t.k === 'Voice')
    : project.tracks.length
    ? project.tracks
    : [{ name: 'Vocal', notes: [] }];

  let y = `name: ${JSON.stringify(project.name || 'Voicest Project')}\n`;
  y += `comment: "Created in Voicest V2X"\n`;
  y += `output_dir: Vocal\ncache_dir: UCache\nustx_version: 0.6\n`;
  y += `bpm: ${bpm}\nbeat_per_bar: 4\nbeat_unit: 4\nresolution: 480\n`;
  y += `time_signatures:\n  - bar_position: 0\n    beat_per_bar: 4\n    beat_unit: 4\n`;
  y += `tempos:\n  - position: 0\n    bpm: ${bpm}\n`;
  y += `tracks:\n`;

  tracks.forEach(tr => {
    y += `  - singer: ""\n    track_name: ${JSON.stringify(tr.name || 'Track')}\n`;
  });

  y += `voice_parts:\n`;

  tracks.forEach((tr, i) => {
    const sorted = [...tr.notes].sort((a, b) => a.s - b.s);
    y += `  - name: ${JSON.stringify(tr.name || `Track ${i + 1}`)}\n`;
    y += `    track_no: ${i}\n    position: 0\n    notes:\n`;

    if (!sorted.length) {
      y += `      []\n`;
      return;
    }

    sorted.forEach(n => {
      const tickPos = Math.round(n.s * 120);
      const tickDur = Math.max(120, Math.round(n.l * 120));
      y += `      - position: ${tickPos}\n`;
      y += `        duration: ${tickDur}\n`;
      y += `        tone: ${n.p}\n`;
      y += `        lyric: ${JSON.stringify(n.t || 'a')}\n`;

      if (n.pc && n.pc.length > 1) {
        y += `        pitch:\n          data:\n`;
        n.pc.forEach(q => {
          const relTick = (q[0] - n.s) * 120;
          const relPitch = (q[1] - n.p) * 10;
          y += `            - x: ${relTick.toFixed(1)}\n`;
          y += `              y: ${relPitch.toFixed(1)}\n`;
          y += `              shape: l\n`;
        });
        y += `          snap_first: false\n`;
      }
    });
  });

  return y;
}

export function parseUstx(ustxText: string): ConvertedProject {
  let bpm = 120;
  const bpmMatch = ustxText.match(/\bbpm:\s*([0-9.]+)/i);
  if (bpmMatch) {
    const val = parseFloat(bpmMatch[1]);
    if (val >= 40 && val <= 240) bpm = Math.round(val);
  }

  let projectName = 'OpenUtau Project';
  const nameMatch = ustxText.match(/\bname:\s*["']?([^"'\r\n]+)/i);
  if (nameMatch) projectName = nameMatch[1].trim();

  // Extract track names
  const trackNames: string[] = [];
  const trNameRe = /track_name:\s*["']?([^"'\r\n]+)/g;
  let trMatch: RegExpExecArray | null;
  while ((trMatch = trNameRe.exec(ustxText)) !== null) {
    trackNames.push(trMatch[1].trim());
  }

  // Extract voice parts and notes
  const tracks: ConvertedTrack[] = [];
  const partBlocks = ustxText.split(/-\s+name:\s*/);

  for (let pIdx = 1; pIdx < partBlocks.length; pIdx++) {
    const pBlock = partBlocks[pIdx];
    const trNoMatch = pBlock.match(/track_no:\s*(\d+)/);
    const trNo = trNoMatch ? parseInt(trNoMatch[1], 10) : pIdx - 1;
    const trackName = trackNames[trNo] || `Part ${pIdx}`;

    const noteBlocks = pBlock.split(/-\s+position:\s*/);
    const notes: ConvertedNote[] = [];

    for (let nIdx = 1; nIdx < noteBlocks.length; nIdx++) {
      const nBlock = noteBlocks[nIdx];
      const posMatch = nBlock.match(/^(\d+)/);
      const durMatch = nBlock.match(/duration:\s*(\d+)/);
      const toneMatch = nBlock.match(/tone:\s*(\d+)/);
      const lyrMatch = nBlock.match(/lyric:\s*["']?([^"'\r\n]+)/);

      if (posMatch && durMatch && toneMatch) {
        const tickPos = parseInt(posMatch[1], 10);
        const tickDur = parseInt(durMatch[1], 10);
        const toneVal = parseInt(toneMatch[1], 10);
        const lyric = lyrMatch ? lyrMatch[1].trim() : 'a';

        const stepPos = Math.round(tickPos / 120);
        const stepLen = Math.max(1, Math.round(tickDur / 120));
        const pitch = clampPitch(toneVal);
        if (lyric.toUpperCase() === 'R') continue;

        const noteObj: ConvertedNote = {
          s: stepPos,
          l: stepLen,
          p: pitch,
          t: lyric || 'a',
        };

        const pitchSection = nBlock.match(/pitch:\s*\n\s*data:\s*\n([\s\S]*?)(?:\n\s*snap_first:|\s*$)/);
        if (pitchSection) {
          const curve: Array<[number, number]> = [];
          const ptRe = /-\s+x:\s*([+-]?\d+(?:\.\d+)?)\s*\n\s*y:\s*([+-]?\d+(?:\.\d+)?)/g;
          let ptMatch: RegExpExecArray | null;
          while ((ptMatch = ptRe.exec(pitchSection[1])) !== null) {
            const relTick = parseFloat(ptMatch[1]);
            const relTenCents = parseFloat(ptMatch[2]);
            curve.push([
              Math.round((stepPos + relTick / 120) * 1000) / 1000,
              Math.round((pitch + relTenCents / 10) * 1000) / 1000,
            ]);
          }
          if (curve.length > 1) noteObj.pc = curve;
        }

        notes.push(noteObj);
      }
    }

    if (notes.length) {
      tracks.push({ name: trackName, k: 'Voice', notes });
    }
  }

  if (!tracks.length) {
    tracks.push({ name: 'Vocal', k: 'Voice', notes: [{ s: 0, l: 4, p: 60, t: 'a' }] });
  }

  const maxStep = Math.max(...tracks.flatMap(t => t.notes.map(n => n.s + n.l)), 64);
  return {
    name: projectName,
    bpm,
    bars: Math.max(4, Math.ceil(maxStep / 16)),
    tracks,
  };
}

// ==========================================
// 8. Synthesizer V SVP Parser & Exporter
// ==========================================

const BLICK_PER_STEP = 367500; // 1 quarter note = 1470000 blicks, 1 step (1/16) = 367500 blicks

export function exportSvp(project: ConvertedProject): string {
  const bpm = project.bpm || 120;
  const tracks = project.tracks.length ? project.tracks : [{ name: 'Vocal', notes: [] }];

  const svpTracks = tracks.map((tr, idx) => {
    const sorted = [...tr.notes].sort((a, b) => a.s - b.s);
    const uuid = `track-uuid-${idx + 1}-${Math.random().toString(36).slice(2, 9)}`;

    const points: number[] = [];
    sorted.forEach(n => {
      if (n.pc && n.pc.length > 1) {
        n.pc.forEach(q => {
          points.push(Math.round(q[0] * BLICK_PER_STEP), Math.round((q[1] - n.p) * 100));
        });
        points.push(Math.round((n.s + n.l) * BLICK_PER_STEP) + 1, 0);
      }
    });

    return {
      name: tr.name || `Track ${idx + 1}`,
      dispOrder: idx,
      renderEnabled: false,
      mixer: {
        gainDecibel: 0,
        pan: tr.pan ?? 0,
        mute: !!tr.m,
        solo: !!tr.s,
        display: true,
      },
      mainGroup: {
        name: 'main',
        uuid,
        notes: sorted.map(n => ({
          onset: n.s * BLICK_PER_STEP,
          duration: n.l * BLICK_PER_STEP,
          lyrics: n.t || 'a',
          phonemes: '',
          pitch: n.p,
          detune: 0,
          attributes: {},
        })),
        parameters: points.length ? { pitchDelta: { mode: 'cosine', points } } : {},
      },
      mainRef: {
        groupID: uuid,
        blickOffset: 0,
        pitchOffset: 0,
        isInstrumental: tr.k !== 'Voice',
        database: { name: '', language: 'japanese', phoneset: '' },
        dictionary: '',
        voice: {},
      },
    };
  });

  const payload = {
    version: 100,
    time: {
      meter: [{ index: 0, numerator: 4, denominator: 4 }],
      tempo: [{ position: 0, bpm }],
    },
    tracks: svpTracks,
  };

  return JSON.stringify(payload, null, 2);
}

export function parseSvp(svpText: string): ConvertedProject {
  const clean = svpText.replace(/^\uFEFF/, '').replace(/\0+$/g, '').trim();
  const j = JSON.parse(clean);
  if (!j || !Array.isArray(j.tracks)) throw new Error('Invalid SVP project');

  const bpm = j.time?.tempo?.[0]?.bpm ? Math.round(j.time.tempo[0].bpm) : 120;
  const tracks: ConvertedTrack[] = [];

  for (let i = 0; i < j.tracks.length; i++) {
    const tr = j.tracks[i];
    const trName = tr.name || `Track ${i + 1}`;
    const rawNotes = tr.mainGroup?.notes || [];
    const notes: ConvertedNote[] = [];

    const pdPoints: number[] = tr.mainGroup?.parameters?.pitchDelta?.points || [];

    for (const n of rawNotes) {
      const onset = n.onset || 0;
      const duration = n.duration || BLICK_PER_STEP;
      const s = Math.round(onset / BLICK_PER_STEP);
      const l = Math.max(1, Math.round(duration / BLICK_PER_STEP));
      const p = clampPitch(n.pitch || 60);
      const t = n.lyrics ? String(n.lyrics).trim() : 'a';

      const noteObj: ConvertedNote = { s, l, p, t: t || 'a' };
      if (pdPoints.length >= 4) {
        const endBlick = onset + duration;
        const curve: Array<[number, number]> = [];
        for (let idx = 0; idx + 1 < pdPoints.length; idx += 2) {
          const bPos = pdPoints[idx];
          const cents = pdPoints[idx + 1];
          if (bPos >= onset - BLICK_PER_STEP && bPos <= endBlick + 1) {
            curve.push([
              Math.round((bPos / BLICK_PER_STEP) * 1000) / 1000,
              Math.round((p + cents / 100) * 1000) / 1000,
            ]);
          }
        }
        if (curve.length > 1) noteObj.pc = curve;
      }
      notes.push(noteObj);
    }

    if (notes.length) {
      const isInst = !!tr.mainRef?.isInstrumental;
      const kind = isInst ? detectInstrumentFromTrackName(trName) : 'Voice';
      tracks.push({
        name: trName,
        k: kind,
        pan: tr.mixer?.pan ?? 0,
        m: tr.mixer?.mute ? 1 : 0,
        s: tr.mixer?.solo ? 1 : 0,
        notes,
      });
    }
  }

  if (!tracks.length) {
    tracks.push({ name: 'Vocal', k: 'Voice', notes: [{ s: 0, l: 4, p: 60, t: 'a' }] });
  }

  const maxStep = Math.max(...tracks.flatMap(t => t.notes.map(n => n.s + n.l)), 64);
  return {
    name: 'Synthesizer V Project',
    bpm,
    bars: Math.max(4, Math.ceil(maxStep / 16)),
    tracks,
  };
}

// ==========================================
// 9. VOCALOID 5/6 VPR Sequence Parser & Exporter
// ==========================================

export function exportVpr(project: ConvertedProject): string {
  const bpmCenti = Math.round((project.bpm || 120) * 100);
  const tracks = project.tracks.length ? project.tracks : [{ name: 'Vocal', notes: [] }];
  const totalTicks = Math.max(76800, project.bars * 16 * 120);

  const vprTracks = tracks.map((tr, idx) => {
    const sorted = [...tr.notes].sort((a, b) => a.s - b.s);
    const pbEvents: Array<{ pos: number; value: number }> = [];

    sorted.forEach(n => {
      if (n.pc && n.pc.length > 1) {
        n.pc.forEach(q => {
          const val = Math.max(-8192, Math.min(8191, Math.round(((q[1] - n.p) / 24) * 8192)));
          pbEvents.push({ pos: Math.round(q[0] * 120), value: val });
        });
        pbEvents.push({ pos: Math.round((n.s + n.l) * 120), value: 0 });
      }
    });

    const controllers = pbEvents.length
      ? [
          { name: 'pitchBend', events: pbEvents },
          { name: 'pitchBendSens', events: [{ pos: 0, value: 24 }] },
        ]
      : [];

    return {
      type: 0,
      name: tr.name || `Track ${idx + 1}`,
      color: idx % 8,
      busNo: idx,
      isFolded: false,
      height: 0.0,
      volume: { isFolded: true, height: 0.0, events: [{ pos: 0, value: 0 }] },
      panpot: { isFolded: true, height: 0.0, events: [{ pos: 0, value: Math.max(-64, Math.min(64, Math.round((tr.pan ?? 0) * 64))) }] },
      isMuted: !!tr.m,
      isSoloMode: !!tr.s,
      parts: [
        {
          pos: 0,
          duration: totalTicks,
          styleName: '',
          voice: { compID: '', langID: 0 },
          midiEffects: [],
          notes: sorted.map(n => ({
            lyric: n.t || 'a',
            phoneme: n.t || 'a',
            isProtected: false,
            pos: n.s * 120,
            duration: n.l * 120,
            number: n.p,
            velocity: 64,
            exp: { opening: 127 },
            singingSkill: { duration: 64, weight: { pre: 64, post: 64 } },
            vibrato: { type: 0, duration: 0 },
          })),
          controllers,
        },
      ],
    };
  });

  const payload = {
    version: { major: 5, minor: 0, revision: 0 },
    vender: 'Yamaha corporation',
    title: project.name || 'Voicest',
    masterTrack: {
      samplingRate: 44100,
      loop: { begin: 0, end: totalTicks, isEnabled: false },
      tempo: { global: { isEnabled: false, value: bpmCenti }, events: [{ pos: 0, value: bpmCenti }] },
      timeSig: { events: [{ bar: 0, numer: 4, denom: 4 }] },
      volume: { events: [{ pos: 0, value: 0 }] },
    },
    voices: [],
    tracks: vprTracks,
  };

  return JSON.stringify(payload, null, 2);
}

export function parseVpr(vprText: string): ConvertedProject {
  const j = JSON.parse(vprText);
  if (!j || !Array.isArray(j.tracks)) throw new Error('Invalid VPR project');

  const tempoVal = j.masterTrack?.tempo?.events?.[0]?.value || 12000;
  const bpm = Math.max(40, Math.min(240, Math.round(tempoVal / 100)));
  const tracks: ConvertedTrack[] = [];

  for (let i = 0; i < j.tracks.length; i++) {
    const tr = j.tracks[i];
    if (tr.type != null && tr.type !== 0) continue;
    const trName = tr.name || `Track ${i + 1}`;
    const notes: ConvertedNote[] = [];

    const pitEvents: Array<[number, number]> = [];
    const pbsEvents: Array<[number, number]> = [];

    for (const part of tr.parts || []) {
      const partPos = part.pos || 0;
      for (const ctl of part.controllers || []) {
        for (const ev of ctl.events || []) {
          const tick = partPos + (ev.pos || 0);
          if (ctl.name === 'pitchBend') pitEvents.push([tick, ev.value || 0]);
          else if (ctl.name === 'pitchBendSens') pbsEvents.push([tick, ev.value || 2]);
        }
      }
      for (const n of part.notes || []) {
        const tickPos = partPos + (n.pos || 0);
        const tickDur = n.duration || 480;
        const s = Math.round(tickPos / 120);
        const l = Math.max(1, Math.round(tickDur / 120));
        const p = clampPitch(n.number || 60);
        const t = n.lyric ? String(n.lyric).trim() : 'a';

        notes.push({ s, l, p, t: t || 'a' });
      }
    }

    pitEvents.sort((a, b) => a[0] - b[0]);
    pbsEvents.sort((a, b) => a[0] - b[0]);
    if (pitEvents.length) {
      for (const n of notes) {
        const pc = buildPitchCurveFromEvents(pitEvents, pbsEvents, n.s, n.l, n.p, 120);
        if (pc) n.pc = pc;
      }
    }

    if (notes.length) {
      const panEv = tr.panpot?.events?.[0]?.value;
      const pan = typeof panEv === 'number' && isFinite(panEv) ? Math.max(-1, Math.min(1, Math.round((panEv / 64) * 100) / 100)) : 0;
      tracks.push({
        name: trName,
        k: 'Voice',
        pan,
        m: tr.isMuted ? 1 : 0,
        s: tr.isSoloMode ? 1 : 0,
        notes,
      });
    }
  }

  if (!tracks.length) {
    tracks.push({ name: 'Vocal', k: 'Voice', notes: [{ s: 0, l: 4, p: 60, t: 'a' }] });
  }

  const maxStep = Math.max(...tracks.flatMap(t => t.notes.map(n => n.s + n.l)), 64);
  return {
    name: j.title || 'Vocaloid Project',
    bpm,
    bars: Math.max(4, Math.ceil(maxStep / 16)),
    tracks,
  };
}

// Helpers
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeCdata(str: string): string {
  return str.replace(/\]\]>/g, ']]&gt;');
}

