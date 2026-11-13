/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * Voicest V2X — C+V (Consonant + Vowel) Separated Voicebank Phonemizer & Resolver.
 * Enables seamless synthesis for voicebanks where consonants and vowels are recorded
 * and stored as separate audio samples or oto entries (e.g., C: "k"/"K", V: "a").
 * Includes custom mapping rules configuration support.
 */

export interface MoraParts {
  consonant: string;
  vowel: string;
  original: string;
}

export interface CVMemberRule {
  id: string;
  syllable: string;        // e.g. "ka", "shi", "tsu", "tu", "fa", "か"
  consonant: string;       // target consonant alias in voicebank, e.g. "K", "k-", "- K"
  vowel: string;           // target vowel alias in voicebank, e.g. "a", "A", "- a"
  leadMs?: number;         // custom consonant lead/attack duration in ms (default 45ms)
  enabled: boolean;
}

export interface CVSplitMatch<T = unknown> {
  isSplit: boolean;
  consonant: string;
  vowel: string;
  consonantEntry: T | null;
  vowelEntry: T | null;
  compositeAlias: string;
  ruleMatched?: CVMemberRule | null;
  leadMs?: number;
}

export interface CVSplitTiming {
  consonantDurationSec: number;
  consonantLeadSec: number;
  vowelStartSec: number;
  vowelDurationSec: number;
  crossfadeSec: number;
}

export const STORAGE_KEY_CV_RULES = 'voicest_cv_custom_rules';

export const DEFAULT_CV_PRESET_RULES: CVMemberRule[] = [
  { id: 'cv_ka', syllable: 'ka', consonant: 'K', vowel: 'a', leadMs: 45, enabled: true },
  { id: 'cv_ki', syllable: 'ki', consonant: 'K', vowel: 'i', leadMs: 45, enabled: true },
  { id: 'cv_ku', syllable: 'ku', consonant: 'K', vowel: 'u', leadMs: 45, enabled: true },
  { id: 'cv_ke', syllable: 'ke', consonant: 'K', vowel: 'e', leadMs: 45, enabled: true },
  { id: 'cv_ko', syllable: 'ko', consonant: 'K', vowel: 'o', leadMs: 45, enabled: true },
  { id: 'cv_sa', syllable: 'sa', consonant: 'S', vowel: 'a', leadMs: 55, enabled: true },
  { id: 'cv_shi', syllable: 'shi', consonant: 'SH', vowel: 'i', leadMs: 65, enabled: true },
  { id: 'cv_su', syllable: 'su', consonant: 'S', vowel: 'u', leadMs: 55, enabled: true },
  { id: 'cv_se', syllable: 'se', consonant: 'S', vowel: 'e', leadMs: 55, enabled: true },
  { id: 'cv_so', syllable: 'so', consonant: 'S', vowel: 'o', leadMs: 55, enabled: true },
  { id: 'cv_ta', syllable: 'ta', consonant: 'T', vowel: 'a', leadMs: 40, enabled: true },
  { id: 'cv_chi', syllable: 'chi', consonant: 'CH', vowel: 'i', leadMs: 55, enabled: true },
  { id: 'cv_tsu', syllable: 'tsu', consonant: 'TS', vowel: 'u', leadMs: 55, enabled: true },
  { id: 'cv_te', syllable: 'te', consonant: 'T', vowel: 'e', leadMs: 40, enabled: true },
  { id: 'cv_to', syllable: 'to', consonant: 'T', vowel: 'o', leadMs: 40, enabled: true },
  { id: 'cv_na', syllable: 'na', consonant: 'N', vowel: 'a', leadMs: 45, enabled: true },
  { id: 'cv_ni', syllable: 'ni', consonant: 'N', vowel: 'i', leadMs: 45, enabled: true },
  { id: 'cv_nu', syllable: 'nu', consonant: 'N', vowel: 'u', leadMs: 45, enabled: true },
  { id: 'cv_ne', syllable: 'ne', consonant: 'N', vowel: 'e', leadMs: 45, enabled: true },
  { id: 'cv_no', syllable: 'no', consonant: 'N', vowel: 'o', leadMs: 45, enabled: true },
  { id: 'cv_ha', syllable: 'ha', consonant: 'H', vowel: 'a', leadMs: 50, enabled: true },
  { id: 'cv_hi', syllable: 'hi', consonant: 'H', vowel: 'i', leadMs: 50, enabled: true },
  { id: 'cv_fu', syllable: 'fu', consonant: 'F', vowel: 'u', leadMs: 55, enabled: true },
  { id: 'cv_he', syllable: 'he', consonant: 'H', vowel: 'e', leadMs: 50, enabled: true },
  { id: 'cv_ho', syllable: 'ho', consonant: 'H', vowel: 'o', leadMs: 50, enabled: true },
  { id: 'cv_ma', syllable: 'ma', consonant: 'M', vowel: 'a', leadMs: 45, enabled: true },
  { id: 'cv_mi', syllable: 'mi', consonant: 'M', vowel: 'i', leadMs: 45, enabled: true },
  { id: 'cv_mu', syllable: 'mu', consonant: 'M', vowel: 'u', leadMs: 45, enabled: true },
  { id: 'cv_me', syllable: 'me', consonant: 'M', vowel: 'e', leadMs: 45, enabled: true },
  { id: 'cv_mo', syllable: 'mo', consonant: 'M', vowel: 'o', leadMs: 45, enabled: true },
  { id: 'cv_ya', syllable: 'ya', consonant: 'Y', vowel: 'a', leadMs: 45, enabled: true },
  { id: 'cv_yu', syllable: 'yu', consonant: 'Y', vowel: 'u', leadMs: 45, enabled: true },
  { id: 'cv_yo', syllable: 'yo', consonant: 'Y', vowel: 'o', leadMs: 45, enabled: true },
  { id: 'cv_ra', syllable: 'ra', consonant: 'R', vowel: 'a', leadMs: 35, enabled: true },
  { id: 'cv_ri', syllable: 'ri', consonant: 'R', vowel: 'i', leadMs: 35, enabled: true },
  { id: 'cv_ru', syllable: 'ru', consonant: 'R', vowel: 'u', leadMs: 35, enabled: true },
  { id: 'cv_re', syllable: 're', consonant: 'R', vowel: 'e', leadMs: 35, enabled: true },
  { id: 'cv_ro', syllable: 'ro', consonant: 'R', vowel: 'o', leadMs: 35, enabled: true },
  { id: 'cv_wa', syllable: 'wa', consonant: 'W', vowel: 'a', leadMs: 45, enabled: true },
];

