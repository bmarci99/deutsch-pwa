// Adjective endings: article type × gender × case (weak / mixed / strong declension).
import { article, adjEnding, declineAdj, declensionFor, nounForm, CASE_NAMES, GENDER_EN, POSSESSIVES, POSSESSIVE_EN, isIndeclinable } from '../german.js';
import { FALLBACK_WORDS } from './fallback.js';
import { wordPool, fixedOptions, mark, cap, fixEn, concreteNoun, MASS_NOUNS } from './util.js';

// Adjectives used by the drill. UNIVERSAL ones fit any countable noun; the others only the listed nouns,
// so the generated phrases stay natural (no "hohes Kind").
export const UNIVERSAL_ADJ = ['neu', 'alt', 'groß', 'klein', 'schön', 'gut'];
const THINGS = ['Tisch', 'Stuhl', 'Lampe', 'Haus', 'Wohnung', 'Zimmer', 'Auto', 'Computer', 'Handy', 'Tasche', 'Wein', 'Buch', 'Fahrrad', 'Jacke', 'Uhr', 'Kleid', 'Hotel', 'Restaurant', 'Schrank', 'Sofa', 'Bett', 'Mantel', 'Schuh', 'Ticket', 'Brot'];
const DRINKS = ['Kaffee', 'Tee', 'Wein', 'Wasser', 'Milch', 'Bier', 'Suppe'];
export const ADJ_NOUNS = {
  teuer: THINGS, billig: THINGS,
  hoch: ['Haus', 'Zimmer', 'Fenster', 'Tür', 'Tisch', 'Stuhl', 'Miete', 'Preis', 'Berg', 'Turm', 'Baum'],
  dunkel: ['Zimmer', 'Wohnung', 'Haus', 'Brot', 'Bier', 'Wein', 'Jacke', 'Mantel', 'Straße', 'Nacht', 'Farbe'],
  kalt: [...DRINKS, 'Zimmer', 'Wohnung', 'Winter', 'Nacht', 'Tag'],
  warm: [...DRINKS, 'Brot', 'Zimmer', 'Wohnung', 'Jacke', 'Mantel', 'Tag', 'Sommer'],
  interessant: ['Buch', 'Zeitung', 'Film', 'Stadt', 'Musik', 'Idee', 'Frage', 'Artikel', 'Job', 'Arbeit', 'Gespräch', 'Kurs'],
};
export const SAFE_ADJ = [...UNIVERSAL_ADJ, ...Object.keys(ADJ_NOUNS)];
/** Does adjective `a` combine naturally with noun `w`? */
export function adjFits(a, w) {
  if (ADJ_NOUNS[a]) return ADJ_NOUNS[a].includes(w.de);
  if (!UNIVERSAL_ADJ.includes(a)) return false;
  if (w.mass || w.pl === '-' || MASS_NOUNS.has(w.de)) return a === 'gut' || (w.de === 'Musik' && (a === 'neu' || a === 'alt'));
  return true;
}

const FRAMES = {
  nom: { sg: 'Hier ist {NP}.', pl: 'Hier sind {NP}.', en: 'Here is …', enPl: 'Here are …' },
  akk: { sg: 'Ich sehe {NP}.', pl: 'Ich sehe {NP}.', en: 'I see …' },
  dat: { sg: 'Sie kommt mit {NP}.', pl: 'Sie kommt mit {NP}.', en: 'She is coming with …' },
  gen: { sg: 'Ich komme wegen {NP}.', pl: 'Ich komme wegen {NP}.', en: 'I am coming because of …' },
};
const TYPE_LEVEL = { def: 'A2', indef: 'A2', kein: 'A2', poss: 'A2', none: 'B1' };
const CASE_LEVEL = { nom: 'A2', akk: 'A2', dat: 'A2', gen: 'B1' };
const TYPE_LABEL = { def: 'after der/die/das', indef: 'after ein/eine', kein: 'after kein', poss: 'after a possessive', none: 'without an article' };

