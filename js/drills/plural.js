// Plural forms of nouns.
import { DEF_NOM, umlautLast } from '../german.js';
import { wordPool, choiceOptions, mark } from './util.js';

/** Describe how the plural is formed: '-e', 'umlaut + -er', 'no ending', … */
export function pluralPattern(sg, pl) {
  if (pl === sg) return 'no ending (same as the singular)';
  if (pl.startsWith(sg)) return `ending **-${pl.slice(sg.length)}**`;
  const u = umlautLast(sg);
  if (pl === u) return 'umlaut only';
  if (pl.startsWith(u)) return `umlaut + **-${pl.slice(u.length)}**`;
  return 'irregular plural';
}

function tip(w) {
  if (w.g === 'f' && /e?n$/.test(w.pl) && w.pl.startsWith(w.de)) return 'Most feminine nouns form the plural with **-(e)n**.';
  if (/(chen|lein)$/.test(w.de)) return 'Nouns in **-chen/-lein** never change in the plural.';
  if (/(er|el|en)$/.test(w.de) && w.g !== 'f') return 'Masculine/neuter nouns in **-er/-el/-en** add no ending (sometimes an umlaut).';
  if (/s$/.test(w.pl) && w.pl === w.de + 's') return 'Words ending in a vowel (often loanwords: Auto, Handy) take **-s**.';
  return '';
}

export function pluralDistractors(sg) {
  const u = umlautLast(sg);
  const base = /e$/.test(sg) ? [sg + 'n', sg + 's', u + 'n', sg] : [sg + 'e', sg + 'en', sg + 'er', u + 'e', u + 'er', sg + 's', sg, u];
  return base.filter((x) => x !== sg || /(er|el|en|chen|lein)$/.test(sg));
}

export default {
  id: 'plural', title: 'Plural', en: 'Plural forms', detektiv: 'Fall: Die Vervielfältigung', level: 'A1',
  topics: ['a1-plural'],
  items(ctx) {
    return wordPool(ctx, 'noun', (w) => ['m', 'f', 'n'].includes(w.g) && w.pl && w.pl !== '-')
      .map((w) => ({ key: w.key || w.de, level: w.lvl, w }));
  },
  make({ w }, ctx, rng) {
    const why = `${mark(`${DEF_NOM[w.g]} ${w.de} → die ${w.pl}`)}: ${pluralPattern(w.de, w.pl)}. ${tip(w)}`.trim();
    const en = w.en.split(',')[0].trim();
    if (rng.chance(0.4)) {
      return { type: 'choice', q: `${DEF_NOM[w.g]} ${w.de} → die ___`, ...choiceOptions(w.pl, pluralDistractors(w.de), rng, 4), en: `the ${en} → plural`, why, d: 1, audio: `die ${w.pl}` };
    }
    return { type: 'gap', q: `${DEF_NOM[w.g]} ${w.de} → die ___`, answers: [[w.pl]], hint: `(${en}, plural)`, en: `the ${en} → plural`, why, d: 2, audio: `die ${w.pl}` };
  },
};
