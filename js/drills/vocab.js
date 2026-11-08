// Exercises for vocabulary SRS cards: de→en (recognise), en→de (produce), g (gender).
import { DEF_NOM } from '../german.js';
import { wrapRng, choiceOptions } from './util.js';
import { FALLBACK_WORDS } from './fallback.js';
import { genderExercise } from './gender.js';

/** Display form: 'der Tisch' for nouns, 'sich freuen' for verbs, otherwise the lemma. */
export function displayWord(w) {
  if (w.pos === 'noun') return w.g === 'pl' ? `die ${w.de} (Pl.)` : `${DEF_NOM[w.g]} ${w.de}`;
  if (w.pos === 'verb' && w.refl && !w.de.startsWith('sich ')) return `sich ${w.de}`;
  return w.de;
}

/** One-line grammar info: 'der Tisch, -e' style details for the feedback card. */
export function wordInfo(w) {
  const parts = [];
  if (w.pos === 'noun') { if (w.g !== 'pl') parts.push(`die ${w.pl && w.pl !== '-' ? w.pl : '(no plural)'}`); if (w.gen) parts.push(`des ${w.gen}`); }
  if (w.pos === 'verb') { parts.push([w.p3, w.prt, `${w.aux === 'sein' ? 'ist' : w.aux === 'haben/sein' ? 'hat/ist' : 'hat'} ${w.pp}`].filter(Boolean).join(' – ')); if (w.prep) parts.push(w.prep); }
  if (w.pos === 'adj' && w.comp) parts.push(`${w.comp}, ${w.sup}`);
  return parts.filter(Boolean).join(' · ');
}

function why(w) {
  const info = wordInfo(w);
  let s = `**${displayWord(w)}** — ${w.en}${info ? ` (${info})` : ''}.`;
  if (w.ex) s += ` _${w.ex}_${w.exEn ? ` — ${w.exEn}` : ''}`;
  return s;
}

/**
 * Exercise for a word card. dir: 'de-en' (choice of English meanings) | 'en-de' (type the German, nouns with article) | 'g' (der/die/das).
 * ctx: {content?, rng?}. Returns an exercise object (same shape as content exercises) with extra fields {word, audio}.
 */
export function wordExercise(w, dir = 'de-en', ctx = {}) {
  const rng = wrapRng(ctx.rng || Math.random);
  const key = w.key || `${w.de}|${w.pos}`;
  const audio = displayWord(w).replace(/ \(Pl\.\)$/, '');
  if (dir === 'g' && w.pos === 'noun' && ['m', 'f', 'n'].includes(w.g)) return { ...genderExercise(w), id: `w-${key}-g`, word: key };
  if (dir === 'en-de') {
    const answers = w.pos === 'noun'
      ? (w.g === 'pl' ? [`die ${w.de}`] : [`${DEF_NOM[w.g]} ${w.de}`])
      : w.pos === 'verb' && w.refl && !w.de.startsWith('sich ') ? [`sich ${w.de}`, w.de] : [w.de];
    return { id: `w-${key}-en-de`, type: 'gap', q: `${w.en} → ___`, answers: [answers], hint: w.pos === 'noun' ? '(with article)' : `(${w.pos})`, en: w.en, why: why(w), d: 2, word: key, audio };
  }
  // de-en
  const pool = (ctx.content && ctx.content.wordsByPos && ctx.content.wordsByPos[w.pos]) || [];
  let others = pool.filter((o) => o.en !== w.en).map((o) => o.en);
  if (others.length < 3) others = others.concat(FALLBACK_WORDS.filter((o) => o.en !== w.en).map((o) => o.en));
  const sample = rng.shuffle(others).slice(0, 12);
  return { id: `w-${key}-de-en`, type: 'choice', q: displayWord(w), ...choiceOptions(w.en, sample, rng, 4), en: w.en, why: why(w), d: 1, word: key, audio };
}