export function adjWhy(type, g, c, art, ending, phrase) {
  const decl = declensionFor(type, g);
  const head = `${cap(GENDER_EN[g])} ${CASE_NAMES[c]} ${TYPE_LABEL[type]}: ${mark(phrase)}.`;
  if (decl === 'weak') {
    return `${head} The article **${art}** already shows case and gender, so the adjective takes the weak ending: **-e** in nominative singular and feminine/neuter accusative, otherwise **-en**.`;
  }
  if (decl === 'mixed') {
    if (ending === 'er' || ending === 'es') return `${head} **${art}** has no ending here, so the adjective must show the gender: **-${ending}** (compare **${article('def', g, c)}**).`;
    if (g === 'pl') return `${head} After **kein-/mein-** in the plural every adjective ends in **-en**.`;
    return `${head} **${art}** already shows the case, so the adjective gets the weak ending **-${ending}**.`;
  }
  if (c === 'gen' && (g === 'm' || g === 'n')) return `${head} No article → strong ending, but in the masculine/neuter genitive the noun's **-(e)s** already marks the case, so the adjective takes **-en**.`;
  return `${head} No article → the adjective takes the strong ending, i.e. the ending of the definite article (**${article('def', g, c)}** → **-${ending}**).`;
}

export default {
  id: 'adj-endings', title: 'Adjektivendungen', en: 'Adjective endings', detektiv: 'Fall: Die verräterische Endung', level: 'A2',
  topics: ['a2-adjective-endings-definite', 'a2-adjective-endings-indefinite', 'b1-adjective-endings-zero'],
  items(ctx) {
    const nouns = wordPool(ctx, 'noun', (w) => concreteNoun(w) || MASS_NOUNS.has(w.de));
    const vocabAdj = wordPool(ctx, 'adj', (w) => SAFE_ADJ.includes(w.de) && !isIndeclinable(w.de));
    const adjs = vocabAdj.length ? vocabAdj : SAFE_ADJ.map((de) => FALLBACK_WORDS.find((w) => w.de === de && w.pos === 'adj') || { de, en: de });
    const out = [];
    for (const type of ['def', 'indef', 'kein', 'poss', 'none']) for (const g of ['m', 'f', 'n', 'pl']) for (const c of ['nom', 'akk', 'dat', 'gen']) {
      if (type === 'indef' && g === 'pl') continue;
      if (type === 'kein' && (c === 'dat' || c === 'gen')) continue;
      let pool;
      if (g === 'pl') pool = nouns.filter((w) => w.pl && w.pl !== '-' && !w.mass && !MASS_NOUNS.has(w.de));
      else if (type === 'none') pool = nouns.filter((w) => w.g === g && (w.mass || MASS_NOUNS.has(w.de)));
      else pool = nouns.filter((w) => w.g === g && !(type === 'indef' && (w.pl === '-' || MASS_NOUNS.has(w.de))));
      if (!pool.length) continue;
      const level = TYPE_LEVEL[type] > CASE_LEVEL[c] ? TYPE_LEVEL[type] : CASE_LEVEL[c];
      out.push({ key: `${type}|${g}|${c}`, level, type, g, c, pool, adjs });
    }
    return out;
  },
  make({ type, g, c, pool, adjs }, ctx, rng) {
    const w = rng.pick(pool);
    const fits = adjs.filter((x) => adjFits(x.de, w));
    const aw = fits.length ? rng.pick(fits) : { de: 'gut', en: 'good' };
    const adj = aw.de;
    const number = g === 'pl' ? 'pl' : 'sg';
    const poss = type === 'poss' ? rng.pick(POSSESSIVES.filter((p) => p !== 'Ihr')) : undefined;
    const art = article(type, g, c, { poss });
    const ending = adjEnding(type, g, c);
    const form = declineAdj(adj, ending);
    const noun = nounForm(w, c, number);
    const pre = art ? `${art} ` : '';
    const q = FRAMES[c][number].replace('{NP}', `${pre}___ ${noun}`);
    const phrase = `${pre}${form} ${noun}`;
    const artEn = { def: 'the', indef: 'a', kein: 'no', poss: POSSESSIVE_EN[poss], none: '' }[type];
    const gloss = w.en.split(',')[0].trim() + (number === 'pl' && w.g !== 'pl' ? ' (pl.)' : '');
    const en = ((number === 'pl' && FRAMES[c].enPl) || FRAMES[c].en).replace('…', `${artEn} ${aw.en.split(',')[0].trim()} ${gloss}`.trim());
    const why = adjWhy(type, g, c, art, ending, phrase);
    const hint = `(${adj})`;
    if (rng.chance(0.4)) {
      const all = ['e', 'en', 'er', 'es', 'em'].map((e) => declineAdj(adj, e));
      return { type: 'choice', q, ...fixedOptions(form, all), hint, en: fixEn(en), why, d: type === 'none' ? 3 : 2 };
    }
    return { type: 'gap', q, answers: [[form]], hint, en: fixEn(en), why, d: type === 'none' || c === 'gen' ? 3 : 2 };
  },
};