const KANA_TO_ROMAJI: Record<string, string> = {
  'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
  'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
  'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
  'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
  'な': 'na', 'ni': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
  'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
  'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
  'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
  'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
  'わ': 'wa', 'を': 'o', 'ん': 'n',
  'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
  'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
  'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'де': 'de', 'ど': 'do',
  'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
  'ぱ': 'pa', 'pi': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
  'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
  'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho',
  'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho',
  'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
  'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
  'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
  'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
  'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
  'じゃ': 'ja', 'じゅ': 'ju', 'じょ': 'jo',
  'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
  'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',
};

const VOWEL_TO_KANA: Record<string, string> = {
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お', n: 'ん',
};

/**
 * Matches input against custom C+V mapping rules.
 */
export function matchCustomCVRule(lyric: string, rules: CVMemberRule[]): CVMemberRule | null {
  if (!rules || !rules.length || !lyric) return null;
  const raw = String(lyric).trim();
  const lower = raw.toLowerCase();
  const romaji = KANA_TO_ROMAJI[raw] || KANA_TO_ROMAJI[lower] || lower;

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const syl = String(rule.syllable || '').trim().toLowerCase();
    if (syl === lower || syl === raw || syl === romaji) {
      return rule;
    }
  }
  return null;
}

/**
 * Loads custom rules from localStorage or fallback defaults.
 */
export function loadCVRulesFromStorage(): CVMemberRule[] {
  if (typeof localStorage === 'undefined') return [...DEFAULT_CV_PRESET_RULES];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CV_RULES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch (e) {
    // ignore parse error
  }
  return [...DEFAULT_CV_PRESET_RULES];
}

/**
 * Saves custom rules to localStorage.
 */
export function saveCVRulesToStorage(rules: CVMemberRule[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_CV_RULES, JSON.stringify(rules));
  } catch (e) {
    // ignore quota error
  }
}

