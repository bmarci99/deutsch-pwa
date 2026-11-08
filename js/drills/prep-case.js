// Preposition → case (+ article form, Wo?/Wohin?, contractions).
import { PREP_GROUPS, PREPOSITIONS, prepCase, defArticle, nounForm, contract, CASE_NAMES } from '../german.js';
import { fixedOptions, mark } from './util.js';

const N = (de, g, extra = {}) => ({ de, g, pos: 'noun', ...extra });
// Natural noun choices per preposition (singular, definite article).
export const PREP_NOUNS = {
  durch: [N('Park', 'm'), N('Stadt', 'f'), N('Wald', 'm'), N('Tunnel', 'm')],
  für: [N('Freund', 'm'), N('Familie', 'f'), N('Kind', 'n'), N('Prüfung', 'f')],
  gegen: [N('Wand', 'f'), N('Baum', 'm'), N('Plan', 'm'), N('Lärm', 'm')],
  ohne: [N('Schirm', 'm'), N('Jacke', 'f'), N('Handy', 'n'), N('Auto', 'n')],
  um: [N('Tisch', 'm'), N('Haus', 'n'), N('Ecke', 'f'), N('See', 'm')],
  aus: [N('Haus', 'n'), N('Küche', 'f'), N('Büro', 'n'), N('Zug', 'm')],
  bei: [N('Arzt', 'm'), N('Bäckerei', 'f'), N('Firma', 'f'), N('Friseur', 'm')],
  mit: [N('Bus', 'm'), N('Zug', 'm'), N('Kollegin', 'f'), N('Fahrrad', 'n')],
  nach: [N('Unterricht', 'm'), N('Arbeit', 'f'), N('Essen', 'n'), N('Film', 'm')],
  seit: [N('Unfall', 'm'), N('Umzug', 'm'), N('Prüfung', 'f'), N('Sommer', 'm')],
  von: [N('Bahnhof', 'm'), N('Arbeit', 'f'), N('Arzt', 'm'), N('Chefin', 'f')],
  zu: [N('Bahnhof', 'm'), N('Post', 'f'), N('Arzt', 'm'), N('Bank', 'f'), N('Kino', 'n')],
  gegenüber: [N('Bahnhof', 'm'), N('Kirche', 'f'), N('Rathaus', 'n')],
  außer: [N('Chef', 'm'), N('Kollegin', 'f')],
  an: [N('Wand', 'f'), N('Tafel', 'f'), N('Fenster', 'n'), N('Tisch', 'm')],
  auf: [N('Tisch', 'm'), N('Sofa', 'n'), N('Boden', 'm'), N('Straße', 'f')],
  hinter: [N('Haus', 'n'), N('Tür', 'f'), N('Schrank', 'm')],
  in: [N('Küche', 'f'), N('Schrank', 'm'), N('Kino', 'n'), N('Stadt', 'f'), N('Büro', 'n')],
  neben: [N('Bett', 'n'), N('Lampe', 'f'), N('Sofa', 'n'), N('Schrank', 'm')],
  über: [N('Tisch', 'm'), N('Sofa', 'n'), N('Tür', 'f'), N('Bett', 'n')],
  unter: [N('Bett', 'n'), N('Tisch', 'm'), N('Brücke', 'f')],
  vor: [N('Tür', 'f'), N('Haus', 'n'), N('Bahnhof', 'm'), N('Kino', 'n')],
  während: [N('Urlaub', 'm', { gen: 'Urlaub(e)s' }), N('Pause', 'f'), N('Film', 'm', { gen: 'Film(e)s' }), N('Essen', 'n'), N('Fahrt', 'f')],
  wegen: [N('Regen', 'm'), N('Stau', 'm', { gen: 'Staus' }), N('Wetter', 'n'), N('Erkältung', 'f'), N('Streik', 'm', { gen: 'Streik(e)s' })],
  trotz: [N('Regen', 'm'), N('Wetter', 'n'), N('Kälte', 'f'), N('Verspätung', 'f')],
  statt: [N('Bus', 'm', { gen: 'Busses' }), N('Auto', 'n'), N('Kaffee', 'm')],
  anstatt: [N('Bus', 'm', { gen: 'Busses' }), N('Auto', 'n')],
  innerhalb: [N('Woche', 'f'), N('Stadt', 'f'), N('Monat', 'm', { gen: 'Monat(e)s' })],
  außerhalb: [N('Stadt', 'f'), N('Zentrum', 'n')],
  aufgrund: [N('Streik', 'm', { gen: 'Streik(e)s' }), N('Wetter', 'n'), N('Krankheit', 'f')],
  infolge: [N('Unfall', 'm', { gen: 'Unfall(e)s' }), N('Krise', 'f')],
  angesichts: [N('Situation', 'f'), N('Lage', 'f')],
};
const PREP_LEVEL = { akk: 'A1', dat: 'A2', wechsel: 'A2', gen: 'B1' };
const B2_PREPS = new Set(['innerhalb', 'außerhalb', 'aufgrund', 'infolge', 'angesichts', 'oberhalb', 'unterhalb', 'diesseits', 'jenseits', 'mithilfe', 'bezüglich', 'hinsichtlich', 'anlässlich', 'anstatt']);
const CASE_OPTS = ['Akkusativ', 'Dativ', 'Genitiv', 'Akkusativ oder Dativ'];
const GROUP_LABEL = { akk: 'Akkusativ', dat: 'Dativ', gen: 'Genitiv', wechsel: 'Akkusativ oder Dativ' };

