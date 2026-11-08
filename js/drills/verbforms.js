// Verb form helpers shared by the conjugation and perfekt drills.
import { HABEN, SEIN, WERDEN, REFLEXIVE } from '../german.js';

export const PERSON_LABELS = ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'];
export const PERSON_Q = ['ich', 'du', 'er', 'wir', 'ihr', 'sie'];
export const TENSES = {
  pres: { name: 'Präsens', en: 'present', level: 'A1' },
  perf: { name: 'Perfekt', en: 'present perfect', level: 'A2' },
  prt: { name: 'Präteritum', en: 'simple past', level: 'B1' },
  fut: { name: 'Futur I', en: 'future', level: 'A2' },
  k2: { name: 'Konjunktiv II', en: 'subjunctive II', level: 'B1' },
  imp: { name: 'Imperativ', en: 'imperative', level: 'A1' },
};
export const IMP_LABELS = ['du', 'ihr', 'Sie'];

const reflOf = (v) => (v.refl === 'akk' || v.refl === 'dat' ? v.refl : null);

/** Insert the reflexive pronoun after the finite verb: 'freue' → 'freue mich', 'ziehe an' → 'ziehe mich an'. */
export function withReflexive(form, v, person) {
  const r = reflOf(v);
  if (!r) return form;
  const pron = REFLEXIVE[r][person];
  const parts = form.split(' ');
  if (parts.includes(pron)) return form;
  return [parts[0], pron, ...parts.slice(1)].join(' ');
}

/** Aux choices for Perfekt: ['sein'] | ['haben'] | ['haben','sein'] */
export const auxList = (aux) => (aux === 'haben/sein' ? ['haben', 'sein'] : [aux || 'haben']);

/**
 * All accepted forms for verb × tense × person (person 0..5; imp: 0..2). First = canonical.
 */
export function verbForms(v, tense, person) {
  const infFull = v.inf;
  let forms = [];
  if (tense === 'pres' || tense === 'prt') forms = [v[tense][person]];
  else if (tense === 'perf') forms = auxList(v.aux).map((a) => `${(a === 'sein' ? SEIN : HABEN).pres[person]} ${v.pp}`);
  else if (tense === 'fut') forms = [`${WERDEN.pres[person]} ${infFull}`];
  else if (tense === 'k2') {
    forms = [v.k2[person]];
    if (!['aux', 'modal'].includes(v.type)) {
      forms.push(`${WERDEN.k2[person]} ${infFull}`);
      if (!commonK2(v)) forms.reverse(); // würde + infinitive is the normal form
    }
  } else if (tense === 'imp') return [v.imp[person]];
  return [...new Set(forms.map((f) => withReflexive(f, v, person)))];
}

// Strong/mixed verbs whose real Konjunktiv II is still common in everyday German (käme, ginge, wüsste …).
const COMMON_K2 = ['kommen', 'gehen', 'geben', 'wissen', 'bleiben', 'lassen', 'halten', 'finden', 'liegen', 'sitzen', 'stehen', 'tun', 'brauchen', 'werden'];
export function commonK2(v) { return ['aux', 'modal'].includes(v.type) || COMMON_K2.some((b) => v.inf === b || (v.inf.endsWith(b) && v.inf.length > b.length + 1)); }

export function tenseAvailable(v, tense) {
  if (tense === 'imp') return v.type !== 'modal' && Array.isArray(v.imp) && v.imp.length === 3 && !reflOf(v);
  if (tense === 'k2' || tense === 'prt' || tense === 'pres') return Array.isArray(v[tense]) && v[tense].length === 6;
  return !!v.pp || tense === 'fut';
}

/** Level of a verb × tense: Präteritum/K-II of sein/haben/modals is A2, other verbs B1. */
export function tenseLevel(v, tense) {
  if ((tense === 'prt' || tense === 'k2') && ['aux', 'modal'].includes(v.type)) return 'A2';
  return TENSES[tense].level;
}

function stemVowelChange(v) {
  const wir = v.pres[3].split(' ')[0].replace(/e?n$/, '');
  const du = v.pres[1].split(' ')[0].replace(/e?st$/, '');
  return wir !== du && !/^(sein|haben|werden|wissen)$/.test(v.inf) && v.type !== 'modal' ? `${wir} → ${du}` : null;
}

export function conjugationWhy(v, tense, person, form) {
  const who = tense === 'imp' ? IMP_LABELS[person] : PERSON_LABELS[person];
  let why = `**${v.inf}** · ${TENSES[tense].name} · ${who} → **${form}**.`;
  const sep = v.sep ? ` Separable prefix **${v.sep}-** goes to the end in a main clause.` : '';
  switch (tense) {
    case 'pres': {
      const ch = stemVowelChange(v);
      if (ch && (person === 1 || person === 2)) why += ` Stem-changing verb: **${ch}** in the du and er/sie/es forms.`;
      else if (v.type === 'modal') why += ' Modal verbs: ich and er/sie/es have the same form and no ending.';
      else if (v.type === 'aux') why += ` **${v.inf}** is irregular — learn the forms by heart.`;
      else why += ' Endings: -e, -st, -t, -en, -t, -en.';
      break;
    }
    case 'prt':
      if (v.type === 'weak') why += ' Weak verb: stem + **-te** + ending (ich/er machte, du machtest).';
      else if (v.type === 'mixed') why += ' Mixed verb: changed stem **and** -te (denken → dachte).';
      else if (v.type === 'modal') why += ' Modal verbs: no umlaut in the Präteritum + -te (konnte, musste).';
      else why += ' Strong verb: new stem vowel; ich and er/sie/es have **no ending**.';
      break;
    case 'perf':
      why += ` Perfekt = **${auxList(v.aux).join('/')}** + Partizip II **${v.pp}**.`;
      if (v.aux === 'sein') why += ' **sein**: movement to a place, change of state, or sein/bleiben/werden/passieren.';
      break;
    case 'fut': why += ' Futur I = **werden** + infinitive at the end.'; break;
    case 'k2':
      if (v.type === 'weak') why += ' Weak verbs: the K-II form equals the Präteritum, so **würde + infinitive** is used instead.';
      else if (['aux', 'modal'].includes(v.type)) why += ' Use the real K-II form (Präteritum stem + umlaut): wäre, hätte, könnte …';
      else if (commonK2(v)) why += ` The real form (Präteritum stem + umlaut + -e) is common for this verb; **würde + ${v.inf}** is also correct.`;
      else why += ` The real form **${v.k2[person]}** sounds old-fashioned — in everyday German use **würde + infinitive** (both are accepted).`;
      break;
    case 'imp':
      why += [' du-form: the du-form without -st and without du (often no -e).', ' ihr-form: the ihr-form without ihr.', ' Sie-form: infinitive + Sie.'][person];
      if (person === 0 && /i/.test(v.imp[0].split(' ')[0]) && !/i/.test(v.inf)) why += ' Verbs with e → i/ie in the present keep the change (nimm!, lies!, hilf!).';
      break;
  }
  return why + sep;
}
