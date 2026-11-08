// FSRS-style spaced repetition (FSRS-5 formulas, default weights) + daily session builder.
// Times are epoch milliseconds; stability `s` is in days; difficulty `d` is 1..10.
// Grades: 1 again · 2 hard · 3 good · 4 easy.
import { levelIdx } from './german.js';

export const GRADES = { again: 1, hard: 2, good: 3, easy: 4 };
export const MIN = 60_000;
export const DAY = 86_400_000;

export const DEFAULT_PARAMS = {
  w: [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621],
  retention: 0.9,
  learningSteps: [1, 10],   // minutes
  relearningSteps: [10],    // minutes
  maxInterval: 365,         // days
};
const DECAY = -0.5;
const FACTOR = 19 / 81;

const clampD = (d) => Math.min(10, Math.max(1, d));
const initS = (w, g) => Math.max(0.1, w[g - 1]);
const initD = (w, g) => clampD(w[4] - Math.exp(w[5] * (g - 1)) + 1);
function nextD(w, d, g) {
  const delta = -w[6] * (g - 3);
  const dp = d + delta * (10 - d) / 9;
  return clampD(w[7] * initD(w, 4) + (1 - w[7]) * dp);
}
function recallS(w, d, s, r, g) {
  const hard = g === 2 ? w[15] : 1, easy = g === 4 ? w[16] : 1;
  return s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp(w[10] * (1 - r)) - 1) * hard * easy);
}
function forgetS(w, d, s, r) {
  return Math.min(s, w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r)));
}
const shortTermS = (w, s, g) => Math.max(0.1, s * Math.exp(w[17] * (g - 3 + w[18])));

/** Probability of recall after `t` days with stability `s`. */
export function forgettingCurve(t, s) { return Math.pow(1 + FACTOR * t / s, DECAY); }
/** Interval in days for a target retention. */
export function intervalFor(s, p = DEFAULT_PARAMS) {
  const days = (s / FACTOR) * (Math.pow(p.retention, 1 / DECAY) - 1);
  return Math.min(p.maxInterval, Math.max(1, Math.round(days)));
}

/** Retrievability of a card now (1 for never-seen / fresh cards). */
export function retrievability(card, now = Date.now()) {
  if (!card || card.state === 'new' || !card.last) return 1;
  return forgettingCurve(Math.max(0, (now - card.last) / DAY), card.s);
}

export function newCard(id, now = Date.now()) {
  return { id, state: 'new', due: now, s: 0, d: 0, reps: 0, lapses: 0, step: 0, last: 0, created: now };
}

/**
 * Apply a grade. Returns a NEW card object (input is not mutated).
 */
export function review(card, grade, now = Date.now(), p = DEFAULT_PARAMS) {
  const w = p.w;
  const c = { ...card };
  const g = Math.min(4, Math.max(1, Math.round(grade)));
  const steps = c.state === 'relearning' ? p.relearningSteps : p.learningSteps;
  const graduate = (s, minDays = 1) => {
    c.state = 'review'; c.step = 0; c.s = s;
    c.due = now + Math.max(minDays, intervalFor(s, p)) * DAY;
  };
  if (c.state === 'new') {
    c.d = initD(w, g); c.s = initS(w, g); c.state = 'learning'; c.step = 0;
    if (g === 1) c.due = now + p.learningSteps[0] * MIN;
    else if (g === 2) c.due = now + (p.learningSteps.length > 1 ? (p.learningSteps[0] + p.learningSteps[1]) / 2 : p.learningSteps[0] * 1.5) * MIN;
    else if (g === 3) {
      if (p.learningSteps.length > 1) { c.step = 1; c.due = now + p.learningSteps[1] * MIN; } else graduate(c.s);
    } else graduate(c.s, 2);
  } else if (c.state === 'learning' || c.state === 'relearning') {
    c.d = nextD(w, c.d, g); c.s = shortTermS(w, c.s, g);
    if (g === 1) { c.step = 0; c.due = now + steps[0] * MIN; }
    else if (g === 2) { c.due = now + (steps[c.step] || steps[0]) * 1.5 * MIN; }
    else if (g === 3) {
      c.step += 1;
      if (c.step >= steps.length) graduate(c.s); else c.due = now + steps[c.step] * MIN;
    } else graduate(c.s, 2);
  } else { // review
    const t = Math.max(0, (now - c.last) / DAY);
    const r = forgettingCurve(t, c.s);
    c.d = nextD(w, c.d, g);
    if (g === 1) {
      c.lapses += 1;
      c.s = forgetS(w, card.d, c.s, r);
      if (p.relearningSteps.length) { c.state = 'relearning'; c.step = 0; c.due = now + p.relearningSteps[0] * MIN; }
      else c.due = now + intervalFor(c.s, p) * DAY;
    } else {
      const sHard = recallS(w, card.d, c.s, r, 2), sGood = recallS(w, card.d, c.s, r, 3), sEasy = recallS(w, card.d, c.s, r, 4);
      let iv;
      const iHard = intervalFor(sHard, p), iGood = Math.max(intervalFor(sGood, p), iHard + 1), iEasy = Math.max(intervalFor(sEasy, p), iGood + 1);
      if (g === 2) { c.s = sHard; iv = iHard; } else if (g === 3) { c.s = sGood; iv = iGood; } else { c.s = sEasy; iv = iEasy; }
      c.due = now + Math.min(p.maxInterval, iv) * DAY;
    }
  }
  c.reps += 1;
  c.last = now;
  return c;
}