export function prepWhy(p, motion) {
  const c = prepCase(p);
  if (c === 'akk') return `**${p}** always takes the **Akkusativ** (durch, für, gegen, ohne, um, bis, entlang).`;
  if (c === 'dat') return `**${p}** always takes the **Dativ** (aus, bei, mit, nach, seit, von, zu, gegenüber, ab, außer).`;
  if (c === 'gen') return `**${p}** takes the **Genitiv** (in spoken German often the Dativ).`;
  const base = `**${p}** is a Wechselpräposition: **Wo?** (position) → Dativ, **Wohin?** (movement to a destination) → Akkusativ.`;
  if (motion === 'wo') return `${base} Here: Wo? → **Dativ**.`;
  if (motion === 'wohin') return `${base} Here: Wohin? → **Akkusativ**.`;
  return base;
}

export default {
  id: 'prep-case', title: 'Präposition + Kasus', en: 'Prepositions and their case', detektiv: 'Fall: Wo? Wohin? Woher?', level: 'A1',
  topics: ['a1-accusative-prepositions', 'a2-dative-prepositions', 'a2-two-way-prepositions', 'b1-genitive', 'b2-genitive-prepositions-advanced'],
  items() {
    const out = [];
    for (const [group, preps] of Object.entries(PREP_GROUPS)) for (const p of preps) {
      const level = B2_PREPS.has(p) ? 'B2' : ['gegenüber', 'außer', 'ab', 'entlang'].includes(p) ? 'B1' : PREP_LEVEL[group];
      out.push({ key: p, level, p, group, kind: 'case' });
      if (!PREP_NOUNS[p]) continue;
      if (group === 'wechsel') {
        out.push({ key: `${p}|wo`, level, p, group, kind: 'art', motion: 'wo' });
        out.push({ key: `${p}|wohin`, level, p, group, kind: 'art', motion: 'wohin' });
      } else out.push({ key: `${p}|art`, level, p, group, kind: 'art' });
    }
    return out;
  },
  make({ p, group, kind, motion }, ctx, rng) {
    if (kind === 'case') {
      return { type: 'choice', q: `${p} + ___`, ...fixedOptions(GROUP_LABEL[group], CASE_OPTS), en: `${p} = ${PREPOSITIONS[p]?.en || p}`, why: prepWhy(p), d: 1 };
    }
    const w = rng.pick(PREP_NOUNS[p]);
    const c = group === 'wechsel' ? (motion === 'wohin' ? 'akk' : 'dat') : group;
    const art = defArticle(w.g, c);
    const noun = nounForm(w, c);
    const ctr = contract(p, art);
    const label = motion ? ` · ${motion === 'wo' ? 'Wo?' : 'Wohin?'}` : '';
    const why = `${prepWhy(p, motion)} ${CASE_NAMES[c]} of **${defArticle(w.g, 'nom')} ${w.de}** → ${mark(`${ctr || `${p} ${art}`} ${noun}`)}.${ctr ? ` **${p} + ${art}** is normally contracted to **${ctr}**.` : ''}`;
    if (ctr) {
      return { type: 'gap', q: `___ ${noun}`, answers: [[ctr, `${p} ${art}`]], hint: `(${p} + ${defArticle(w.g, 'nom')} ${w.de}${label})`, why, d: 2 };
    }
    return { type: 'gap', q: `${p} ___ ${noun}`, answers: [[art]], hint: `(${defArticle(w.g, 'nom')} ${w.de}${label})`, why, d: c === 'gen' ? 3 : 2 };
  },
};