/**
 * Decomposes romanized syllable or Japanese kana into consonant (C) and vowel (V).
 */
export function splitMora(lyric: string): MoraParts {
  const raw = String(lyric || '').trim();
  if (!raw) return { consonant: '', vowel: 'a', original: '' };

  let text = raw.toLowerCase();
  if (KANA_TO_ROMAJI[text]) {
    text = KANA_TO_ROMAJI[text];
  } else if (KANA_TO_ROMAJI[raw]) {
    text = KANA_TO_ROMAJI[raw];
  }

  // Handle nasal coda
  if (text === 'n' || text === 'ん' || text === 'ン') {
    return { consonant: '', vowel: 'n', original: raw };
  }

  // Multi-char consonants: 'kya', 'sha', 'tsu', etc.
  const multiMatch = text.match(/^(sh|ch|ts|[kgsztdnhbpmr]y)([aiueo])/);
  if (multiMatch) {
    return { consonant: multiMatch[1], vowel: multiMatch[2], original: raw };
  }

  // Single-char consonant + vowel: 'ka', 'sa', 'ta', etc.
  const singleMatch = text.match(/^([kgsztdnhbpmryfjwvlcq])([aiueo])/);
  if (singleMatch) {
    return { consonant: singleMatch[1], vowel: singleMatch[2], original: raw };
  }

  // Pure vowel: 'a', 'i', 'u', 'e', 'o'
  const vowelMatch = text.match(/^([aiueo])/);
  if (vowelMatch) {
    return { consonant: '', vowel: vowelMatch[1], original: raw };
  }

  // Fallback default
  return { consonant: '', vowel: text.slice(0, 1) || 'a', original: raw };
}

/**
 * Generates prioritized list of lookup aliases for the consonant part.
 * Checks uppercase (e.g. "K"), lowercase (e.g. "k"), prefix hyphen ("- k", "-k"),
 * suffix hyphen ("k-", "k -"), underscore ("_k", "k_"), and phonetic alternates.
 */
export function getConsonantCandidates(c: string): string[] {
  if (!c) return [];
  const lower = c.toLowerCase();
  const upper = c.toUpperCase();
  const list = [
    upper,            // e.g. "K" (User specified common convention)
    lower,            // e.g. "k"
    `- ${upper}`,     // e.g. "- K"
    `- ${lower}`,     // e.g. "- k"
    `-${upper}`,      // e.g. "-K"
    `-${lower}`,      // e.g. "-k"
    `${upper}-`,      // e.g. "K-"
    `${lower}-`,      // e.g. "k-"
    `${upper} -`,     // e.g. "K -"
    `${lower} -`,     // e.g. "k -"
    `_${upper}`,
    `_${lower}`,
    `${upper}_`,
    `${lower}_`,
  ];

  // Phonetic alternates for compound consonants
  if (lower === 'sh') {
    list.push('s', 'S', '- s', '- S', 'sh-', 's-');
  } else if (lower === 'ts') {
    list.push('t', 'T', '- t', '- T', 'tsu', 'TSU');
  } else if (lower === 'ch') {
    list.push('c', 'C', 't', 'T', 'chi', 'CHI');
  } else if (lower === 'j') {
    list.push('z', 'Z', 'ji', 'JI');
  } else if (lower.endsWith('y')) {
    const base = lower.slice(0, -1);
    list.push(base, base.toUpperCase());
  }

  return [...new Set(list)];
}

/**
 * Generates prioritized list of lookup aliases for the vowel part.
 */
export function getVowelCandidates(v: string): string[] {
  if (!v) return ['a'];
  const lower = v.toLowerCase();
  const upper = v.toUpperCase();
  const kana = VOWEL_TO_KANA[lower] || '';

  const list = [
    lower,            // e.g. "a"
    upper,            // e.g. "A"
    `- ${lower}`,     // e.g. "- a"
    `- ${upper}`,     // e.g. "- A"
    `-${lower}`,
    `-${upper}`,
    `${lower}-`,
    `${upper}-`,
    `_${lower}`,
    `_${upper}`,
  ];

  if (kana) {
    list.push(kana, `- ${kana}`, `-${kana}`);
  }

  return [...new Set(list)];
}

