// Exercise registry: mount any exercise (8 content types + dictation) and helpers to describe it.
//
//   const ctl = mountExercise(ex, { submit, changed });
//   ctl.el            → element to insert
//   ctl.auto          → true if the exercise submits itself (choice, error tap); no "Prüfen" button needed
//   ctl.canSubmit()   → bool (enable the Prüfen button)
//   ctl.response()    → response in the shape checker.check() expects
//   ctl.reveal(res)   → lock the inputs and paint correct / wrong marks in place
//   ctl.focus()       → focus the first input (no-op for tap types)
//
// The session runner calls checkExercise(ex, response) → checker result, then ctl.reveal(result).
import { check, checkText } from '../checker.js';
import { stripMd } from '../ui.js';
import choice from './choice.js';
import gap from './gap.js';
import order from './order.js';
import transform from './transform.js';
import translate from './translate.js';
import error from './error.js';
import match from './match.js';
import table from './table.js';
import dictation from './dictation.js';

const RENDERERS = { choice, gap, order, transform, translate, error, match, table, dictation };

export const TYPE_LABEL = {
  choice: 'Auswahl', gap: 'Lückentext', order: 'Satzbau', transform: 'Umformen', translate: 'Übersetzen',
  error: 'Fehlersuche', match: 'Zuordnen', table: 'Tabelle', dictation: 'Diktat',
};

/** Mount an exercise. hooks: {submit(): void, changed(): void}. */
export function mountExercise(ex, hooks = {}) {
  const r = RENDERERS[ex.type];
  if (!r) throw new Error(`Unbekannter Aufgabentyp: ${ex.type}`);
  const api = { submit: hooks.submit || (() => {}), changed: hooks.changed || (() => {}) };
  const ctl = r(ex, api);
  ctl.type = ex.type;
  ctl.focus = ctl.focus || (() => {});
  ctl.auto = !!ctl.auto;
  return ctl;
}

/** Check any exercise (adds dictation to checker.check). */
export function checkExercise(ex, response) {
  if (ex.type === 'dictation') return checkText(response ?? '', ex.answers, { ignoreInitialCase: true, sentence: true });
  return check(ex, response);
}

/** Fill the ___ gaps of a question with values (array). */
export function fillGaps(q, values) {
  let i = 0;
  return String(q || '').replace(/_{3,}/g, () => values[i++] ?? '…');
}

/** The complete correct German sentence (for TTS and feedback), or null if there is no single sentence. */
export function solutionText(ex) {
  switch (ex.type) {
    case 'choice': return ex.q?.includes('___') ? fillGaps(ex.q, [ex.options[ex.answer]]) : (ex.audio || null);
    case 'gap': return fillGaps(ex.q, ex.answers.map((a) => a[0]));
    case 'order': return ex.words.join(' ') + (ex.punct || '');
    case 'transform': case 'translate': case 'dictation': return ex.answers[0];
    case 'error': return ex.tokens.map((t, i) => (i === ex.wrong ? keepPunct(t, ex.fix) : t)).join(' ');
    default: return null;
  }
}
const keepPunct = (tok, fix) => { const m = /[.,!?;:…"“”]+$/.exec(tok); return m && !fix.endsWith(m[0]) ? fix + m[0] : fix; };

/** What to speak for this exercise after answering (drill `audio` wins). */
export function audioText(ex) {
  if (ex.audio) return ex.audio;
  const s = solutionText(ex);
  return s ? stripMd(s) : null;
}

/** Plain-text prompt for the mistakes notebook. */
export function promptText(ex) {
  switch (ex.type) {
    case 'choice': case 'gap': return stripMd(ex.q) + (ex.hint ? ` ${ex.hint}` : '');
    case 'order': return ex.en ? `Satzbau: ${ex.en}` : 'Satzbau';
    case 'transform': return `${ex.instruction} ${ex.source}`;
    case 'translate': return ex.en;
    case 'error': return ex.tokens.join(' ');
    case 'match': return ex.instruction || 'Zuordnen';
    case 'table': return ex.caption || 'Tabelle';
    case 'dictation': return `Diktat: ${ex.answers[0]}`;
    default: return '';
  }
}

/** Expected answer as short text. */
export function expectedText(ex) {
  switch (ex.type) {
    case 'choice': return ex.options[ex.answer];
    case 'gap': return ex.answers.map((a) => a[0]).join(' · ');
    case 'error': return `${ex.tokens[ex.wrong]} → ${ex.fix}`;
    case 'match': return ex.pairs.map(([l, r]) => `${l} = ${r}`).join('; ');
    case 'table': return ex.caption || '';
    default: return solutionText(ex) || '';
  }
}

/** The user's response as short text. */
export function givenText(ex, response) {
  if (response == null) return '';
  switch (ex.type) {
    case 'choice': return ex.options[response] ?? '';
    case 'gap': return (Array.isArray(response) ? response : [response]).join(' · ');
    case 'order': return response.join(' ');
    case 'error': return `${ex.tokens[response.index] ?? ''}${response.fix ? ` → ${response.fix}` : ''}`;
    case 'match': return (Array.isArray(response) ? response : Object.entries(response)).map(([l, r]) => `${l} = ${r ?? '?'}`).join('; ');
    case 'table': return Object.values(response).join(' · ');
    default: return String(response);
  }
}

export { dictationFrom, dictationsFromTopic } from './dictation.js';
