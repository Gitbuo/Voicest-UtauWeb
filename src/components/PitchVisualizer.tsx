/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  generatePitchContour,
  pitchToNoteName,
  VocalNote,
} from '../lib/pitch-contour';
import { Language } from '../lib/i18n';

export interface PitchVisualizerProps {
  notes: VocalNote[];
  bpm?: number;
  trackName?: string;
  currentTime?: number;
  isPlaying?: boolean;
  lang?: Language;
  expanded: boolean;
  onToggle: () => void;
  onSeek?: (timeSec: number) => void;
  metronomeOn?: boolean;
  onToggleMetronome?: () => void;
}

const COLOR = {
  bg: '#eaf3f8',
  panel: '#dce8f0',
  line: '#b4cad8',
  ink: '#243442',
  pink: '#4a90b8',
  mint: '#6ba8c9',
  mintDeep: '#3b789c',
};

const TEXT: Record<Language, { title: string; notes: string; legato: string; open: string; close: string; metroOn: string; metroOff: string; exhale: string; inhale: string }> = {
  vi: { title: 'Đường cong F0', notes: 'nốt', legato: 'legato', open: 'Mở', close: 'Đóng', metroOn: 'Máy nhịp: BẬT', metroOff: 'Máy nhịp: TẮT', exhale: 'Thở ra', inhale: 'Thở vào' },
  en: { title: 'F0 contour', notes: 'notes', legato: 'legato', open: 'Open', close: 'Close', metroOn: 'Metronome: ON', metroOff: 'Metronome: OFF', exhale: 'Exhale', inhale: 'Inhale' },
  ja: { title: 'F0カーブ', notes: 'ノート', legato: 'レガート', open: '開く', close: '閉じる', metroOn: 'メトロノーム: ON', metroOff: 'メトロノーム: OFF', exhale: '息出し', inhale: '息吸い' },
  zh: { title: 'F0 曲线', notes: '音符', legato: '连音', open: '展开', close: '收起', metroOn: '节拍器: 开启', metroOff: '节拍器: 关闭', exhale: '呼气', inhale: '吸气' },
  ko: { title: 'F0 곡선', notes: '음표', legato: '레가토', open: '열기', close: '닫기', metroOn: '메트로놈: 켜짐', metroOff: '메트로놈: 꺼짐', exhale: '숨 내쉬기', inhale: '숨 들이쉬기' },
};

const CHART_HEIGHT = 170;