/** What each grade would schedule: {1: ms, 2: ms, 3: ms, 4: ms} (delay from now). */
export function previewIntervals(card, now = Date.now(), p = DEFAULT_PARAMS) {
  const out = {};
  for (const g of [1, 2, 3, 4]) out[g] = review(card, g, now, p).due - now;
  return out;
}

export function formatInterval(ms) {
  const m = ms / MIN;
  if (m < 60) return `${Math.max(1, Math.round(m))} min`;
  if (m < 60 * 24) return `${Math.round(m / 60)} h`;
  const d = ms / DAY;
  if (d < 30) return `${Math.round(d)} d`;
  if (d < 365) return `${Math.round(d / 30)} mo`;
  return `${(d / 365).toFixed(1)} y`;
}

/** Checker result → grade. opts.fast (bool) upgrades a correct answer to "easy". */
export function gradeFromResult(result, opts = {}) {
  if (result === 'wrong') return 1;
  if (result === 'almost') return 2;
  return opts.fast ? 4 : 3;
}

export function isDue(card, now = Date.now()) { return !!card && card.state !== 'new' && card.due <= now; }

/** Due cards (object map or array), most-forgotten first; learning cards first within the same minute. */
export function dueCards(cards, now = Date.now(), { lookaheadMs = 0, prefix = null } = {}) {
  const list = Array.isArray(cards) ? cards : Object.values(cards || {});
  return list
    .filter((c) => c && c.state !== 'new' && c.due <= now + lookaheadMs && (!prefix || c.id.startsWith(prefix)))
    .sort((a, b) => retrievability(a, now) - retrievability(b, now) || a.due - b.due);
}

/** Weakness 0..∞ used to weight drill/exercise selection. Unseen items → `unseen` (default 1). */
export function weakness(card, now = Date.now(), unseen = 1) {
  if (!card || card.state === 'new') return unseen;
  const r = retrievability(card, now);
  let w = 0.25 + 3 * (1 - r) + 0.5 * Math.min(card.lapses, 4);
  if (card.state === 'learning' || card.state === 'relearning') w += 1;
  if (card.due <= now) w *= 2;
  return w;
}

// ---------------------------------------------------------------- card ids
export const cardId = {
  exercise: (topicId, exId) => `ex:${topicId}:${exId}`,
  /** dir: 'de-en' | 'en-de' | 'g' (gender) */
  word: (wordKey, dir = 'de-en') => `w:${wordKey}|${dir}`,
  drill: (drillId, key) => `dr:${drillId}:${key}`,
};
/** → {kind:'exercise', topicId, exId} | {kind:'word', wordKey, dir} | {kind:'drill', drillId, key} | null */
export function parseCardId(id) {
  if (typeof id !== 'string') return null;
  if (id.startsWith('ex:')) { const rest = id.slice(3); const i = rest.lastIndexOf(':'); return { kind: 'exercise', topicId: rest.slice(0, i), exId: rest.slice(i + 1) }; }
  if (id.startsWith('w:')) { const rest = id.slice(2); const i = rest.lastIndexOf('|'); return { kind: 'word', wordKey: rest.slice(0, i), dir: rest.slice(i + 1) }; }
  if (id.startsWith('dr:')) { const rest = id.slice(3); const i = rest.indexOf(':'); return { kind: 'drill', drillId: rest.slice(0, i), key: rest.slice(i + 1) }; }
  return null;
}

// ---------------------------------------------------------------- session building
/**
 * Resolve a card id to a renderable session item, or null if its source is gone.
 * item = {cardId, kind, exercise, word?, dir?, topicId?}
 */
export async function itemForCard(id, { content, rng } = {}) {
  const p = parseCardId(id);
  if (!p || !content) return null;
  if (p.kind === 'word') {
    const word = content.wordByKey(p.wordKey);
    if (!word) return null;
    const { wordExercise } = await import('./drills/index.js');
    const exercise = wordExercise(word, p.dir, { content, rng });
    return exercise ? { cardId: id, kind: 'word', word, dir: p.dir, exercise } : null;
  }
  if (p.kind === 'exercise') {
    const topic = await content.getTopic(p.topicId);
    const exercise = topic && (topic.exercises || []).find((e) => e.id === p.exId);
    return exercise ? { cardId: id, kind: 'exercise', topicId: p.topicId, exercise: { ...exercise, card: id, topic: p.topicId } } : null;
  }
  const { exerciseForCard } = await import('./drills/index.js');
  const exercise = exerciseForCard(id, { content, rng });
  return exercise ? { cardId: id, kind: 'drill', drillId: p.drillId, exercise } : null;
}

