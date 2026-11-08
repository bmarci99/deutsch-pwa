// Perfekt: haben/sein + Partizip II.
import { HABEN, SEIN, REFLEXIVE, levelIdx } from '../german.js';
import { verbPool, wordPool, fixedOptions, choiceOptions } from './util.js';
import { auxList, PERSON_Q } from './verbforms.js';

function perfektVerbs(ctx) {
  const map = new Map();
  for (const w of wordPool(ctx, 'verb', (w) => w.pp && w.aux, 0)) {
    const inf = w.de.replace(/^sich /, '');
    const refl = w.refl || (w.de.startsWith('sich ') ? 'akk' : null);
    map.set(inf, { inf, pp: w.pp, aux: w.aux, refl, en: w.en, lvl: w.lvl });
  }
  for (const v of verbPool(ctx, (v) => v.pp && v.aux)) {
    if (!map.has(v.inf)) map.set(v.inf, { inf: v.inf, pp: v.pp, aux: v.aux, refl: v.refl || null, en: v.en, lvl: 'A2' });
  }
  return [...map.values()];
}

function ppPattern(v) {
  const pp = v.pp;
  if (/iert$/.test(pp) && !pp.startsWith('ge')) return 'Verbs in **-ieren** form the Partizip II without ge- (studiert).';
  if (!/ge/.test(pp)) return 'Verbs with an inseparable prefix (be-, ver-, er-, ent-, zer-, ge-, emp-, miss-) take no **ge-**.';
  if (!pp.startsWith('ge')) return 'Separable verb: **ge-** goes between prefix and stem.';
  if (/t$/.test(pp)) return 'Weak verb: **ge- … -t**.';
  return 'Strong verb: **ge- … -en**, often with a vowel change.';
}

export function perfektWhy(v) {
  const aux = auxList(v.aux);
  let why = `**${v.refl ? 'sich ' : ''}${v.inf}** → Perfekt with **${aux.join(' or ')}** + **${v.pp}**. ${ppPattern(v)}`;
  if (aux.includes('sein') && aux.length === 1) why += ' It takes **sein**: movement from A to B, a change of state, or sein/bleiben/passieren.';
  else if (aux.length === 2) why += ' **sein** for movement (Ich bin nach Berlin gefahren), **haben** with a direct object (Ich habe das Auto gefahren).';
  else if (v.refl) why += ' Reflexive verbs always take **haben**.';
  return why;
}

export default {
  id: 'perfekt', title: 'Perfekt', en: 'Present perfect', detektiv: 'Fall: Was ist passiert?', level: 'A2',
  topics: ['a2-perfekt', 'a2-partizip-ii'],
  items(ctx) {
    const lvl = levelIdx(ctx.level || 'B2');
    return perfektVerbs(ctx).filter((v) => levelIdx(v.lvl) <= lvl || v.lvl === 'A2').map((v) => ({ key: v.inf, level: v.lvl < 'A2' ? 'A2' : v.lvl, v }));
  },
  make({ v }, ctx, rng) {
    const p = rng.int(6);
    const aux = auxList(v.aux);
    const auxForms = aux.map((a) => (a === 'sein' ? SEIN : HABEN).pres[p]);
    const refl = v.refl ? ` ${REFLEXIVE[v.refl === 'dat' ? 'dat' : 'akk'][p]}` : '';
    const subj = PERSON_Q[p];
    const why = perfektWhy(v);
    const en = `${v.en} — present perfect`;
    const hint = `(${v.refl ? 'sich ' : ''}${v.inf})`;
    const r = rng.random();
    if (r < 0.3 && aux.length === 1) {
      const q = `${subj === 'sie' ? 'sie (Pl.)' : subj} ___${refl} ${v.pp}.`;
      return { type: 'choice', q, ...fixedOptions(auxForms[0], [HABEN.pres[p], SEIN.pres[p]]), hint, en, why, d: 1 };
    }
    if (r < 0.55) {
      const stem = v.inf.replace(/e?n$/, '');
      const distract = [`ge${stem}t`, `ge${stem}en`, `${v.pp.replace(/^ge/, '')}`, `ge${v.inf}`, v.pp.endsWith('t') ? v.pp.replace(/t$/, 'en') : v.pp.replace(/en$/, 't')];
      return { type: 'choice', q: `Partizip II von ${v.inf}: ___`, ...choiceOptions(v.pp, distract.filter((d) => d.length > 3), rng, 4), en: `${v.en} — past participle`, why, d: 2 };
    }
    return { type: 'gap', q: `${subj === 'sie' ? 'sie (Pl.)' : subj} ___${refl} ___`, answers: [auxForms, [v.pp]], hint, en, why, d: 2, audio: `${subj} ${auxForms[0]}${refl} ${v.pp}` };
  },
};
