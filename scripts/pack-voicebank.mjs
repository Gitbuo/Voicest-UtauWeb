#!/usr/bin/env node
// Pack a UTAU voicebank folder for hosting (Cloudflare Tunnel, Cloudflare Pages, R2/S3/B2, any static server).
//
// Output (<out-dir>/<slug>/):
//   manifest.json            name, sizes, the list of parts and of every file (part, offset, size, SHA-256)
//   part001-<hash>.bin ...   the cleaned files stored back to back, each part <= --chunk-mb (default 50 MB)
// and <out-dir>/index.json, the list of voicebanks hosted in <out-dir> (shown in Voicest under "Online voicebanks").
//
// Voicest reads oto.ini & co. first and then fetches only the WAVs a song uses, with HTTP Range requests,
// and keeps every fetched file in the browser cache: repeat visits use (almost) no bandwidth.
// WAV data is copied unchanged. Part names contain their hash, so they can be cached forever (immutable).
//
// Usage: node scripts/pack-voicebank.mjs <voicebank-folder> [out-dir] [--name "Display name"] [--chunk-mb 50] [--keep-frq]
// No dependencies: uses only Node.js built-ins (Node 18+).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { LIMIT, keepFile, walk, mb } from './vb-files.mjs';

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const name0 = opt('--name'), chunkMb = Number(opt('--chunk-mb') ?? 50);
const keepFrq = args.includes('--keep-frq');
const [src, outArg] = args.filter(a => !a.startsWith('--'));
if (!src || !fs.existsSync(src) || !fs.statSync(src).isDirectory() || !(chunkMb > 0 && chunkMb <= 95)) {
  console.error('Usage: node scripts/pack-voicebank.mjs <voicebank-folder> [out-dir] [--name "Display name"] [--chunk-mb 1-95] [--keep-frq]');
  process.exit(1);
}
const root = path.resolve(src);
const name = name0 || path.basename(root);
const slug = name.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'voicebank';
const outRoot = path.resolve(outArg || 'voicebanks');
const outDir = path.join(outRoot, slug);
const CHUNK = Math.floor(chunkMb * 1024 * 1024);
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

const all = walk(root);
const kept = all.filter(p => keepFile(path.basename(p), keepFrq));
const tooBig = kept.filter(p => fs.statSync(p).size > CHUNK);
if (tooBig.length) {
  console.error(`These files are larger than one part (${chunkMb} MB): ${tooBig.map(p => path.relative(root, p)).join(', ')}`);
  process.exit(1);
}
if (!kept.some(p => /\.wav$/i.test(p))) { console.error('No .wav files found.'); process.exit(1); }

// small text files first (Voicest needs them to list the aliases), then the rest grouped by folder
const rank = p => (/\.(ini|map|txt|yaml)$/i.test(p) ? 0 : 1);
kept.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const files = [], chunks = [];
let cur = [], curSize = 0;
const flush = () => {
  if (!cur.length) return;
  const buf = Buffer.concat(cur), h = sha(buf);
  const file = `part${String(chunks.length + 1).padStart(3, '0')}-${h.slice(0, 12)}.bin`;
  fs.writeFileSync(path.join(outDir, file), buf);
  chunks.push({ file, size: buf.length, sha256: h });
  cur = []; curSize = 0;
};
for (const p of kept) {
  const data = fs.readFileSync(p);
  if (curSize + data.length > CHUNK) flush();
  files.push({ path: `${path.basename(root)}/${path.relative(root, p).split(path.sep).join('/')}`, size: data.length, chunk: chunks.length, offset: curSize, sha256: sha(data) });
  cur.push(data); curSize += data.length;
}
flush();

const totalSize = files.reduce((a, f) => a + f.size, 0);
const manifest = { format: 'voicest-voicebank', version: 1, name, created: new Date().toISOString(), totalSize, chunkSize: CHUNK, chunks, files };
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest));

const indexPath = path.join(outRoot, 'index.json');
let index = { voicebanks: [] };
try { index = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch {}
index.voicebanks = (index.voicebanks || []).filter(v => v.path !== `${slug}/manifest.json`);
index.voicebanks.push({ name, path: `${slug}/manifest.json`, size: totalSize, files: files.length });
index.voicebanks.sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

const before = all.reduce((a, p) => a + fs.statSync(p).size, 0);
console.log(`Files:   ${all.length} → ${files.length} (removed ${all.length - files.length} cache/unused files)`);
console.log(`Size:    ${mb(before)} → ${mb(totalSize)}`);
console.log(`Parts:   ${chunks.length} × ≤ ${chunkMb} MB (largest ${mb(Math.max(...chunks.map(c => c.size)))}, every request stays under ${mb(LIMIT)})`);
console.log(`Output:  ${outDir}${path.sep}manifest.json`);
console.log(`Index:   ${indexPath}`);
