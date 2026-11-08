// Article form by case: der/den/dem/des, ein/einen/einem/eines, kein…, mein….
import { article, articleTable, nounForm, effGender, CASE_NAMES, GENDER_EN, POSSESSIVES, POSSESSIVE_OWNER, POSSESSIVE_EN, DEF_NOM } from '../german.js';
import { wordPool, choiceOptions, mark, cap, fixEn, concreteNoun } from './util.js';

// Frames work with any concrete noun. {NP} = article + noun.
export const CASE_FRAMES = {
  nom: { sg: 'Das ist {NP}.', pl: 'Das sind {NP}.', en: 'That is …', enPl: 'Those are …', why: 'After **sein** (Das ist …) the noun is in the **Nominativ**.' },
  akk: { sg: 'Ich sehe {NP}.', pl: 'Ich sehe {NP}.', en: 'I see …', why: '**sehen** takes a direct object → **Akkusativ**.' },
  dat: { sg: 'Was machst du mit {NP}?', pl: 'Was machst du mit {NP}?', en: 'What are you doing with …?', why: '**mit** always takes the **Dativ**.' },
  gen: { sg: 'Ich komme wegen {NP}.', pl: 'Ich komme wegen {NP}.', en: 'I am coming because of …', why: '**wegen** takes the **Genitiv** (in writing).' },
};
const TYPES = { def: 'A1', indef: 'A1', kein: 'A1', poss: 'A1' };
const CASE_LEVEL = { nom: 'A1', akk: 'A1', dat: 'A2', gen: 'B1' };
const TYPE_LABEL = { def: 'bestimmter Artikel', indef: 'unbestimmter Artikel', kein: 'kein', poss: 'Possessivartikel' };
const maxLevel = (a, b) => (a > b ? a : b);

export function articleWhy(type, g, c, art, noun, poss) {
  let why = `${CASE_FRAMES[c].why} ${cap(GENDER_EN[g])} ${CASE_NAMES[c]} → ${mark(art)}.`;
  if (c === 'dat' && g === 'pl') why += ' Dative plural: the noun also takes **-n** (unless it ends in -n/-s).';
  if (c === 'gen' && (g === 'm' || g === 'n')) why += ` Masculine/neuter nouns add **-(e)s** in the genitive: ${mark(noun)}.`;
  if (type === 'poss') why += ` (**${poss}** = ${POSSESSIVE_OWNER[poss]}; it takes the same endings as **kein**.)`;
  return why;
}

export default {
  id: 'case-articles', title: 'Artikel im Kasus', en: 'Articles by case', detektiv: 'Fall: Der Artikel-Code', level: 'A1',
  topics: ['a1-accusative', 'a2-dative', 'b1-genitive', 'a1-possessives', 'a1-negation'],
  items(ctx) {
    const nouns = wordPool(ctx, 'noun', (w) => concreteNoun(w) && !w.mass);
    const out = [];
    for (const type of Object.keys(TYPES)) for (const g of ['m', 'f', 'n', 'pl']) for (const c of ['nom', 'akk', 'dat', 'gen']) {
      if (type === 'indef' && g === 'pl') continue;
      if (type === 'kein' && (c === 'dat' || c === 'gen')) continue;
      const pool = nouns.filter((w) => (g === 'pl' ? w.pl && w.pl !== '-' : w.g === g && !(type === 'indef' && w.pl === '-')));
      if (!pool.length) continue;
      out.push({ key: `${type}|${g}|${c}`, level: maxLevel(TYPES[type], CASE_LEVEL[c]), type, g, c, pool });
    }
    return out;
  },
  make({ type, g, c, pool }, ctx, rng) {
    const w = rng.pick(pool);
    const number = g === 'pl' ? 'pl' : 'sg';
    const poss = type === 'poss' ? rng.pick(POSSESSIVES) : undefined;
    const art = article(type, g, c, { poss });
    const noun = nounForm(w, c, number);
    const frame = CASE_FRAMES[c][number];
    const q = frame.replace('{NP}', `___ ${noun}`);
    const base = article(type, g, 'nom', { poss }) || '';
    const nomNoun = nounForm(w, 'nom', number);
    const why = articleWhy(type, g, c, art, `${art} ${noun}`, poss);
    const gloss = w.en.split(',')[0].trim() + (number === 'pl' && w.g !== 'pl' ? ' (pl.)' : '');
    const artEn = { def: 'the', indef: 'a', kein: 'no', poss: POSSESSIVE_EN[poss] }[type];
    let en = ((number === 'pl' && CASE_FRAMES[c].enPl) || CASE_FRAMES[c].en).replace('…', `${artEn} ${gloss}`);
    const hint = `(${base} ${nomNoun} · ${TYPE_LABEL[type]})`;
    en = fixEn(en);
    if (rng.chance(0.5)) {
      const forms = Object.values(articleTable(type, { poss })[g]).filter(Boolean);
      const others = ['m', 'f', 'n', 'pl'].map((gg) => article(type, gg, c, { poss })).filter(Boolean);
      const opts = choiceOptions(art, [...forms, ...others, type === 'def' ? DEF_NOM[effGender(w, number)] : null], rng, 4);
      return { type: 'choice', q, ...opts, hint, en, why, d: c === 'gen' ? 2 : 1 };
    }
    return { type: 'gap', q, answers: [[art]], hint, en, why, d: c === 'gen' ? 3 : 2 };
  },
};
