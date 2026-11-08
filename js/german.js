// German morphology helpers: articles, adjective endings, noun forms, prepositions, contractions, pronouns.
// Pure functions, no DOM. Cases: 'nom' | 'akk' | 'dat' | 'gen'. Genders: 'm' | 'f' | 'n' | 'pl'.

export const CASES = ['nom', 'akk', 'dat', 'gen'];
export const GENDERS = ['m', 'f', 'n', 'pl'];
export const CASE_NAMES = { nom: 'Nominativ', akk: 'Akkusativ', dat: 'Dativ', gen: 'Genitiv' };
export const CASE_EN = { nom: 'nominative', akk: 'accusative', dat: 'dative', gen: 'genitive' };
export const GENDER_NAMES = { m: 'maskulin', f: 'feminin', n: 'neutral', pl: 'Plural' };
export const GENDER_EN = { m: 'masculine', f: 'feminine', n: 'neuter', pl: 'plural' };
export const DEF_NOM = { m: 'der', f: 'die', n: 'das', pl: 'die' };

// ---------------------------------------------------------------- articles
const DEF = {
  m: { nom: 'der', akk: 'den', dat: 'dem', gen: 'des' },
  f: { nom: 'die', akk: 'die', dat: 'der', gen: 'der' },
  n: { nom: 'das', akk: 'das', dat: 'dem', gen: 'des' },
  pl: { nom: 'die', akk: 'die', dat: 'den', gen: 'der' },
};
// ending added to ein / kein / possessive stems
const EIN_END = {
  m: { nom: '', akk: 'en', dat: 'em', gen: 'es' },
  f: { nom: 'e', akk: 'e', dat: 'er', gen: 'er' },
  n: { nom: '', akk: '', dat: 'em', gen: 'es' },
  pl: { nom: 'e', akk: 'e', dat: 'en', gen: 'er' },
};
// ending added to der-words (dies-, jen-, jed-, welch-, manch-, solch-, all-)
const DER_END = {
  m: { nom: 'er', akk: 'en', dat: 'em', gen: 'es' },
  f: { nom: 'e', akk: 'e', dat: 'er', gen: 'er' },
  n: { nom: 'es', akk: 'es', dat: 'em', gen: 'es' },
  pl: { nom: 'e', akk: 'e', dat: 'en', gen: 'er' },
};

export const POSSESSIVES = ['mein', 'dein', 'sein', 'ihr', 'unser', 'euer', 'Ihr'];
export const POSSESSIVE_OWNER = { mein: 'ich', dein: 'du', sein: 'er/es', ihr: 'sie', unser: 'wir', euer: 'ihr', Ihr: 'Sie' };
export const POSSESSIVE_EN = { mein: 'my', dein: 'your', sein: 'his/its', ihr: 'her/their', unser: 'our', euer: 'your (pl.)', Ihr: 'your (formal)' };
export const DER_WORDS = ['dies', 'jen', 'jed', 'welch', 'manch', 'solch'];

function attach(stem, ending) {
  if (!ending) return stem;
  if (stem === 'euer' || stem === 'Euer') return stem.slice(0, 2) + 'r' + ending; // eure, euren …
  return stem + ending;
}

/** Definite article. */
export function defArticle(g, c) { return DEF[g][c]; }
/** Indefinite article (null in the plural — there is none). */
export function indefArticle(g, c) { return g === 'pl' ? null : attach('ein', EIN_END[g][c]); }
export function keinArticle(g, c) { return attach('kein', EIN_END[g][c]); }
export function possArticle(stem, g, c) { return attach(stem, EIN_END[g][c]); }
/** der-word: derWord('dies','m','nom') → 'dieser'. */
export function derWord(stem, g, c) { return stem + DER_END[g][c]; }

/**
 * Generic determiner. type: 'def' | 'indef' | 'kein' | 'poss' | 'dies' (any der-word) | 'none'.
 * opts.poss = possessive stem ('mein' …), opts.stem = der-word stem ('dies' …).
 * Returns '' for 'none', null if the combination doesn't exist (ein + plural).
 */
export function article(type, g, c, opts = {}) {
  switch (type) {
    case 'def': return defArticle(g, c);
    case 'indef': return indefArticle(g, c);
    case 'kein': return keinArticle(g, c);
    case 'poss': return possArticle(opts.poss || 'mein', g, c);
    case 'dies': return derWord(opts.stem || 'dies', g, c);
    case 'none': return '';
    default: throw new Error(`unknown article type ${type}`);
  }
}