export default function PitchVisualizer({
  notes,
  bpm = 120,
  trackName = 'Vocal',
  currentTime = 0,
  lang = 'en',
  expanded,
  onToggle,
  onSeek,
  metronomeOn = false,
  onToggleMetronome,
}: PitchVisualizerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const tx = TEXT[lang] ?? TEXT.en;

  const { points, transitions, timeDomain, pitchDomain } = useMemo(
    () => generatePitchContour(notes, bpm, 5),
    [notes, bpm],
  );

  useEffect(() => {
    if (!expanded || !svgRef.current || !wrapRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 12, right: 20, bottom: 22, left: 44 };
    const width = wrapRef.current.clientWidth || 800;
    const innerW = Math.max(100, (width - margin.left - margin.right) * zoom);
    const innerH = CHART_HEIGHT - margin.top - margin.bottom;
    svg.attr('width', innerW + margin.left + margin.right).attr('height', CHART_HEIGHT);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const x = d3.scaleLinear().domain(timeDomain).range([0, innerW]);
    const y = d3
      .scaleLinear()
      .domain([pitchDomain[0] - 2, pitchDomain[1] + 2])
      .range([innerH, 0]);

    // horizontal grid per semitone
    for (let p = Math.ceil(pitchDomain[0] - 2); p <= pitchDomain[1] + 2; p++) {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', y(p))
        .attr('y2', y(p))
        .attr('stroke', p % 12 === 0 ? COLOR.line : '#cfeee2')
        .attr('stroke-width', p % 12 === 0 ? 1 : 0.5);
    }

    // axes
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(Math.max(4, Math.floor(innerW / 90))).tickFormat((v) => `${v}s`))
      .call((a) => a.selectAll('text').attr('fill', COLOR.ink).attr('font-size', 10))
      .call((a) => a.selectAll('path,line').attr('stroke', COLOR.line));
    g.append('g')
      .call(
        d3
          .axisLeft(y)
          .tickValues(d3.range(Math.ceil(pitchDomain[0]), Math.floor(pitchDomain[1]) + 1).filter((p) => p % 12 === 0 || p % 12 === 7))
          .tickFormat((v) => pitchToNoteName(+v)),
      )
      .call((a) => a.selectAll('text').attr('fill', COLOR.ink).attr('font-size', 10))
      .call((a) => a.selectAll('path,line').attr('stroke', COLOR.line));

    // legato transition regions
    transitions.forEach((tr) => {
      g.append('rect')
        .attr('x', x(tr.fromTime))
        .attr('y', 0)
        .attr('width', Math.max(2, x(tr.toTime) - x(tr.fromTime)))
        .attr('height', innerH)
        .attr('fill', COLOR.pink)
        .attr('opacity', 0.22);
    });

    // F0 curve
    const line = d3
      .line<(typeof points)[number]>()
      .defined((p) => p.hz > 0)
      .x((p) => x(p.time))
      .y((p) => y(p.pitch))
      .curve(d3.curveMonotoneX);
    g.append('path')
      .datum(points)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', COLOR.mintDeep)
      .attr('stroke-width', 2.4);

    // note lyrics & high-visibility breath badges
    const stepSec = 60 / bpm / 4;
    const txtMap = TEXT[lang] || TEXT.en;
    [...notes].forEach((n) => {
      const isExhale = /^(br_out|out)$/i.test(n.t || '');
      const isInhale = /^(br|br_in|breath|in)$/i.test(n.t || '');
      const nx = x(n.s * stepSec);
      const nw = Math.max(14, x((n.s + n.l) * stepSec) - nx);
      const ny = y(n.p);

      if (isExhale) {
        g.append('rect')
          .attr('x', nx)
          .attr('y', ny - 15)
          .attr('width', Math.max(nw, 44))
          .attr('height', 13)
          .attr('fill', '#06b6d4')
          .attr('stroke', '#0891b2')
          .attr('stroke-width', 1)
          .attr('rx', 0);

        g.append('text')
          .attr('x', nx + 4)
          .attr('y', ny - 5)
          .attr('font-size', 9)
          .attr('font-weight', '700')
          .attr('fill', '#ffffff')
          .text(txtMap.exhale);
      } else if (isInhale) {
        g.append('rect')
          .attr('x', nx)
          .attr('y', ny - 15)
          .attr('width', Math.max(nw, 44))
          .attr('height', 13)
          .attr('fill', '#f43f5e')
          .attr('stroke', '#e11d48')
          .attr('stroke-width', 1)
          .attr('rx', 0);

        g.append('text')
          .attr('x', nx + 4)
          .attr('y', ny - 5)
          .attr('font-size', 9)
          .attr('font-weight', '700')
          .attr('fill', '#ffffff')
          .text(txtMap.inhale);
      } else {
        g.append('text')
          .attr('x', nx + 3)
          .attr('y', ny - 6)
          .attr('font-size', 10)
          .attr('fill', COLOR.ink)
          .text(n.t || 'a');
      }
    });

    // playhead + click to seek
    g.append('line')
      .attr('x1', x(currentTime))
      .attr('x2', x(currentTime))
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', COLOR.pink)
      .attr('stroke-width', 2);

    svg.on('click', (event: MouseEvent) => {
      const [px] = d3.pointer(event, g.node());
      onSeek?.(Math.max(0, x.invert(px)));
    });
  }, [expanded, zoom, points, transitions, timeDomain, pitchDomain, notes, bpm, currentTime, onSeek]);

  const durationSec = Math.max(0, timeDomain[1]);

  const btn: React.CSSProperties = {
    background: COLOR.bg,
    color: COLOR.ink,
    border: `1px solid ${COLOR.line}`,
    borderRadius: 0,
    padding: '1px 8px',
    cursor: 'pointer',
    font: 'inherit',
  };

  return (
    <div style={{ background: COLOR.panel, borderTop: `1px solid ${COLOR.line}`, color: COLOR.ink }}>
      {expanded && (
        <div ref={wrapRef} style={{ overflowX: 'auto', overflowY: 'hidden', height: CHART_HEIGHT, background: COLOR.bg }}>
          <svg ref={svgRef} style={{ display: 'block', cursor: 'crosshair' }} />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 28, padding: '0 10px', fontSize: 12 }}>
        <b style={{ color: COLOR.pink }}>{tx.title}</b>
        <span style={{ opacity: 0.8 }}>{trackName}</span>
        <span style={{ opacity: 0.8 }}>
          {notes.length} {tx.notes} · {durationSec.toFixed(1)}s · {transitions.length} {tx.legato}
        </span>
        <span style={{ flex: 1 }} />
        {expanded && (
          <>
            <button style={btn} onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))} aria-label="zoom out">
              −
            </button>
            <span style={{ minWidth: 38, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
            <button style={btn} onClick={() => setZoom((z) => Math.min(8, +(z + 0.5).toFixed(1)))} aria-label="zoom in">
              +
            </button>
          </>
        )}
        <button
          type="button"
          style={{
            ...btn,
            background: metronomeOn ? COLOR.pink : COLOR.bg,
            color: metronomeOn ? '#ffffff' : COLOR.ink,
            borderColor: metronomeOn ? COLOR.pink : COLOR.line,
            fontWeight: metronomeOn ? 600 : 400,
          }}
          onClick={onToggleMetronome}
          title={metronomeOn ? tx.metroOn : tx.metroOff}
          aria-pressed={!!metronomeOn}
        >
          {metronomeOn ? tx.metroOn : tx.metroOff}
        </button>
        <button style={btn} onClick={onToggle}>
          {expanded ? tx.close : tx.open}
        </button>
      </div>
    </div>
  );
}
