// der / die / das for nouns.
import { DEF_NOM, GENDER_EN, genderHint } from '../german.js';
import { wordPool, fixedOptions, mark } from './util.js';

export function genderWhy(w) {
  const art = DEF_NOM[w.g];
  let why = `${mark(`${art} ${w.de}`)} (${w.en}) is ${GENDER_EN[w.g]}.`;
  const h = genderHint(w);
  if (h && h.g === w.g) why += ' ' + h.rule;
  else if (h) why += ` Careful: an exception — most nouns ending in **-${h.suffix}** are **${DEF_NOM[h.g]}**.`;
  else if (w.pl && w.pl !== '-') why += ` Learn it with the plural: **die ${w.pl}**.`;
  return why;
}

export function genderExercise(w) {
  return {
    type: 'choice', q: `___ ${w.de}`, ...fixedOptions(DEF_NOM[w.g], ['der', 'die', 'das']),
    en: `the ${w.en.split(',')[0].trim()}`, why: genderWhy(w), d: 1, audio: `${DEF_NOM[w.g]} ${w.de}`,
  };
}

export default {
  id: 'gender', title: 'der, die oder das?', en: 'Noun gender', detektiv: 'Fall: Das verschwundene Geschlecht', level: 'A1',
  topics: ['a1-articles-gender'],
  items(ctx) {
    return wordPool(ctx, 'noun', (w) => ['m', 'f', 'n'].includes(w.g)).map((w) => ({ key: w.key || w.de, level: w.lvl, w }));
  },
  make(item) { return genderExercise(item.w); },
};
