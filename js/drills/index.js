// Drill registry + generic generator (level filter, SRS-weighted selection, seedable RNG).
import { levelIdx } from '../german.js';
import { weakness, cardId as makeCardId, parseCardId } from '../srs.js';
import { makeRng, wrapRng, weightedSample, hashStr } from './util.js';
import gender from './gender.js';
import plural from './plural.js';
import caseArticles from './case-articles.js';
import adjEndings from './adj-endings.js';
import conjugation from './conjugation.js';
import perfekt from './perfekt.js';
import prepCase from './prep-case.js';
import verbPrep from './verb-prep.js';
import comparison from './comparison.js';
import weakNouns from './weak-nouns.js';

export { makeRng } from './util.js';
export { wordExercise, displayWord, wordInfo } from './vocab.js';

export const DRILLS = [gender, plural, caseArticles, adjEndings, conjugation, perfekt, prepCase, verbPrep, comparison, weakNouns];
const BY_ID = new Map(DRILLS.map((d) => [d.id, d]));

/** [{id, title, en, detektiv, level, topics}] */
export const DRILL_META = DRILLS.map(({ id, title, en, detektiv, level, topics }) => ({ id, title, en, detektiv, level, topics }));
export function drillById(id) { return BY_ID.get(id) || null; }
/** Drills that train a topic (via drill.topics, plus the topic file's own `drills` list if given). */
export function drillsForTopic(topicId, topic = null) {
  const ids = new Set([...(topic?.drills || []), ...DRILLS.filter((d) => d.topics.includes(topicId)).map((d) => d.id)]);
  return [...ids].filter((id) => BY_ID.has(id));
}

function ctxOf(opts) {
  return { content: opts.content || null, level: opts.level || 'B2', tenses: opts.tenses };
}

/** All candidate items of a drill for the context (level-filtered). */
export function drillItems(id, opts = {}) {
  const d = BY_ID.get(id);
  if (!d) throw new Error(`unknown drill ${id}`);
  const ctx = ctxOf(opts);
  const li = levelIdx(ctx.level);
  let items = d.items(ctx).filter((it) => levelIdx(it.level || 'A1') <= li);
  if (opts.filter) items = items.filter(opts.filter);
  return items;
}

function finish(d, item, ex, i) {
  const card = makeCardId.drill(d.id, item.key);
  return { id: `dr-${d.id}-${hashStr(item.key).toString(36)}-${i}`, ...ex, drill: d.id, card, key: item.key, level: item.level || d.level };
}

/**
 * Generate n exercises for a drill.
 * opts: {content, n=10, level='B2', seed | rng, cards (store.state.cards) , now, filter(item)→bool, tenses:[…] (conjugation)}
 * Items are chosen by SRS weakness (forgotten / lapsed / unseen items first) without repetition.
 * Each exercise = content-exercise shape + {drill, card:'dr:<drill>:<key>', key, level}.
 */
export function generate(id, opts = {}) {
  const d = BY_ID.get(id);
  if (!d) throw new Error(`unknown drill ${id}`);
  const rng = opts.rng ? wrapRng(opts.rng) : makeRng(opts.seed ?? Date.now());
  const ctx = ctxOf(opts);
  const items = drillItems(id, opts);
  if (!items.length) return [];
  const n = opts.n ?? 10;
  const now = opts.now ?? Date.now();
  const cards = opts.cards || {};
  const weights = items.map((it) => weakness(cards[makeCardId.drill(id, it.key)], now, 1));
  const picked = weightedSample(weights, Math.min(n, items.length), rng);
  const out = [];
  for (const idx of picked) {
    try {
      const ex = d.make(items[idx], ctx, rng);
      if (ex) out.push(finish(d, items[idx], ex, out.length));
    } catch (e) { /* skip a broken item, keep the drill usable */ if (opts.debug) throw e; }
  }
  return out;
}

/** Mixed session from several drills (round-robin). */
export function generateMixed(ids, opts = {}) {
  const rng = opts.rng ? wrapRng(opts.rng) : makeRng(opts.seed ?? Date.now());
  const n = opts.n ?? 10;
  const per = Math.ceil(n / Math.max(1, ids.length));
  const lists = ids.map((id) => generate(id, { ...opts, rng, n: per }));
  const out = [];
  for (let i = 0; out.length < n && lists.some((l) => i < l.length); i++) for (const l of lists) if (l[i] && out.length < n) out.push({ ...l[i], id: `${l[i].id}-m${out.length}` });
  return out;
}

/** Re-create an exercise for a drill SRS card id 'dr:<drill>:<key>' (null if the item no longer exists). */
export function exerciseForCard(id, opts = {}) {
  const p = parseCardId(id);
  if (!p || p.kind !== 'drill') return null;
  const d = BY_ID.get(p.drillId);
  if (!d) return null;
  const ctx = ctxOf({ ...opts, level: 'B2' });
  const item = d.items(ctx).find((it) => it.key === p.key);
  if (!item) return null;
  const rng = opts.rng ? wrapRng(opts.rng) : makeRng(opts.seed ?? Date.now());
  const ex = d.make(item, ctx, rng);
  return ex ? finish(d, item, ex, 0) : null;
}

/** Per-drill progress summary from SRS cards: {drillId: {seen, due, avgRetention}} */
export function drillProgress(cards, now = Date.now()) {
  const out = {};
  for (const d of DRILLS) out[d.id] = { seen: 0, due: 0, lapses: 0 };
  for (const c of Object.values(cards || {})) {
    if (!c.id.startsWith('dr:')) continue;
    const p = parseCardId(c.id);
    const o = out[p.drillId];
    if (!o) continue;
    o.seen++; o.lapses += c.lapses || 0; if (c.state !== 'new' && c.due <= now) o.due++;
  }
  return out;
}