/**
 * Build today's session: due reviews + new words + weak-topic exercises.
 * opts: {content, store, now, rng, maxReviews=60, newWords (default settings.newWordsPerDay − introduced today),
 *        weakExercises=8, level (max level, default: store.settings.level)}
 * → {items:[{cardId, kind, source:'due'|'new'|'weak', exercise, word?, dir?, topicId?, intro?}], counts:{due,new,weak,dueTotal}}
 */
export async function buildDailySession(opts) {
  const { content, store, now = Date.now(), rng = Math, maxReviews = 60, weakExercises = 8 } = opts;
  const level = opts.level || store.settings?.level || 'B2';
  const state = store.state;
  const cards = state.cards || {};
  const lvl = levelIdx(level);

  // 1. due reviews
  const due = dueCards(cards, now);
  const reviews = [];
  for (const c of due) {
    if (reviews.length >= maxReviews) break;
    const it = await itemForCard(c.id, { content, rng }).catch(() => null);
    if (it) reviews.push({ ...it, source: 'due' });
  }

  // 2. new words
  const settings = store.settings || {};
  const introduced = store.today ? store.today().newWords || 0 : 0;
  const nNew = opts.newWords ?? Math.max(0, (settings.newWordsPerDay ?? 10) - introduced);
  const known = new Set();
  for (const id of Object.keys(cards)) if (id.startsWith('w:')) known.add(id.slice(2, id.lastIndexOf('|')));
  const fresh = [];
  if (nNew > 0) {
    const pool = content.words
      .map((w, i) => ({ w, i }))
      .filter(({ w }) => levelIdx(w.lvl) <= lvl && !known.has(content.wordKey(w)))
      .sort((a, b) => levelIdx(a.w.lvl) - levelIdx(b.w.lvl) || a.i - b.i);
    const { wordExercise } = await import('./drills/index.js');
    for (const { w } of pool.slice(0, nNew)) {
      const key = content.wordKey(w);
      fresh.push({ cardId: cardId.word(key, 'de-en'), kind: 'word', word: w, dir: 'de-en', intro: true, source: 'new', exercise: wordExercise(w, 'de-en', { content, rng }) });
      if (w.pos === 'noun' && w.g !== 'pl') fresh.push({ cardId: cardId.word(key, 'g'), kind: 'word', word: w, dir: 'g', source: 'new', exercise: wordExercise(w, 'g', { content, rng }) });
    }
  }

  // 3. weak-topic exercises
  const weak = [];
  const dueIds = new Set(reviews.map((r) => r.cardId));
  if (weakExercises > 0 && store.weakTopics) {
    const topics = store.weakTopics(3).filter((t) => { const m = content.topicMeta(t.id); return m && levelIdx(m.level) <= lvl; });
    const per = Math.max(1, Math.ceil(weakExercises / Math.max(1, topics.length)));
    for (const t of topics) {
      const topic = await content.getTopic(t.id).catch(() => null);
      if (!topic) continue;
      const scores = (state.topics?.[t.id]?.ex) || {};
      const cand = (topic.exercises || []).filter((e) => (scores[e.id] ?? -1) < 1 && !dueIds.has(cardId.exercise(t.id, e.id)));
      cand.sort((a, b) => (scores[a.id] ?? 0.25) - (scores[b.id] ?? 0.25) || (a.d || 1) - (b.d || 1));
      for (const e of cand.slice(0, per)) {
        if (weak.length >= weakExercises) break;
        const id = cardId.exercise(t.id, e.id);
        weak.push({ cardId: id, kind: 'exercise', topicId: t.id, source: 'weak', exercise: { ...e, card: id, topic: t.id } });
      }
    }
  }

  // interleave: 3 reviews, 1 new word (with its gender card), …; weak exercises last
  const items = [];
  let ri = 0, fi = 0;
  while (ri < reviews.length || fi < fresh.length) {
    for (let k = 0; k < 3 && ri < reviews.length; k++) items.push(reviews[ri++]);
    if (fi < fresh.length) {
      items.push(fresh[fi++]);
      if (fi < fresh.length && fresh[fi].dir === 'g' && fresh[fi].word === fresh[fi - 1].word) items.push(fresh[fi++]);
    }
  }
  items.push(...weak);
  return { items, counts: { due: reviews.length, dueTotal: due.length, new: fresh.filter((f) => f.intro).length, weak: weak.length } };
}