/**
 * Resolves a lyric in a C+V voicebank using separate consonant and vowel lookup,
 * prioritizing user-configured custom mapping rules.
 */
export function resolveSeparateCV<T = unknown>(
  lyric: string,
  aliasFinder: (alias: string) => T | null,
  options?: {
    preferWholeSyllable?: boolean;
    customRules?: CVMemberRule[];
  }
): CVSplitMatch<T> {
  const preferWhole = options?.preferWholeSyllable ?? true;
  const raw = String(lyric || '').trim();

  // 1. Check custom user-defined mapping rules first!
  const matchedRule = matchCustomCVRule(raw, options?.customRules || []);
  if (matchedRule) {
    const cEntry = aliasFinder(matchedRule.consonant);
    const vEntry = aliasFinder(matchedRule.vowel);
    if (vEntry) {
      return {
        isSplit: Boolean(cEntry),
        consonant: matchedRule.consonant,
        vowel: matchedRule.vowel,
        consonantEntry: cEntry,
        vowelEntry: vEntry,
        compositeAlias: cEntry ? `${matchedRule.consonant}+${matchedRule.vowel}` : matchedRule.vowel,
        ruleMatched: matchedRule,
        leadMs: matchedRule.leadMs || 45,
      };
    }
  }

  // 2. If whole syllable is preferred and found directly, don't split
  if (preferWhole && raw) {
    const direct = aliasFinder(raw);
    if (direct) {
      return {
        isSplit: false,
        consonant: '',
        vowel: raw,
        consonantEntry: null,
        vowelEntry: direct,
        compositeAlias: raw,
      };
    }
  }

  // 3. Fallback to automated Mora split
  const mora = splitMora(lyric);
  const cCands = getConsonantCandidates(mora.consonant);
  const vCands = getVowelCandidates(mora.vowel);

  let cEntry: T | null = null;
  let cAlias = '';
  if (mora.consonant) {
    for (const cand of cCands) {
      const found = aliasFinder(cand);
      if (found) {
        cEntry = found;
        cAlias = cand;
        break;
      }
    }
  }

  let vEntry: T | null = null;
  let vAlias = '';
  for (const cand of vCands) {
    const found = aliasFinder(cand);
    if (found) {
      vEntry = found;
      vAlias = cand;
      break;
    }
  }

  // If no vowel found with primary candidates, try fallback 'a'
  if (!vEntry) {
    for (const cand of ['a', 'A', 'あ']) {
      const found = aliasFinder(cand);
      if (found) {
        vEntry = found;
        vAlias = cand;
        break;
      }
    }
  }

  const isSplit = Boolean(cEntry && vEntry);
  const compositeAlias = isSplit ? `${cAlias}+${vAlias}` : (vAlias || cAlias || raw);

  return {
    isSplit,
    consonant: mora.consonant,
    vowel: mora.vowel,
    consonantEntry: cEntry,
    vowelEntry: vEntry,
    compositeAlias,
  };
}

/**
 * Calculates seamless timing for C+V composite playback.
 * The consonant plays at the onset, crossfading into the sustained vowel.
 */
export function calculateCVSplitTiming(
  rawConsonantDurSec: number,
  noteDurSec: number,
  consonantType: string = ''
): CVSplitTiming {
  const isStop = /^[kptgbd]$/i.test(consonantType);
  const isFricative = /^(s|sh|h|f|z|j)$/i.test(consonantType);

  // Stop consonants (k, p, t) have shorter burst; fricatives (s, sh) have longer noise
  const baseDur = isStop ? 0.055 : isFricative ? 0.095 : 0.075;
  const maxConsonantFraction = 0.35;

  const consonantDurationSec = Math.min(
    Math.max(0.035, rawConsonantDurSec > 0 ? rawConsonantDurSec : baseDur),
    noteDurSec * maxConsonantFraction,
    0.18
  );

  const crossfadeSec = Math.min(0.025, consonantDurationSec * 0.4);
  const consonantLeadSec = consonantDurationSec * 0.55;
  const vowelStartSec = Math.max(0, consonantDurationSec - crossfadeSec);
  const vowelDurationSec = Math.max(0.04, noteDurSec);

  return {
    consonantDurationSec,
    consonantLeadSec,
    vowelStartSec,
    vowelDurationSec,
    crossfadeSec,
  };
}
