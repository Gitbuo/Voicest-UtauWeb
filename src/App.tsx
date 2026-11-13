/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import PitchVisualizer from './components/PitchVisualizer';
import { VocalNote } from './lib/pitch-contour';
import { Language, t } from './lib/i18n';
import { matchGlobalShortcut, SHORTCUT_DEFINITIONS, ShortcutAction } from './lib/shortcuts';

const LANGS: Language[] = ['en', 'vi', 'ja', 'zh', 'ko'];

interface VoicestState {
  notes: VocalNote[];
  bpm: number;
  trackName: string;
  currentTime: number;
  isPlaying: boolean;
  metronome?: boolean;
  lang: Language;
}

/** Cheap signature to tell whether the note list actually changed (avoids re-rendering every 150ms). */
function notesSignature(notes: readonly VocalNote[]): string {
  let sig = `${notes.length}`;
  for (const n of notes) {
    sig += `|${n.s},${n.l},${n.p},${n.t ?? ''},${n.pc ? n.pc.length : 0}`;
    if (n.pc && n.pc.length) sig += `,${n.pc[0]},${n.pc[n.pc.length - 1]}`;
  }
  return sig;
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sigRef = useRef('');
  const toastTimerRef = useRef<number | null>(null);

  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState<VocalNote[]>([]);
  const [bpm, setBpm] = useState(120);
  const [trackName, setTrackName] = useState('Vocal');
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [lang, setLang] = useState<Language>('en');
  const [toast, setToast] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 1600);
  }, []);

  const postToStudio = useCallback((payload: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(payload, window.location.origin);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const handleSeek = useCallback((timeSec: number) => {
    postToStudio({ type: 'SEEK_VOICEST', time: timeSec });
    setCurrentTime(timeSec);
  }, [postToStudio]);

  const handleToggleMetronome = useCallback(() => {
    postToStudio({ type: 'TOGGLE_METRONOME' });
    setMetronomeOn((prev) => {
      const next = !prev;
      showToast(t(next ? 'toast_metro_on' : 'toast_metro_off', lang));
      return next;
    });
  }, [lang, postToStudio, showToast]);

  const executeShortcut = useCallback((action: ShortcutAction) => {
    const beatSec = 60 / (bpm || 120);
    switch (action) {
      case 'play_pause':
        postToStudio({ type: 'TOGGLE_PLAY' });
        showToast(t(isPlaying ? 'toast_pause' : 'toast_play', lang));
        break;
      case 'stop':
        postToStudio({ type: 'STOP_PLAY' });
        setIsPlaying(false);
        setCurrentTime(0);
        showToast(t('toast_stop', lang));
        break;
      case 'seek_home':
        handleSeek(0);
        showToast(t('toast_home', lang));
        break;
      case 'seek_end':
        postToStudio({ type: 'SEEK_END' });
        showToast(t('toast_end', lang));
        break;
      case 'seek_back':
        handleSeek(Math.max(0, currentTime - beatSec));
        break;
      case 'seek_forward':
        handleSeek(currentTime + beatSec);
        break;
      case 'prev_track':
        postToStudio({ type: 'PREV_TRACK' });
        break;
      case 'next_track':
        postToStudio({ type: 'NEXT_TRACK' });
        break;
      case 'toggle_metro':
        handleToggleMetronome();
        break;
      case 'toggle_help':
        setShowShortcuts((v) => !v);
        break;
    }
  }, [bpm, currentTime, handleSeek, handleToggleMetronome, isPlaying, lang, postToStudio, showToast]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const action = matchGlobalShortcut(e);
      if (!action) return;
      e.preventDefault();
      executeShortcut(action);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [executeShortcut]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // only accept messages from our own Voicest iframe, same origin
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (!d || typeof d !== 'object') return;

      if (d.type === 'VOICEST_STATE') {
        const incoming: VoicestState = d;
        const sig = notesSignature(incoming.notes ?? []);
        if (sig !== sigRef.current) {
          sigRef.current = sig;
          setNotes(incoming.notes ?? []);
        }
        if (typeof incoming.bpm === 'number') setBpm(incoming.bpm);
        if (incoming.trackName) setTrackName(incoming.trackName);
        setIsPlaying(!!incoming.isPlaying);
        if (typeof incoming.metronome === 'boolean') setMetronomeOn(incoming.metronome);
        setCurrentTime((prev) => (Math.abs(prev - incoming.currentTime) > 0.01 ? incoming.currentTime : prev));
        if (LANGS.includes(incoming.lang)) setLang(incoming.lang);
      } else if (d.type === 'VOICEST_LANG_CHANGE') {
        if (LANGS.includes(d.lang)) setLang(d.lang);
      } else if (d.type === 'VOICEST_TRACK_CHANGED') {
        if (typeof d.trackName === 'string' && d.trackName) {
          setTrackName(d.trackName);
          showToast(t('toast_track', lang, d.trackName));
        }
      } else if (d.type === 'VOICEST_KEY_SHORTCUT') {
        const action = matchGlobalShortcut(d);
        if (action) executeShortcut(action);
      } else if (d.type === 'VOICEST_CMD') {
        if (d.cmd === 'f0') setExpanded((v) => !v);
        else if (d.cmd === 'fullscreen') toggleFullscreen();
      } else if (d.type === 'VOICEST_SHARE_URL') {
        if (typeof d.hash === 'string' && d.hash) {
          try {
            window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${d.hash}`);
          } catch (e) {}
        }
      } else if (d.type === 'VOICEST_TOAST') {
        if (typeof d.message === 'string' && d.message) {
          showToast(d.message);
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [executeShortcut, lang, showToast, toggleFullscreen]);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: '#eaf3f8', overflow: 'hidden' }}>
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 400,
            background: 'rgba(21, 29, 36, 0.88)',
            color: '#eaf3f8',
            padding: '6px 14px',
            borderRadius: 0,
            fontSize: 12.5,
            fontWeight: 600,
            boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
            pointerEvents: 'none',
          }}
        >
          {toast}
        </div>
      )}
      {showShortcuts && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('modal_title_shortcuts', lang)}
          onClick={() => setShowShortcuts(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 450,
            background: 'rgba(15, 23, 32, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#eaf3f8',
              color: '#243442',
              border: '2px solid #4a90b8',
              borderRadius: 0,
              maxWidth: 420,
              width: '100%',
              padding: '18px 20px',
              boxShadow: '0 14px 42px rgba(0,0,0,0.32)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 17, color: '#4a90b8' }}>{t('modal_title_shortcuts', lang)}</h2>
              <button
                type="button"
                onClick={() => setShowShortcuts(false)}
                style={{ background: '#d6e4ee', color: '#243442', border: '1px solid #b4cad8', borderRadius: 0, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}
              >
                {t('close', lang)}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SHORTCUT_DEFINITIONS.map((item) => (
                <div key={item.action} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, paddingBottom: 6, borderBottom: '1px dashed #b4cad8' }}>
                  <span>{t(item.labelKey, lang)}</span>
                  <span style={{ display: 'inline-flex', gap: 4 }}>
                    {item.keys.map((k) => (
                      <kbd
                        key={k}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #b4cad8',
                          borderRadius: 0,
                          padding: '2px 7px',
                          fontSize: 11.5,
                          fontWeight: 700,
                          fontFamily: 'ui-monospace, monospace',
                        }}
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        title="Voicest V2X"
        src={`./voicest.html${window.location.search}${window.location.hash}`}
        allow="autoplay; fullscreen; microphone"
        style={{ flex: 1, minHeight: 0, width: '100%', border: 0, background: '#eaf3f8' }}
      />
      <PitchVisualizer
        notes={notes}
        bpm={bpm}
        trackName={trackName}
        currentTime={currentTime}
        isPlaying={isPlaying}
        lang={lang}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        onSeek={handleSeek}
        metronomeOn={metronomeOn}
        onToggleMetronome={handleToggleMetronome}
      />
    </div>
  );
}