/** Full table {m:{nom..gen}, f, n, pl} for an article type. */
export function articleTable(type, opts) {
  const t = {};
  for (const g of GENDERS) { t[g] = {}; for (const c of CASES) t[g][c] = article(type, g, c, opts); }
  return t;
}

// ---------------------------------------------------------------- adjective endings
export const ADJ_ENDINGS = {
  weak: {
    m: { nom: 'e', akk: 'en', dat: 'en', gen: 'en' },
    f: { nom: 'e', akk: 'e', dat: 'en', gen: 'en' },
    n: { nom: 'e', akk: 'e', dat: 'en', gen: 'en' },
    pl: { nom: 'en', akk: 'en', dat: 'en', gen: 'en' },
  },
  mixed: {
    m: { nom: 'er', akk: 'en', dat: 'en', gen: 'en' },
    f: { nom: 'e', akk: 'e', dat: 'en', gen: 'en' },
    n: { nom: 'es', akk: 'es', dat: 'en', gen: 'en' },
    pl: { nom: 'en', akk: 'en', dat: 'en', gen: 'en' }, // keine / meine guten Freunde
  },
  strong: {
    m: { nom: 'er', akk: 'en', dat: 'em', gen: 'en' },
    f: { nom: 'e', akk: 'e', dat: 'er', gen: 'er' },
    n: { nom: 'es', akk: 'es', dat: 'em', gen: 'en' },
    pl: { nom: 'e', akk: 'e', dat: 'en', gen: 'er' },
  },
};

/** Which declension pattern an article type triggers. */
export function declensionFor(type, g) {
  if (type === 'def' || type === 'dies') return 'weak';
  if (type === 'kein' || type === 'poss') return 'mixed';
  if (type === 'indef') return g === 'pl' ? 'strong' : 'mixed'; // plural of "ein" = no article
  return 'strong';
}

export function adjEnding(type, g, c) { return ADJ_ENDINGS[declensionFor(type, g)][g][c]; }

const INDECLINABLE = new Set(['lila', 'rosa', 'prima', 'klasse', 'super', 'orange', 'beige', 'extra', 'pink', 'online', 'live']);

export function isIndeclinable(adj) {
  return INDECLINABLE.has(adj) || /^[A-ZÄÖÜ].*er$/.test(adj); // Frankfurter Würstchen, Berliner Mauer
}

/** Stem used before endings: hoch→hoh, dunkel→dunkl, teuer→teur, leise→leis. */
export function adjStem(adj) {
  if (adj === 'hoch') return 'hoh';
  if (/el$/.test(adj) && adj.length > 3) return adj.slice(0, -2) + 'l';
  if (/(au|eu|äu)er$/.test(adj)) return adj.slice(0, -2) + 'r';
  if (/e$/.test(adj)) return adj.slice(0, -1);
  return adj;
}

/** Inflect an adjective (positive or comparative) with an ending ('e','en','er','es','em'). */
export function declineAdj(adj, ending) {
  if (isIndeclinable(adj)) return adj;
  if (!ending) return adj;
  // comparatives in -er (größer, teurer, dunkler) just add the ending
  return adjStem(adj) + ending;
}

// ---------------------------------------------------------------- nouns
const VOWELS = /[aeiouäöüy]+/gi;
export function syllables(word) { return (word.toLowerCase().match(VOWELS) || []).length; }

const WEAK_NS = new Set(['Name', 'Gedanke', 'Buchstabe', 'Glaube', 'Wille', 'Friede', 'Funke', 'Same', 'Haufe']);

/** Expand "Tisch(e)s" → ["Tisches","Tischs"] (long form first). */
export function expandOptional(s) {
  const m = /^(.*)\(([^)]*)\)(.*)$/.exec(s);
  if (!m) return [s];
  return [m[1] + m[2] + m[3], m[1] + m[3]];
}

