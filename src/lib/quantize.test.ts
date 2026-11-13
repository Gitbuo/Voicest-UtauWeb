import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gridToStep,
  snapToGrid,
  quantizeNotes,
  alignLegatoNotes,
  type VoicestNote
} from './quantize.ts';

test('gridToStep converts musical subdivisions to step units', () => {
  assert.equal(gridToStep('1/4'), 4);
  assert.equal(gridToStep('1/8'), 2);
  assert.equal(gridToStep('1/16'), 1);
  assert.equal(gridToStep('1/32'), 0.5);
  assert.equal(gridToStep('1/64'), 0.25);
  assert.ok(Math.abs(gridToStep('1/8T') - 1.33333) < 0.001);
  assert.ok(Math.abs(gridToStep('1/16T') - 0.66667) < 0.001);
  assert.equal(gridToStep(2), 2);
});

test('snapToGrid correctly snaps floating values to step grid without IEEE precision errors', () => {
  // Snapping to 1/16 (1.0 step)
  assert.equal(snapToGrid(0.08, 1.0), 0);
  assert.equal(snapToGrid(0.92, 1.0), 1.0);
  assert.equal(snapToGrid(1.49, 1.0), 1.0);
  assert.equal(snapToGrid(1.51, 1.0), 2.0);

  // Snapping to 1/32 (0.5 step)
  assert.equal(snapToGrid(0.24, 0.5), 0);
  assert.equal(snapToGrid(0.28, 0.5), 0.5);
  assert.equal(snapToGrid(0.76, 0.5), 1.0);

  // Snapping to 1/8 (2.0 steps)
  assert.equal(snapToGrid(1.85, 2.0), 2.0);
  assert.equal(snapToGrid(3.1, 2.0), 4.0);
});

test('quantizeNotes snaps note start and length to 1/16 grid', () => {
  const input: VoicestNote[] = [
    { s: 0.12, l: 1.88, p: 60, t: 'ka' },
    { s: 2.08, l: 0.95, p: 62, t: 'shi' },
    { s: 3.9, l: 3.8, p: 64, t: 'ne' }
  ];

  const result = quantizeNotes(input, { grid: '1/16' });

  assert.equal(result.length, 3);
  // Note 0: s=0.12 -> 0, l=1.88 -> 2
  assert.equal(result[0].s, 0);
  assert.equal(result[0].l, 2);

  // Note 1: s=2.08 -> 2
  assert.equal(result[1].s, 2);
  // Note 2: s=3.9 -> 4, l=3.8 -> 4
  assert.equal(result[2].s, 4);
  assert.equal(result[2].l, 4);

  // Auto-legato check: note 1 at s=2 should extend to meet note 2 at s=4
  assert.equal(result[1].s + result[1].l, result[2].s);
});

test('quantizeNotes eliminates micro-gaps between fast notes for seamless legato', () => {
  // A fast 16th note passage where human or MIDI rounding left small gaps (e.g., 0.1 step)
  const notes: VoicestNote[] = [
    { s: 0, l: 0.9, p: 60, t: 'do' },
    { s: 1, l: 0.85, p: 62, t: 're' },
    { s: 2, l: 0.92, p: 64, t: 'mi' },
    { s: 3, l: 1.0, p: 65, t: 'fa' }
  ];

  const quantized = quantizeNotes(notes, {
    grid: '1/16',
    autoLegato: true,
    legatoThreshold: 1.0
  });

  // Verify all notes are now contiguous (each note ends exactly where the next begins)
  for (let i = 0; i < quantized.length - 1; i++) {
    const end = quantized[i].s + quantized[i].l;
    assert.equal(
      end,
      quantized[i + 1].s,
      `Note ${i} end (${end}) must match Note ${i+1} start (${quantized[i+1].s}) for legato`
    );
  }
});

test('quantizeNotes prevents overlapping notes and truncates duration', () => {
  // Overlapping notes: note 0 ends at 2.5, but note 1 starts at 2.0
  const notes: VoicestNote[] = [
    { s: 0, l: 2.5, p: 60, t: 'a' },
    { s: 2.0, l: 2.0, p: 64, t: 'i' }
  ];

  const result = quantizeNotes(notes, {
    grid: '1/8',
    preventOverlap: true
  });

  assert.equal(result[0].s, 0);
  assert.equal(result[0].l, 2); // Truncated to 2 so it doesn't overlap Note 1
  assert.equal(result[1].s, 2);
  assert.equal(result[1].l, 2);
});

test('quantizeNotes shifts pitch curve points proportionally with start position', () => {
  const notes: VoicestNote[] = [
    {
      s: 0.2,
      l: 1.0,
      p: 60,
      t: 'a',
      pc: [[0.2, 60], [0.7, 62], [1.2, 60]]
    }
  ];

  const result = quantizeNotes(notes, { grid: '1/16' });

  // Note was shifted by delta = 0 - 0.2 = -0.2
  assert.equal(result[0].s, 0);
  assert.ok(result[0].pc);
  assert.equal(result[0].pc![0][0], 0);
  assert.equal(result[0].pc![1][0], 0.5);
  assert.equal(result[0].pc![2][0], 1.0);
});

test('alignLegatoNotes closes gaps without altering note starts when not on grid', () => {
  const notes: VoicestNote[] = [
    { s: 0.5, l: 0.8, p: 60, t: 'a' }, // ends at 1.3
    { s: 1.5, l: 1.0, p: 62, t: 'ka' } // starts at 1.5 (gap = 0.2)
  ];

  const aligned = alignLegatoNotes(notes, 0.5);

  assert.equal(aligned[0].s, 0.5);
  // Aligned to close the 0.2 gap
  assert.equal(aligned[0].l, 1.0); // 0.5 + 1.0 = 1.5
  assert.equal(aligned[0].s + aligned[0].l, aligned[1].s);
});
