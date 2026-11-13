# Voicest V2X

[![CI](https://github.com/Gitbuo/Voicest/actions/workflows/ci.yml/badge.svg)](https://github.com/Gitbuo/Voicest/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/Gitbuo/Voicest/actions/workflows/pages.yml/badge.svg)](https://github.com/Gitbuo/Voicest/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Voicest V2X is a professional browser-based vocal synthesizer and digital audio workstation (DAW) inspired by UTAU, OpenUTAU, and modern vocal synthesizers. It runs 100% client-side in the browser using Web Audio, WebAssembly, and modern Web APIs with no server requirement.

**Open it in your browser: https://gitbuo.github.io/Voicest/**

## Highlights

| Feature | What it does | Details |
| --- | --- | --- |
| Project Share URL | Instant 1-click shareable URL encoded with Deflate + Base64URL — anyone can open and play the exact project on their PC without installation | [Share URL Generator](#share-project-url-generator) |
| Multi-Format Exchange | Full bidirectional import & export for MusicXML, VSQX, CCS, UST, USTX, SVP, MIDI, and lossless Native Voicest (`.voi`) | [Supported Formats](#7-export--import-formats) |
| Audio Export Formats | Export to master WAV (16/24/32-bit), lossless FLAC, MP3 (192 kbps), and OGG (Opus) with real-time stereo balance | [Audio Formats](#7-export--import-formats) |
| Auto-Breath (Pitch Tuning) | Extended phrasing intake (0.35–0.75s) & warm sigh exhalations (0.35–0.75s) expressed via pitch tuning curves (`o.pc`), zero block note clutter | [Auto-Breath & Pitch Tuning](#auto-breath--pitch-tuning-representation) |
| Some bonus | Subtle background audio enhancers & bonus tools (Flutter, De-Esser, Humanize, Portamento, Throat, Doubler, Tube & Air) | [Some bonus](#some-bonus-features) |
| Cestloid 8 Appends | 8 distinct vocal timbres (Default, Child, Mature, Weak, Clear, Power, Whisper, Robot) with adaptive tuning | [Cestloid Appends](#cestloid-built-in-voice--8-appends) |
| OpenUTAU Playback Cursor | Persistent triangular marker head atop ruler, continuous track stem, live measure readout (`M3.1 · 0:04.5`) | [OpenUTAU Cursor](#1-piano-roll--editing-tools) |
| UTAU voicebanks | Load `.zip` / `.rar` / `.uar` archives or folders (CV, VCV, CVVC, multi-pitch), `oto.ini` and `prefix.map` in Shift-JIS or UTF-8 | [Vocal engines & voicebanks](#5-vocal-engines--voicebanks) |
| Saved voicebanks | Imported voicebanks are kept in the browser (IndexedDB) and restored on the next visit | [Saved voicebanks](#5-vocal-engines--voicebanks) |
| Online voicebanks | Host big voicebanks as ≤ 50 MB hashed parts; the browser downloads only the WAVs a song uses (HTTP Range), verifies SHA-256 and caches them | [Online voicebanks](#online-voicebanks-in-detail), [Hosting](#hosting-voicebanks) |
| Auto-tune (frq) | Natural pitch curves (glide, overshoot, end-of-note fall) computed from the voicebank `.frq` files, updated in the background as you edit | [Auto-tune (frq)](#auto-tune-frq) |
| Auto-Oto (CV) | Record or upload CV samples and generate `oto.ini` automatically | [Auto-Oto](#6-auto-oto-generator-cv-voicebanks) |
| WORLD vocoder | WebAssembly WORLD resampler for pitch / formant shifting | [Vocal engines](#5-vocal-engines--voicebanks) |
| 5 languages | English (default), Tiếng Việt, 日本語, 中文, 한국어 — UI and messages follow the selected language | [Supported Languages](#supported-languages) |
| Desktop / Laptop Square UI | 100% square edges (`border-radius: 0`), clean typography, zero emoji/icon pollution, optimized for PC/laptop | — |
| Offline | Service worker caches the app; saved and downloaded voicebanks work without a connection | [Online voicebanks](#online-voicebanks-in-detail) |
| 100 MB import limit | Every local import is ≤ 100 MB; `scripts/clean-voicebank.mjs` shrinks a voicebank below it | [Import size limit](#5-vocal-engines--voicebanks) |

## Quick start

Requirements: Node.js 22.6+.

```bash
npm install       # install dependencies
npm run dev       # dev server on http://localhost:3000
npm run lint      # type check (tsc --noEmit)
npm test          # unit tests (node --test)
npm run build     # production build in dist/
npm run preview   # serve dist/ locally
```

| Path | Contents |
| --- | --- |
| `public/voicest.html` | The editor itself (engines, piano roll, voicebank loader, i18n), loaded in an iframe |
| `src/` | React shell (`App.tsx`), pitch visualizer and tested helpers in `src/lib/` |
| `scripts/` | `clean-voicebank.mjs` (shrink + zip a voicebank) and `pack-voicebank.mjs` (pack a voicebank for hosting) |
| `public/sw.js` | Service worker: app shell cache for offline use |
| `.github/workflows/` | `ci.yml` (lint, test, build on every push / PR) and `pages.yml` (deploy to GitHub Pages from `main`) |

Every push to `main` is checked by CI and published to GitHub Pages. To host voicebanks on the Pages site, pack them into `public/voicebanks/` (see [Hosting voicebanks](#hosting-voicebanks)); keep each file under GitHub's 100 MB limit (parts are 50 MB by default).

---

# Voicest V2X — All Features Documentation

---

## 1. Piano Roll & Editing Tools
- **VOCALOID4-Style Note Creation & Drawing**:
  - **Click & Drag to Draw**: Click any empty cell and drag right to dynamically set note length with live grid snapping.
  - **Drag to Move**: Click any note's body to freely move in time and transpose pitch with immediate audition sound feedback.
  - **Drag to Resize**: Grab the right edge of any note to extend or shorten note duration.
  - **Inline Lyric Editor & Tab Navigation**: Double-click any note to open the inline lyric editor; press `Tab` to commit and immediately jump to the next note with its text selected for rapid sequential lyric entry.
  - **Natural Vibrato on Sustained Notes**: Notes sustained for a quarter note or longer (≥ 4 steps) automatically receive realistic vocal vibrato at their tail.
- **Pitch Points Tool (2)**: Click to add pitch curve points, drag to shape transitions, right-click to remove.
- **Tuning Brush (3)**: Freehand continuous pitch drawing across notes with smooth cosine interpolation.
- **Lasso Tool (4 / V)**: Click and drag a marquee selection rectangle to batch-select multiple notes across bars.
- **Erase Tool (E)**: Click or drag to erase notes and pitch points quickly.
- **Clear Tune**: Instantly reset pitch deviations for selected notes or the active channel.
- **Auto-Quantize & Quantize (Q)**: Grid snapping for 1/4, 1/8, 1/16, 1/32, 1/64, and triplets (1/8T, 1/16T).
- **Legato Smoothing**: Automatic cosine S-curve pitch glide between adjacent notes (gap ≤ 50ms).
- **Note Overlap Prevention**: Intelligent avoidance of overlapping notes on the same melodic track.
- **OpenUTAU Playback Cursor & Position Marker**: Persistent triangular marker head atop the ruler, vertical stem spanning down all tracks, does not vanish when playback stops (remains at `startAt`), interactive timeline scrubbing across ruler with real-time measure badge (`M3.1 · 0:04.5`).
- **Timeline & Transport**: BPM (40–240), Metronome, Bars (2–256), Loop mode, Swing timing, Master Volume.
- **Scale & Key Snapping**: Chromatic, Major, Minor, Pentatonic with key root selector.

---

## 2. Note Transposition & Step-by-Step Tuning
- **Step-by-step Semitone Shift**:
  - `▲ +1 Note` (Key `↑`): Shift pitch up by exactly 1 semitone (e.g. C4 → C#4 → D4).
  - `▼ -1 Note` (Key `↓`): Shift pitch down by exactly 1 semitone (e.g. D4 → C#4 → C4).
- **Octave Transposition**:
  - `▲ +12 Oct` (`Shift + ↑`): Transpose up 1 full octave (12 semitones, e.g. C3 → C4).
  - `▼ -12 Oct` (`Shift + ↓`): Transpose down 1 full octave (12 semitones, e.g. C4 → C3).
- **Audition Feedback**: Instant audio playback of transposed notes with real-time F0 visualizer updates.
- **Target Selection**: Transposes individually selected notes, lasso-selected groups, or the entire active channel.

---

## 3. Visual Note Coloring System
- **Track / Channel Colors**: Individual color pickers for every channel with responsive hex updates.
- **Pitch Rainbow Mode**: Harmonized chromatic palette assigning a distinct color to each of the 12 semitones:
  - C (Rose Red), C# (Coral), D (Warm Orange), D# (Amber), E (Golden Yellow), F (Lime), F# (Emerald), G (Cyan Blue), G# (Sky Blue), A (Purple), A# (Lilac), B (Magenta Pink).
- **Quick Palette Bar**: 8 curated vibrant colors (Sakura Pink, Mint, Cyan, Sunset, Lavender, Amber, Sky, Ruby) plus a full hex color picker.
- **Batch Coloring**: Click any palette swatch to color the selected note, all lasso-selected notes, or the track.

---

## 4. Channels & 12 Instrument Synthesizer
- **Channels**: Supports unlimited tracks with volume sliders, Mute (M), Solo (S), reordering (▲▼), and deletion (✕).
- **Interactive Channel Instrument Selector**: Switch instruments on any channel with one click:
  - 🎹 **Piano**: Acoustic multi-harmonic piano synthesis.
  - 🎹 **EPiano**: Electric piano (Rhodes/tine style bell harmonics and mellow decay).
  - 🎵 **Musicbox**: Chime bell synthesis.
  - 🎻 **Violin**: Sustained bowed solo string with vibrato LFO.
  - 🎻 **Strings**: Lush ensemble strings with chorus detuning and slow envelope attack.
  - 🎸 **Guitar**: Plucked acoustic string with dynamic lowpass filtering.
  - 🎸 **Bass**: Punchy electric/synth bass with sub-oscillator and decaying filter envelope.
  - 🎺 **Brass**: Punchy synth horns and brass section with resonant filter sweep.
  - 🪈 **Flute**: Airy woodwind with harmonic overtones and vibrato.
  - 👾 **Chip 8-bit**: Square, Sawtooth, and Triangle waveforms.
  - 🎤 **Voice**: Cestloid or external UTAU voicebanks.
  - 🔊 **Sample**: Custom WAV sample playback with pitch-tracking and slice controls.
- **Auto-Gain Staging (`⚖️ Auto-Gain`)**: Intelligently scans all tracks, balances loudness, prevents digital clipping (> 0.92 peak) and boosts quiet tracks (< 0.28 peak) without altering dynamic balance.

---

## 5. Vocal Engines & Voicebanks
- **Built-in Cestloid Voice**:
  - Formant synthesis singing in Japanese romaji or kana (`ka`, `か`, `kya`, `がっこう`).
  - Sliders for Brightness, Breathiness, Vibrato, Formant, Gender, and Vocal Tension.
  - **Cestloid 8 Voice Appends**: 8 distinct vocal timbres available directly from the track inspector:
    - **Default**: Balanced classic Cestloid tone.
    - **Child**: Youthful higher formant timbre (`f: 1.22`, `g: 0.55`).
    - **Mature**: Deep, warm resonant chest timbre (`f: 0.90`, `g: -0.45`).
    - **Weak**: Soft, delicate airy vocal timbre (`br: 0.28`, `t: 0.35`).
    - **Clear**: Bright, highly articulated forward timbre (`cl: 0.95`, `b: 0.75`).
    - **Power**: Belting, compressed resonant vocal delivery (`b: 0.85`, `v: 0.55`).
    - **Whisper**: Intimate breathy whisper (`br: 0.45`, `cl: 0.60`).
    - **Robot**: Formant-locked mechanical synthetic timbre (`f: 1.05`, `t: 0.90`).
  - Clarity EQ on the voice: high-pass at 90 Hz, less low-mid mud (280 Hz), presence boosts at 2.6 kHz and 3.6 kHz that follow the **Clarity** slider, a de-esser band at 7.2 kHz and a gentle high shelf; voiced buzz is low-passed at 6 kHz, note attacks fade in over about 10 ms and the s / sh / ts / ch noise is kept soft.
  - English-to-Kana phonemizer (EN2JA+).
- **UTAU Voicebank Support**:
  - Load folders, `.zip`, `.uar`, and `.rar` archives.
  - Auto-reads `oto.ini` and `prefix.map` with support for Shift-JIS and UTF-8 encodings.
  - Reclist formats: CV, VCV, and CVVC with automatic alias detection.
- **Saved Voicebanks (browser storage)**:
  - Imported voicebanks are kept in the browser (IndexedDB) and loaded again automatically the next time Voicest opens, so they never need to be imported or downloaded again.
  - Archives are stored as-is; folders keep only the files Voicest needs (`.wav`, `.ini`, `.map`, `.txt`, `.frq`, images), skipping desktop-engine caches such as `.llsm`, `.mrq`, `.pmk`, `.uwf`.
  - The **Saved voicebanks** panel under the import buttons lists stored voicebanks with their size, lets you remove them, shows browser storage usage, and has a **Keep voicebanks in this browser** switch.
  - Data stays on the user's device only; clearing site data in the browser removes it.
- **Import size limit (100 MB)**:
  - Any single import (voicebank archive, voicebank folder, audio or project file) may be at most **100 MB**. Larger files are refused with a message, which keeps memory use low and stays under the 100 MB per-request limit of Cloudflare Tunnel (Free).
  - For folders, only the files Voicest reads are counted; desktop-engine cache files are ignored.
- **Shrinking a voicebank below 100 MB**: `node scripts/clean-voicebank.mjs <voicebank-folder> [output.zip] [--keep-frq]`
  - Removes cache files (`.llsm`, `.mrq`, `.pmk`, `.uwf`, `.uwf2`, `.frq`) and unused text files, keeps every WAV untouched, prints the size before/after and writes a `.zip` ready to import. Needs only Node.js 18+, no extra packages.
  - If the ZIP is still over 100 MB, split the voicebank (for example one ZIP per pitch folder) and import each part.
- **Online voicebanks (low bandwidth hosting)**:
  - Large voicebanks (hundreds of MB or more) can be hosted next to Voicest or on any static host / object storage instead of being imported. Pack them with `node scripts/pack-voicebank.mjs <voicebank-folder> [out-dir] [--name "Display name"] [--chunk-mb 50] [--keep-frq]`.
  - The script removes cache files, keeps every WAV byte-for-byte, and writes `<out-dir>/<name>/manifest.json` (every file with its part, offset, size and SHA-256) plus `part001-<hash>.bin`, … of at most 50 MB each, and updates `<out-dir>/index.json`.
  - In Voicest, open **Saved voicebanks → Online voicebanks** and paste the `manifest.json` link, click a voicebank listed under **Available on this site** (read from `voicebanks/index.json`), or open `voicest.html?vb=<manifest URL>`.
  - Adding a voicebank downloads only the manifest, `oto.ini`, `character.txt` and `prefix.map`. Each WAV is fetched with an HTTP Range request the first time a song uses it, checked against its SHA-256, and kept in the browser (Cache Storage). Repeat visits download only the small manifest. **⤓** downloads all parts for offline use (one request per part); **✕** forgets the voicebank and deletes its cached files.
  - A service worker (`public/sw.js`) caches the app itself, so Voicest also opens offline after the first visit (https or localhost only).
- **Multi-pitch Voicebank Support**:
  - Auto-detects pitch tiers (e.g. `_A3`, `_C4`, `_F4`, `_A4`, `↑`, `↓`) directly from oto aliases even when `prefix.map` is missing.
  - Resolves note pitches to the nearest available pitch tier, ensuring seamless fallback without muted notes.
- **WORLD Vocoder**:
  - High-quality resynthesis using WebAssembly WORLD (Dio, CheapTrick, D4C, and Synthesis).
  - Optimized LRU analysis cache and synthesis memoization for lag-free playback and rendering.

---

## Hosting voicebanks

Every request stays below the 100 MB per-request limit of Cloudflare Tunnel (Free): a WAV range is a few hundred KB, a whole part at most 50 MB.

**Same server as Voicest (Cloudflare Tunnel, Cloudflare Pages, any static host)**
1. `node scripts/pack-voicebank.mjs "path/to/My Voicebank" public/voicebanks`
2. `npm run build` (the voicebanks are copied to `dist/voicebanks/`).
3. Serve `dist/` with a server that supports Range requests, e.g. `npx vite preview --port 3000 --host 0.0.0.0`, then `cloudflared tunnel --url http://localhost:3000`.
4. Cache headers: part files can be cached forever (`Cache-Control: public, max-age=31536000, immutable`, their name contains their hash); `*.json` and `sw.js` should use `Cache-Control: no-cache`. `public/_headers` already sets this on Cloudflare Pages.

**Object storage (Cloudflare R2, S3, Backblaze B2)**
1. Pack to a folder, e.g. `node scripts/pack-voicebank.mjs "My Voicebank" out`, and upload `out/` keeping the folder layout (e.g. `rclone copy out r2:my-bucket/voicebanks`). R2 has no egress fees.
2. Allow Voicest's site to read it with CORS (R2: bucket → Settings → CORS policy):
   ```json
   [{"AllowedOrigins":["https://your-voicest-site"],"AllowedMethods":["GET","HEAD"],"AllowedHeaders":["Range"],"ExposeHeaders":["Content-Length","Content-Range","Accept-Ranges"],"MaxAgeSeconds":86400}]
   ```
3. Use the public URL of `manifest.json` in **Online voicebanks**, or link to `https://your-voicest-site/?vb=https://…/manifest.json`.

Re-packing a changed voicebank gives the changed parts new names; browsers pick up the new manifest on their next visit and only download what changed.

Not included: server-side rendering of UTAU voices to Opus (needs a VPS running a UTAU resampler); with the setup above the browser still renders everything locally.

## Online voicebanks in detail

**Why:** UTAU voicebanks are often 200 MB – 2 GB and full of desktop-engine cache files. Downloading a whole archive on every visit wastes bandwidth and breaks per-request limits such as Cloudflare Tunnel Free (100 MB). Online voicebanks are downloaded sample by sample and kept in the browser.

**Pack** (on your computer, Node.js 18+, no extra packages):
```bash
node scripts/pack-voicebank.mjs "path/to/My Voicebank" public/voicebanks --name "My Voicebank"
```
| Output | Purpose |
| --- | --- |
| `public/voicebanks/<slug>/manifest.json` | Name, total size and, for every file, its part, byte offset, size and SHA-256 |
| `public/voicebanks/<slug>/part001-<hash>.bin`, … | The voicebank files concatenated into parts of at most 50 MB (`--chunk-mb 1…95`); the name contains the content hash, so parts can be cached forever |
| `public/voicebanks/index.json` | List of voicebanks hosted on the site, shown under **Available on this site** |

Cache files (`.llsm`, `.mrq`, `.pmk`, `.uwf`, `.uwf2`, and `.frq` unless `--keep-frq`) are removed; WAV files are copied byte for byte.

**Use:** open **Saved voicebanks → Online voicebanks** and either click a voicebank under **Available on this site**, paste a `manifest.json` URL, or share a link like `https://gitbuo.github.io/Voicest/?vb=<manifest URL>`.

**What is downloaded**
| Moment | Network |
| --- | --- |
| Adding the voicebank | `manifest.json` + `oto.ini`, `character.txt`, `prefix.map`, images (a few KB) |
| A note needs a sample for the first time | Only that WAV, through an HTTP `Range` request inside its part; checked against the SHA-256 in the manifest |
| Next visits | Only `manifest.json` (revalidated); every sample already used comes from Cache Storage (`voicest-vb-files-v1`) |
| **⤓** (download for offline) | Every part, one request each (≤ 50 MB) |
| **✕** | Forgets the voicebank and deletes its cached files |

Hosts without Range support still work: the whole part is fetched once and cached. Updating a voicebank only changes the parts whose content changed.

## Auto-tune (frq)

The **Auto-tune (frq)** checkbox in the Tools bar (on by default, remembered in the browser) gives Voice notes a natural pitch curve without drawing it by hand:

- **Glide between notes:** when a note directly follows another at a different pitch, the pitch moves with a cosine curve whose length grows with the interval (40 ms + 9 ms per semitone, at most 140 ms or half the note).
- **Voicing-aware start:** the glide starts when the sample actually becomes voiced. Voicest reads the sample's UTAU `.frq` file (`FREQ0003`: f0 and amplitude per frame) and finds the first frame with f0 > 40 Hz and enough amplitude after the oto offset.
- **Overshoot:** jumps of 3 semitones or more overshoot slightly (up to 0.18 semitone) and settle within about 90 ms.
- **End-of-note fall:** on long notes (≥ 1 beat) that are not followed by a connected note, if the recording itself drifts down at the end (median f0 of the tail vs. the middle, below −15 cents) the last 20 % of the note falls a little, like the singer did.
- **Background and incremental:** the first run processes every note; afterwards only the edited note and its two neighbours are recalculated. Notes whose pitch curve you drew yourself (Pitch pts / Tuning brush) are never overwritten.
- Notes without a `.frq` file still get the glide and overshoot; only the voicing-aware start and the fall need it. Keep `.frq` files with `--keep-frq` when packing an online voicebank if you rely on them.

## Cestloid (built-in voice & 8 Appends)

Cestloid is a formant synthesizer that sings Japanese romaji / kana (and English through EN2JA+) with no voicebank. Sliders: Brightness, Breathiness, Vibrato, Formant, Gender, Tension and **Clarity**, with 8 selectable timbre appends (Default, Child, Mature, Weak, Clear, Power, Whisper, Robot). See the clarity EQ in [Vocal engines](#5-vocal-engines--voicebanks) and the editable consonant / vowel timing below.

---

## Auto-Breath & Pitch Tuning Representation

In modern vocal synthesis (OpenUTAU, Synthesizer V), breath is treated as an acoustic articulation and pitch inflection on phrase boundaries rather than separate rectangular note blocks cluttering the melody.

- **Pitch Tuning Contour (`o.pc`)**:
  - Breath is rendered directly onto the note's pitch tuning curve instead of creating separate note blocks (`xóa nốt đi`).
  - **Inhalation (Thở vào)**: Renders as a smooth pre-note pitch swoop (drawn in vivid Coral `#f43f5e`, labeled `[Thở vào]` / `[Inhale]`) starting up to 0.75s before the phrase begins and ramping smoothly into the target note pitch.
  - **Exhalation (Thở ra)**: Renders as a gentle post-note release sigh (drawn in vivid Cyan `#06b6d4`, labeled `[Thở ra]` / `[Exhale]`) decaying naturally downwards after the final note ends.
  - **Interactive Editing (Tool 1 - Pitch Points)**: Breath pitch control points are fully draggable, allowing precise tactile shaping of intake scoops and release sighs.
- **Adaptive Phrasing & Duration Rules**:
  - **Long phrases (25+ notes)**: 0.75s extended gentle intake breath.
  - **Medium phrases (10–24 notes)**: 0.55s extended gentle intake breath.
  - **Short phrases (1–9 notes)**: 0.35s extended gentle intake breath.
  - **Inter-phrase gap of 1.8–10s**: 0.35s extended exhalation sigh.
  - **Inter-phrase gap of ≥ 10s or song end**: 0.75s sustained warm exhalation sigh.
- **Tri-Formant Acoustic Modeling**:
  - Formant 1: Dynamic pharyngeal cavity opening sweep (1050 Hz → 2250 Hz → 1900 Hz).
  - Formant 2: Subglottal chest/tracheal resonance (540 Hz inhale / 680 Hz exhale).
  - Formant 3: Oral/dental air friction (3850 Hz inhale / 2600 Hz exhale).
  - High Air Sheen (> 6200 Hz): Studio condenser mic air presence with gentle gain (< 0.35 intensity) for natural vocal breathing.

---

## Some bonus features

Voicest V2X includes subtle background audio refinement tools that operate seamlessly in the background without getting in the way:
- **Background Audio Refinement**: Subtle micro-pitch warmth, organic groove dynamics, harmonic saturation, dynamic de-essing, Haas stereo width, and breath articulation running automatically in the background.

---

## 6. Auto-Oto Generator (CV Voicebanks)
- **Dedicated CV Tool**: Specially tailored for raw CV (Consonant + Vowel / 単独音) recordings.
- **RMS Energy Boundary Detection**: Analyzes sliding-window Root-Mean-Square energy to find:
  - `Offset`: Voice attack onset (noise floor threshold).
  - `Consonant`: Fixed consonant duration before vowel sustain.
  - `Preutterance`: Attack lead-in time before the musical beat.
  - `Overlap`: Crossfade blend duration.
  - `Cutoff`: Trailing silence cutoff (negative ms from file end).
- **Interactive Waveform Inspector**: Visual canvas displaying 5 colored UTAU markers with real-time numeric inputs.
- **Microphone Recording & WAV Upload**: Record syllables sequentially from the Japanese 50-sounds chart or batch-upload raw WAV files.
- **Export Options**: Copy `oto.ini`, download `oto.ini`, or download a complete bundled `CV_Voicebank.zip` ready for use.

---

## Cestloid phoneme timing (k-a)
- The **Phoneme** strip under the piano roll shows every Voice note as `k-a`: onset consonant, the **main vowel in the middle**, and an optional coda (`a-t`).
- Three draggable bars per note: **consonant start**, the **k|a boundary** (Shift + drag moves the whole consonant without changing its length) and the **vowel|coda boundary**. A live millisecond readout is shown while dragging.
- The synth follows the strip exactly: the vowel starts at the note start plus the k|a offset (`cp`), the consonant length is `ct`, and the coda length is `cc`. Notes without edits behave exactly as before; the **Timing** button resets the channel; Ctrl+Z undoes a drag.
- The edit box accepts the same notation (`k-a`, `sh-i`).

---

## 7. Export & Import Formats

Voicest V2X provides universal format interoperability across digital audio workstations, vocal synthesizer projects, and score exchange formats.

### 7.1. Project & Notation Formats

| Format | Extension | Import | Export | Description |
| :--- | :--- | :---: | :---: | :--- |
| **MusicXML** | `.musicxml`, `.xml` | Yes | Yes | Industry-standard vocal sheet music & notation exchange with lyric syllables, pitch, and meter |
| **VSQX** | `.vsqx` | Yes | Yes | Yamaha VOCALOID 3 and VOCALOID 4 project format including note phonemes and velocities |
| **VPR** | `.vpr` | Yes | Yes | Yamaha VOCALOID 5 and VOCALOID 6 sequence format with pitch curves and parts |
| **CCS** | `.ccs` | Yes | Yes | CeVIO Creative Studio score format with Japanese kana lyrics and precise phoneme timing |
| **UST** | `.ust` | Yes | Yes | Classic UTAU project format with note flags, pitches, and envelopes |
| **USTX** | `.ustx` | Yes | Yes | OpenUTAU multi-track project format |
| **SVP** | `.svp` | Yes | Yes | Synthesizer V project format with vocal tracks and tempos |
| **Standard MIDI** | `.mid`, `.midi` | Yes | Yes | Standard MIDI Files (Type 0 and Type 1) with tempo maps and pitch data |
| **Voicest Native** | `.voi`, `.voicest`, `.json` | Yes | Yes | Lossless complete state: tracks, instruments, F0 pitch points, Cestloid parameters, and mixer |
| **Project Share URL** | `https://...#share=...` | Yes | Yes | 1-click shareable web link encoded via Deflate + Base64URL for instant loading without files |

> **All-in-One Project & Score Export Center**: All audio and project formats (WAV, MP3, OGG, MIDI, MusicXML, VSQX, CCS, UST, USTX, SVP, VPR, and native Voicest `.voi`) are unified into a compact Export button and dialog.

### 7.2. Audio Formats

| Format | Bit Depth / Quality | Import | Export | Engine & Details |
| :--- | :--- | :---: | :---: | :--- |
| **WAV** | 16-bit / 24-bit / 32-bit float | Yes | Yes | Master uncompressed linear PCM audio; selectable bit depth in Export Audio dialog |
| **FLAC** | Lossless compression | Yes | Yes | Broadcast-quality lossless audio export |
| **MP3** | 192 kbps CBR | Yes | Yes | Pure client-side LAME encoding in browser; fast and lightweight |
| **OGG** | Opus / Vorbis | Yes | Yes | Modern high-efficiency Web Audio encoding |
| **AIFF** | 16-bit / 24-bit | Yes | — | Apple Audio Interchange File Format import |

### 7.3. Voicebank Formats & Phonemizer Types

| Format / Reclist | Supported Types | Details |
| :--- | :--- | :--- |
| **Archive Formats** | `.zip`, `.rar`, `.uar`, Unpacked Folders | Drag & drop or file picker; unpacked and cached in browser IndexedDB |
| **CV (単独音)** | Romaji / Kana / Katakana | Standard single-syllable voicebanks (`ka`, `sa`, `ta`) |
| **VCV (連続音)** | `a ka`, `i sa`, `u ta` | Smooth inter-syllable diphthong transitions with automatic prefix mapping |
| **CVVC** | `ka`, `a k`, `sa`, `a s` | Separate vowel-consonant and consonant-vowel transitions |
| **C+V (Separated)** | `K` / `k` (Consonant) + `a` (Vowel) | Syllables like `ka` automatically resolve to separate consonant ("K") and vowel ("a") samples |
| **Multi-pitch Tiers** | `_C4`, `_F4`, `_A4`, `↑`, `↓` | Auto-detects pitch tiers directly from alias suffixes with fallback to nearest tier |
| **Config & Tuning** | `oto.ini`, `prefix.map`, `.frq` | Shift-JIS & UTF-8 auto-decoding; `.frq` cache for instant natural auto-tuning |

### 7.4. Supported Languages

Every label, modal, tooltip, and toast dynamically adapts across 5 international languages:

| Language Code | Language | Native Name | Default |
| :--- | :--- | :--- | :---: |
| `en` | English | English | Yes |
| `vi` | Vietnamese | Tiếng Việt | — |
| `ja` | Japanese | 日本語 | — |
| `zh` | Chinese (Simplified) | 中文 | — |
| `ko` | Korean | 한국어 | — |

### 7.5. Cestloid 8 Voice Appends

| Append | Character & Timbre | Formant & Gender | Target Application |
| :--- | :--- | :--- | :--- |
| **Default** | Classic balanced Cestloid | Neutral (`f: 1.0`, `g: 0.0`) | Pop, electronic, and versatile lead vocal |
| **Child** | Youthful, innocent, bright | Higher formant (`f: 1.22`, `g: 0.55`) | Cute anime, high register melodies |
| **Mature** | Deep, warm, resonant chest tone | Lower formant (`f: 0.90`, `g: -0.45`) | Ballads, jazz, soul, deeper vocals |
| **Weak** | Soft, airy, delicate delivery | High breathiness (`br: 0.28`, `t: 0.35`) | Acoustic, emotional acoustic intros |
| **Clear** | Bright, forward, crisp articulation | High clarity (`cl: 0.95`, `b: 0.75`) | Fast-paced EDM, synthpop, dense mixes |
| **Power** | Belting, compressed, punchy | Saturated drive (`b: 0.85`, `v: 0.55`) | Rock, heavy pop, energetic climaxes |
| **Whisper** | Breathy intimate whisper | Maximum air (`br: 0.45`, `cl: 0.60`) | Ambient, quiet verses, ASMR textures |
| **Robot** | Mechanical formant-locked synth | Fixed formants (`f: 1.05`, `t: 0.90`) | Chiptune, cyberpunk, vocoder-style hooks |

### 7.6. C+V Voicebank Custom Mapping Rules & Settings Panel

Voicest V2X features a dedicated **C+V Rules** (`Quy tắc C+V`) settings panel in the top header bar:
- **Explicit Syllable Mapping**: Define exactly how any input syllable (e.g. `ka`, `shi`, `fa`, `tu`) maps to its target Consonant alias (`K`, `SH`, `F`, `T`) and Vowel alias (`a`, `i`, `u`, `A`).
- **Adjustable Consonant Lead Timing**: Configure precise onset attack timing in milliseconds (`leadMs`, default 45ms) per rule.
- **Built-in Presets**: 1-click loading for **Standard Romaji** (`ka ➔ K + a`) and **English / Arpasing** (`ka ➔ K + AA`).
- **Live Interactive Tester**: Type any syllable in real time to preview the exact resolved consonant, vowel, and lead duration before playback.
- **JSON Import & Export**: Back up and transfer mapping configurations across machines (`voicest_cv_mapping_rules.json`).
- **Automatic Persistence**: All rules are saved directly to `localStorage` and take effect immediately on playback.

---

## 8. Publishing to GitHub & GitHub Pages Guide

If you encounter issues publishing to GitHub, check the following key settings:

1. **GitHub Pages Deployment Source**:
   - Go to your repository on GitHub: **Settings → Pages**.
   - Under **Build and deployment → Source**, change the dropdown from *"Deploy from a branch"* to **"GitHub Actions"**.
   - Voicest V2X includes `.github/workflows/pages.yml` which builds and deploys directly via GitHub Actions.

2. **GitHub Actions Workflow Permissions**:
   - Go to **Settings → Actions → General → Workflow permissions**.
   - Select **"Read and write permissions"** and check **"Allow GitHub Actions to approve pull requests"**.
   - Click **Save**.

3. **Jekyll Processing Disabled (`.nojekyll`)**:
   - A `.nojekyll` file is included in `public/.nojekyll` so GitHub Pages serves raw client-side bundles without Jekyll interference.

4. **Git Credentials & Push**:
   - GitHub requires a **Personal Access Token (PAT)** with `repo` and `workflow` scopes instead of account passwords.
   - To push from command line:
     ```bash
     git remote set-url origin https://<YOUR_GITHUB_TOKEN>@github.com/Gitbuo/Voicest.git
     git push -u origin main
     ```

---

## 9. Keyboard Shortcuts
| Key | Action |
|---|---|
| `Space` | Play / Stop playback |
| `1` `2` `3` `4` | Select Tools: Note, Pitch pts, Tuning brush, Erase |
| `V` | Select Lasso tool (batch select) |
| `↑` / `↓` | Transpose by 1 semitone (C4 → C#4) |
| `Shift + ↑` / `Shift + ↓` | Transpose by 1 octave (12 semitones) |
| `Delete` / `Backspace` | Delete selected notes |
| `Q` | Quantize active track |
| `[` / `]` | Decrease / Increase default note length |
| `L` | Toggle Loop playback |
| `M` | Toggle Metronome |
| `Home` | Return playhead to start |
| `Ctrl + Z` / `Ctrl + Y` | Undo / Redo (50 steps) |
| `Ctrl + S` | Save project |
| `?` | Open README & Credits |

---

## 10. Open Source Licenses & Attributions

Voicest is built with gratitude to the creators of open-source vocal synthesis technologies:

- **WORLD Vocoder**:
  - Original Algorithm: Masanori Morise (Modified BSD 3-Clause License).
  - WebAssembly Port (World.JS): YuzukiTsuru (Modified BSD 3-Clause / MIT).
- **Wavtool (Organum)**:
  - Version 0.0.8 by KakouLabs / KYURAE KIM (MIT License). Sample concatenation, volume envelopes, and soft limiting.
- **Resampler (straycat-rs)**:
  - Developed by UtaUtaUtau (MIT / Apache-2.0 License).
- **Phonemizer (EN2JA+)**:
  - Created by Cadlaxa, integrated into OpenUtau (MIT License).
- **MP3 Encoder (lamejs)**:
  - Pure JavaScript LAME MP3 encoder by Janez Stupar & contributors (Licensed under MIT; dual-licensed with LGPL-3.0).
- **Data-Driven Documents (D3.js)**:
  - Mike Bostock (ISC License).
- **Voicest Application**:
  - Licensed under the MIT License. Contributors: Gitbuo, Gemini, Claude, Devin. See [LICENSE](./LICENSE).

### Complete Verbatim License Texts & Legal Notices
For 100% legal compliance and attribution, the complete, unabridged license texts for all components are provided in:
- **Application License**: [`LICENSE`](./LICENSE) (MIT License full text)
- **Third-Party Notices**: [`THIRD-PARTY-NOTICES.md`](./THIRD-PARTY-NOTICES.md) (Verbatim BSD, MIT, ISC, and dual-license declarations)