/** Akk/Dat singular of a weak (n-Deklination) noun: Kunde→Kunden, Herr→Herrn, Name→Namen. */
export function weakOblique(word) {
  if (word.gen) {
    const gen = expandOptional(word.gen)[0];
    if (/ns$/.test(gen) && WEAK_NS.has(word.de)) return gen.slice(0, -1); // Namens → Namen
    if (/n$/.test(gen)) return gen;
  }
  if (word.de === 'Herr') return 'Herrn';
  if (word.de === 'Bauer' || word.de === 'Nachbar') return word.de + 'n';
  if (word.pl && (word.pl === word.de + 'n' || word.pl === word.de + 'en')) return word.pl;
  if (/e$/.test(word.de) || /(er|el)$/.test(word.de)) return word.de + 'n';
  return word.de + 'en';
}

/**
 * Genitive singular forms (preferred first). Uses explicit `gen` when present.
 * Feminine nouns are unchanged; plural-only nouns return [].
 */
export function genitiveSg(word) {
  const { de, g } = word;
  if (g === 'pl') return [];
  if (g === 'f') return [de];
  if (word.gen) return expandOptional(word.gen);
  if (word.weak) {
    if (WEAK_NS.has(de)) return [de + 'ns'];
    return [weakOblique(word)];
  }
  if (/nis$/.test(de)) return [de + 'ses'];
  if (/(s|ß|x|z|tz|sch)$/.test(de)) return [de + 'es'];
  if (/[aeiouäöüy]$/i.test(de) || syllables(de) > 1) return [de + 's'];
  return [de + 'es', de + 's']; // monosyllabic: des Tages / des Tags
}

/** Dative plural: add -n unless the plural already ends in -n or -s. */
export function dativePlural(pl) {
  if (!pl || pl === '-') return null;
  return /[ns]$/.test(pl) ? pl : pl + 'n';
}

/**
 * Noun form for a case. number 'sg' | 'pl'. Plural-only nouns (g:'pl') use `de` as the plural.
 * Returns an array of accepted forms (preferred first) or [] if impossible (no plural).
 */
export function nounForms(word, c, number = 'sg') {
  if (word.g === 'pl' || number === 'pl') {
    const pl = word.g === 'pl' ? word.de : word.pl;
    if (!pl || pl === '-') return [];
    return [c === 'dat' ? dativePlural(pl) : pl];
  }
  if (c === 'gen') return genitiveSg(word);
  if (word.weak && word.g === 'm' && c !== 'nom') return [weakOblique(word)];
  return [word.de];
}
export function nounForm(word, c, number = 'sg') { return nounForms(word, c, number)[0] || null; }

/** Effective gender used for article choice (plural forms use 'pl'). */
export function effGender(word, number = 'sg') { return word.g === 'pl' || number === 'pl' ? 'pl' : word.g; }

/**
 * Build a noun phrase: nounPhrase({type:'def', g, c, adj:'gut', word, number}) → 'dem guten Tisch'.
 * Returns null when the combination doesn't exist (e.g. ein + plural, uncountable plural).
 */
export function nounPhrase({ type = 'def', c = 'nom', adj = null, word, number = 'sg', poss, stem }) {
  const g = effGender(word, number);
  const art = article(type, g, c, { poss, stem });
  if (art === null) return null;
  const nf = nounForm(word, c, g === 'pl' ? 'pl' : 'sg');
  if (!nf) return null;
  const parts = [];
  if (art) parts.push(art);
  if (adj) parts.push(declineAdj(adj, adjEnding(type, g, c)));
  parts.push(nf);
  return parts.join(' ');
}

/** Noun gender heuristics from the ending. Returns {g, suffix, rule, reliable} or null. */
const GENDER_RULES = [
  ['ung', 'f', true], ['heit', 'f', true], ['keit', 'f', true], ['schaft', 'f', true], ['ion', 'f', true],
  ['tät', 'f', true], ['ei', 'f', false], ['ik', 'f', false], ['enz', 'f', true], ['anz', 'f', true],
  ['ur', 'f', false], ['ie', 'f', false], ['ette', 'f', true],
  ['chen', 'n', true], ['lein', 'n', true], ['ment', 'n', false], ['um', 'n', false], ['tum', 'n', false],
  ['ling', 'm', true], ['ismus', 'm', true], ['ist', 'm', false], ['or', 'm', false], ['ant', 'm', false], ['ig', 'm', true], ['ich', 'm', false],
];
export function genderHint(noun) {
  const de = typeof noun === 'string' ? noun : noun.de;
  let best = null;
  for (const [suf, g, reliable] of GENDER_RULES) {
    if (de.length > suf.length + 1 && de.endsWith(suf) && (!best || suf.length > best.suffix.length)) best = { g, suffix: suf, reliable };
  }
  if (!best) return null;
  const art = DEF_NOM[best.g];
  best.rule = `Nouns ending in **-${best.suffix}** are ${best.reliable ? 'almost always' : 'usually'} ${GENDER_EN[best.g]} (**${art}**).`;
  return best;
}

