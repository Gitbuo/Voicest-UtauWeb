// Shared helpers for the voicebank scripts: which files of a UTAU voicebank Voicest needs.
import fs from 'node:fs';
import path from 'node:path';

export const LIMIT = 100 * 1024 * 1024;
const KEEP_TXT = new Set(['oto.ini', 'character.txt', 'character.yaml', 'prefix.map', 'readme.txt']);
const KEEP_EXT = new Set(['.wav', '.png', '.jpg', '.jpeg', '.bmp', '.gif', '.webp', '.frq']);

// Desktop-engine cache files (.llsm, .mrq, .pmk, .uwf, .uwf2, and .frq unless keepFrq) are dropped.
export function keepFile(name, keepFrq = false) {
  const lower = name.toLowerCase(), ext = path.extname(lower);
  const cache = ['.llsm', '.mrq', '.pmk', '.uwf', '.uwf2', ...(keepFrq ? [] : ['.frq'])];
  if (cache.includes(ext)) return false;
  if (KEEP_TXT.has(lower) || ext === '.ini' || ext === '.map') return true;
  return KEEP_EXT.has(ext);
}

export function walk(dir, list = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, list);
    else if (e.isFile()) list.push(p);
  }
  return list.sort();
}

export const mb = n => (n / 1048576).toFixed(1) + ' MB';
