#!/usr/bin/env node
// Clean a UTAU voicebank folder and pack it as a .zip that Voicest can import (limit: 100 MB).
// Removes desktop-engine cache files (.llsm, .mrq, .pmk, .uwf, .uwf2, .frq by default) and
// unused text files, keeps WAV audio untouched, and prints the size before/after.
//
// Usage: node scripts/clean-voicebank.mjs <voicebank-folder> [output.zip] [--keep-frq]
// No dependencies: uses only Node.js built-ins (Node 18+).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { LIMIT, keepFile, walk, mb } from './vb-files.mjs';

const args = process.argv.slice(2);
const keepFrq = args.includes('--keep-frq');
const [src, outArg] = args.filter(a => !a.startsWith('--'));
if (!src || !fs.existsSync(src) || !fs.statSync(src).isDirectory()) {
  console.error('Usage: node scripts/clean-voicebank.mjs <voicebank-folder> [output.zip] [--keep-frq]');
  process.exit(1);
}
const root = path.resolve(src);
const out = path.resolve(outArg || `${root.replace(/[\\/]+$/, '')}.zip`);

const all = walk(root);
const kept = all.filter(p => keepFile(path.basename(p), keepFrq));
const sum = l => l.reduce((a, p) => a + fs.statSync(p).size, 0);
const before = sum(all), cleaned = sum(kept);

// ---- minimal ZIP writer (deflate, UTF-8 names) ----
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = b => { let c = -1; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const now = new Date();
const DOS_TIME = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
const DOS_DATE = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
const fd = fs.openSync(out, 'w');
let offset = 0;
const central = [];
const base = path.basename(root);
for (const p of kept) {
  const name = Buffer.from(`${base}/${path.relative(root, p).split(path.sep).join('/')}`, 'utf8');
  const data = fs.readFileSync(p), crc = crc32(data);
  const comp = zlib.deflateRawSync(data, { level: 9 });
  const useDeflate = comp.length < data.length, body = useDeflate ? comp : data;
  const h = Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(useDeflate ? 8 : 0, 8);
  h.writeUInt16LE(DOS_TIME, 10); h.writeUInt16LE(DOS_DATE, 12);
  h.writeUInt32LE(crc, 14); h.writeUInt32LE(body.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(name.length, 26);
  fs.writeSync(fd, h); fs.writeSync(fd, name); fs.writeSync(fd, body);
  const c = Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(useDeflate ? 8 : 0, 10);
  c.writeUInt16LE(DOS_TIME, 12); c.writeUInt16LE(DOS_DATE, 14);
  c.writeUInt32LE(crc, 16); c.writeUInt32LE(body.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42);
  central.push(c, name);
  offset += 30 + name.length + body.length;
}
const cd = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(kept.length, 8); end.writeUInt16LE(kept.length, 10);
end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
fs.writeSync(fd, cd); fs.writeSync(fd, end); fs.closeSync(fd);

const zipSize = fs.statSync(out).size;
console.log(`Files:        ${all.length} → ${kept.length} (removed ${all.length - kept.length})`);
console.log(`Folder size:  ${mb(before)} → ${mb(cleaned)} (${before ? (100 - cleaned / before * 100).toFixed(0) : 0}% smaller)`);
console.log(`ZIP:          ${out} (${mb(zipSize)})`);
if (zipSize > LIMIT) {
  console.warn(`Warning: the ZIP is larger than 100 MB, Voicest will refuse it. Split the voicebank (e.g. one ZIP per pitch folder).`);
  process.exitCode = 2;
}
