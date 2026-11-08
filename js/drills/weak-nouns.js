// n-Deklination: der Kunde → den/dem/des Kunden.
import { nounForms, defArticle, CASE_NAMES } from '../german.js';
import { wordPool, choiceOptions } from './util.js';

const FRAMES = {
  nom: { q: 'Das ist der ___.', en: 'That is the ….' },
  akk: { q: 'Kennst du den ___?', en: 'Do you know the …?' },
  dat: { q: 'Was machst du mit dem ___?', en: 'What are you doing with the …?' },
  gen: { q: 'Ich komme wegen des ___.', en: 'I am coming because of the ….' },
};

export function weakWhy(w, c, form) {
  const base = `**${w.de}** is an n-Deklination noun (masculine, weak): every form except the nominative singular ends in **-(e)n**.`;
  if (c === 'nom') return `${base} Nominativ singular → **der ${form}** (no ending).`;
  let s = `${base} ${CASE_NAMES[c]} → **${defArticle('m', c)} ${form}**.`;
  if (c === 'gen' && /ns$/.test(form)) s += ' A few nouns (Name, Gedanke, Buchstabe, Glaube, Wille) add **-ns** in the genitive.';
  if (w.de === 'Herr') s += ' **Herr** takes **-n** in the singular (Herrn) but **-en** in the plural (Herren).';
  return s;
}

export default {
  id: 'weak-nouns', title: 'n-Deklination', en: 'Weak masculine nouns', detektiv: 'Fall: Das fehlende N', level: 'B1',
  topics: ['b1-n-declension'],
  items(ctx) {
    const out = [];
    for (const w of wordPool(ctx, 'noun', (w) => w.weak && w.g === 'm')) {
      for (const c of ['nom', 'akk', 'dat', 'gen']) out.push({ key: `${w.key || w.de}|${c}`, level: w.lvl < 'B1' ? 'B1' : w.lvl, w, c });
    }
    return out;
  },
  make({ w, c }, ctx, rng) {
    const forms = nounForms(w, c);
    const form = forms[0];
    const why = weakWhy(w, c, form);
    const en = FRAMES[c].en.replace('…', w.en.split(',')[0].trim());
    if (rng.chance(0.4)) {
      const d = /e$/.test(w.de) ? [w.de, w.de + 's', w.de + 'ns', w.de + 'n'] : [w.de, w.de + 'en', w.de + 's', w.de + 'es', w.de + 'ens', ...(/(er|el)$/.test(w.de) ? [w.de + 'n'] : [])];
      return { type: 'choice', q: FRAMES[c].q, ...choiceOptions(form, d.filter((x) => !forms.includes(x)), rng, 4), hint: `(${w.de})`, en, why, d: 2 };
    }
    return { type: 'gap', q: FRAMES[c].q, answers: [forms], hint: `(der ${w.de})`, en, why, d: 2 };
  },
};
