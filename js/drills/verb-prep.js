// Verbs with fixed prepositions: warten auf + Akk, denken an + Akk …
import { expandContraction } from '../german.js';
import { wordPool, choiceOptions, fixedOptions } from './util.js';
import { FALLBACK_VERB_PREPS } from './fallback.js';

const ALL_PREPS = ['auf', 'an', 'für', 'über', 'um', 'von', 'mit', 'nach', 'zu', 'vor', 'in', 'bei', 'unter', 'gegen', 'aus'];
const CASE_FULL = { akk: 'Akkusativ', dat: 'Dativ', gen: 'Genitiv' };

/** "auf + Akk / über + Akk" → [{prep:'auf', case:'akk'}, …] */
export function parsePrep(s) {
  const out = [];
  const re = /([a-zäöüß]+)\s*\(?\s*\+\s*(akk|dat|gen)\w*/gi;
  let m;
  while ((m = re.exec(String(s || '')))) out.push({ prep: m[1].toLowerCase(), case: m[2].toLowerCase() });
  return out;
}

/** Find the preposition (or its contraction) in the example sentence → {index, token, answers} */
export function findPrepToken(ex, prep) {
  const toks = String(ex || '').split(' ');
  for (let i = 0; i < toks.length; i++) {
    const bare = toks[i].replace(/[.,!?;:]+$/, '');
    if (bare.toLowerCase() === prep) return { index: i, token: bare, answers: [bare] };
    const exp = expandContraction(bare);
    if (exp && exp[0] === prep) return { index: i, token: bare, answers: [bare, (i === 0 ? exp[0][0].toUpperCase() + exp[0].slice(1) : exp[0]) + ' ' + exp[1]] };
  }
  return null;
}

export default {
  id: 'verb-prep', title: 'Verben mit Präposition', en: 'Verbs with prepositions', detektiv: 'Fall: Die feste Verbindung', level: 'A2',
  topics: ['b1-verbs-with-prepositions', 'b1-da-wo-compounds'],
  items(ctx) {
    let pool = wordPool(ctx, 'verb', (w) => parsePrep(w.prep).length > 0, 0);
    if (pool.length < 8) {
      const have = new Set(pool.map((w) => w.de));
      const lvl = ctx.level || 'B2';
      pool = pool.concat(FALLBACK_VERB_PREPS.filter((w) => !have.has(w.de) && w.lvl <= lvl));
    }
    return pool.map((w) => {
      const preps = parsePrep(w.prep);
      return { key: `${w.de}|${preps[0].prep}`, level: w.lvl < 'A2' ? 'A2' : w.lvl, w, preps };
    });
  },
  make({ w, preps }, ctx, rng) {
    const main = preps[0];
    const label = `${w.de} ${main.prep} + ${CASE_FULL[main.case].slice(0, 3)}`;
    const why = `**${w.de}** is used with **${main.prep} + ${CASE_FULL[main.case]}**${preps.length > 1 ? ` (also: ${preps.slice(1).map((p) => `**${p.prep} + ${CASE_FULL[p.case]}**`).join(', ')})` : ''}. Learn the verb together with its preposition and case.`;
    const tok = findPrepToken(w.ex, main.prep);
    const r = rng.random();
    if (tok && r < 0.6) {
      const toks = w.ex.split(' ');
      toks[tok.index] = toks[tok.index].replace(tok.token, '___');
      return { type: 'gap', q: toks.join(' '), answers: [tok.answers], hint: `(${w.de})`, en: w.exEn, why, d: 2 };
    }
    if (r < 0.85 || !tok) {
      const bad = new Set([...preps.map((p) => p.prep), ...(w.notDistractor || [])]);
      return { type: 'choice', q: `${w.de} ___ … (+ ${CASE_FULL[main.case]})`, ...choiceOptions(main.prep, ALL_PREPS.filter((p) => !bad.has(p)), rng, 4), ...(w.en ? { en: w.en } : {}), why, d: 2 };
    }
    return { type: 'choice', q: `${w.de} ${main.prep} + ___`, ...fixedOptions(CASE_FULL[main.case], ['Akkusativ', 'Dativ']), en: label, why, d: 2 };
  },
};