// ---------------------------------------------------------------- umlaut helpers
const UML = { a: 'ä', o: 'ö', u: 'ü', A: 'Ä', O: 'Ö', U: 'Ü' };
/** Umlaut the last stem vowel (au→äu): Haus→Häus, Buch→Büch. */
export function umlautLast(word) {
  const m = /(au|Au|a|o|(?<![eEäÄ])u|A|O|U)([^aeiouäöüAEIOUÄÖÜ]*(?:e[lnr]?)?)$/.exec(word);
  if (!m) return word;
  const v = m[1].length === 2 ? m[1][0] === 'A' ? 'Äu' : 'äu' : UML[m[1]];
  return word.slice(0, m.index) + v + m[2];
}

// ---------------------------------------------------------------- prepositions
export const PREPOSITIONS = {
  // Akkusativ
  durch: { case: 'akk', en: 'through' }, für: { case: 'akk', en: 'for' }, gegen: { case: 'akk', en: 'against' },
  ohne: { case: 'akk', en: 'without' }, um: { case: 'akk', en: 'around, at (time)' }, bis: { case: 'akk', en: 'until' },
  entlang: { case: 'akk', en: 'along (after the noun)' },
  // Dativ
  aus: { case: 'dat', en: 'out of, from' }, bei: { case: 'dat', en: 'at, near, with' }, mit: { case: 'dat', en: 'with' },
  nach: { case: 'dat', en: 'after, to' }, seit: { case: 'dat', en: 'since, for' }, von: { case: 'dat', en: 'from, of' },
  zu: { case: 'dat', en: 'to' }, gegenüber: { case: 'dat', en: 'opposite' }, ab: { case: 'dat', en: 'from (on)' },
  außer: { case: 'dat', en: 'except' },
  // Wechselpräpositionen
  an: { case: 'wechsel', en: 'at, on (vertical)' }, auf: { case: 'wechsel', en: 'on (top)' }, hinter: { case: 'wechsel', en: 'behind' },
  in: { case: 'wechsel', en: 'in, into' }, neben: { case: 'wechsel', en: 'next to' }, über: { case: 'wechsel', en: 'over, above' },
  unter: { case: 'wechsel', en: 'under' }, vor: { case: 'wechsel', en: 'in front of, before' }, zwischen: { case: 'wechsel', en: 'between' },
  // Genitiv
  während: { case: 'gen', en: 'during' }, wegen: { case: 'gen', en: 'because of' }, trotz: { case: 'gen', en: 'despite' },
  statt: { case: 'gen', en: 'instead of' }, anstatt: { case: 'gen', en: 'instead of' }, innerhalb: { case: 'gen', en: 'within' },
  außerhalb: { case: 'gen', en: 'outside of' }, aufgrund: { case: 'gen', en: 'due to' }, infolge: { case: 'gen', en: 'as a result of' },
  angesichts: { case: 'gen', en: 'in view of' }, oberhalb: { case: 'gen', en: 'above' }, unterhalb: { case: 'gen', en: 'below' },
  diesseits: { case: 'gen', en: 'on this side of' }, jenseits: { case: 'gen', en: 'beyond' }, mithilfe: { case: 'gen', en: 'with the help of' },
  bezüglich: { case: 'gen', en: 'regarding' }, hinsichtlich: { case: 'gen', en: 'with regard to' }, anlässlich: { case: 'gen', en: 'on the occasion of' },
};
export const PREP_GROUPS = {
  akk: ['durch', 'für', 'gegen', 'ohne', 'um', 'bis', 'entlang'],
  dat: ['aus', 'bei', 'mit', 'nach', 'seit', 'von', 'zu', 'gegenüber', 'ab', 'außer'],
  wechsel: ['an', 'auf', 'hinter', 'in', 'neben', 'über', 'unter', 'vor', 'zwischen'],
  gen: ['während', 'wegen', 'trotz', 'statt', 'anstatt', 'innerhalb', 'außerhalb', 'aufgrund', 'infolge', 'angesichts', 'oberhalb', 'unterhalb', 'diesseits', 'jenseits', 'mithilfe', 'bezüglich', 'hinsichtlich', 'anlässlich'],
};
/** 'akk' | 'dat' | 'gen' | 'wechsel' | null */
export function prepCase(p) { return PREPOSITIONS[p] ? PREPOSITIONS[p].case : null; }
/** Concrete case for a preposition; Wechselpräpositionen need motion: 'wo' (Dat) | 'wohin' (Akk). */
export function governedCase(p, motion = 'wo') {
  const c = prepCase(p);
  if (c === 'wechsel') return motion === 'wohin' ? 'akk' : 'dat';
  return c;
}

