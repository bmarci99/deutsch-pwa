// Conjugation: verb × person × tense (pres / prt / perf / fut / k2 / imp).
import { verbPool, choiceOptions } from './util.js';
import { verbForms, tenseAvailable, tenseLevel, conjugationWhy, PERSON_Q, TENSES, IMP_LABELS } from './verbforms.js';

export default {
  id: 'conjugation', title: 'Konjugation', en: 'Verb conjugation', detektiv: 'Fall: Wer hat was getan?', level: 'A1',
  topics: ['a1-present-regular', 'a1-present-stem-change', 'a1-pronouns-sein-haben', 'a1-modal-verbs', 'a1-imperative', 'a2-perfekt', 'a2-futur-i', 'b1-praeteritum', 'b1-konjunktiv-ii'],
  items(ctx) {
    const tenses = ctx.tenses || Object.keys(TENSES);
    const out = [];
    for (const v of verbPool(ctx)) for (const t of tenses) {
      if (!TENSES[t] || !tenseAvailable(v, t)) continue;
      const n = t === 'imp' ? 3 : 6;
      for (let p = 0; p < n; p++) out.push({ key: `${v.inf}|${t}|${p}`, level: tenseLevel(v, t), v, t, p });
    }
    return out;
  },
  make({ v, t, p }, ctx, rng) {
    const forms = verbForms(v, t, p);
    const form = forms[0];
    const why = conjugationWhy(v, t, p, form);
    const en = `${v.en} — ${TENSES[t].en}`;
    const hint = `(${v.refl ? 'sich ' : ''}${v.inf} · ${TENSES[t].name})`;
    const q = t === 'imp' ? `(${IMP_LABELS[p]}) ___!` : `${PERSON_Q[p] === 'sie' ? 'sie (Pl.)' : PERSON_Q[p]} ___`;
    const d = t === 'pres' ? 1 : t === 'k2' || t === 'prt' ? 3 : 2;
    if ((t === 'pres' || t === 'prt') && !v.refl && rng.chance(0.35)) {
      const distract = [...v.pres, ...(v.prt || [])].filter((f) => !forms.includes(f));
      return { type: 'choice', q, ...choiceOptions(form, distract, rng, 4), hint, en, why, d, audio: `${PERSON_Q[p]} ${form}` };
    }
    return { type: 'gap', q, answers: [forms], hint, en, why, d, audio: t === 'imp' ? `${form}!` : `${PERSON_Q[p]} ${form}` };
  },
};