// ---------------------------------------------------------------- contractions
export const CONTRACTIONS = { 'an dem': 'am', 'in dem': 'im', 'zu dem': 'zum', 'zu der': 'zur', 'in das': 'ins', 'an das': 'ans', 'bei dem': 'beim', 'von dem': 'vom' };
export const CONTRACTIONS_COLLOQUIAL = { 'auf das': 'aufs', 'für das': 'fürs', 'durch das': 'durchs', 'um das': 'ums', 'über das': 'übers', 'unter das': 'unters', 'vor das': 'vors', 'hinter das': 'hinters' };
/** contract('in','dem') → 'im'; null if no standard contraction. */
export function contract(prep, art, { colloquial = false } = {}) {
  const k = `${prep} ${art}`;
  return CONTRACTIONS[k] || (colloquial && CONTRACTIONS_COLLOQUIAL[k]) || null;
}
/** expand('im') → ['in','dem'] */
export function expandContraction(word) {
  for (const [k, v] of Object.entries({ ...CONTRACTIONS, ...CONTRACTIONS_COLLOQUIAL })) if (v === word.toLowerCase()) return k.split(' ');
  return null;
}

// ---------------------------------------------------------------- pronouns
export const PERSONS = ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'];
export const PERSON_SUBJ = ['ich', 'du', 'er', 'wir', 'ihr', 'sie'];
export const PRONOUNS = {
  nom: { ich: 'ich', du: 'du', er: 'er', sie: 'sie', es: 'es', wir: 'wir', ihr: 'ihr', siePl: 'sie', Sie: 'Sie' },
  akk: { ich: 'mich', du: 'dich', er: 'ihn', sie: 'sie', es: 'es', wir: 'uns', ihr: 'euch', siePl: 'sie', Sie: 'Sie' },
  dat: { ich: 'mir', du: 'dir', er: 'ihm', sie: 'ihr', es: 'ihm', wir: 'uns', ihr: 'euch', siePl: 'ihnen', Sie: 'Ihnen' },
};
/** Reflexive pronouns by person index 0..5 (ich..sie). */
export const REFLEXIVE = { akk: ['mich', 'dich', 'sich', 'uns', 'euch', 'sich'], dat: ['mir', 'dir', 'sich', 'uns', 'euch', 'sich'] };

// ---------------------------------------------------------------- auxiliaries
export const HABEN = { pres: ['habe', 'hast', 'hat', 'haben', 'habt', 'haben'], prt: ['hatte', 'hattest', 'hatte', 'hatten', 'hattet', 'hatten'] };
export const SEIN = { pres: ['bin', 'bist', 'ist', 'sind', 'seid', 'sind'], prt: ['war', 'warst', 'war', 'waren', 'wart', 'waren'] };
export const WERDEN = { pres: ['werde', 'wirst', 'wird', 'werden', 'werdet', 'werden'], k2: ['würde', 'würdest', 'würde', 'würden', 'würdet', 'würden'] };
export function auxForm(aux, person, tense = 'pres') { return (aux === 'sein' ? SEIN : HABEN)[tense][person]; }

export const LEVELS = ['A1', 'A2', 'B1', 'B2'];
export function levelIdx(l) { const i = LEVELS.indexOf(l); return i < 0 ? LEVELS.length : i; }
export function levelLE(a, b) { return levelIdx(a) <= levelIdx(b); }
