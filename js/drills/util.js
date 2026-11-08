// Shared helpers for drill generators: seedable RNG, weighted sampling, option building, word pools.
import { levelIdx } from '../german.js';
import { FALLBACK_WORDS, FALLBACK_VERBS } from './fallback.js';

/** Deterministic RNG (mulberry32). makeRng(seed) → {random(), int(n), pick(a), shuffle(a), chance(p)} */
export function makeRng(seed = Date.now()) {
  let a = typeof seed === 'string' ? hashStr(seed) : seed >>> 0;
  const random = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return wrapRng(random);
}
export function wrapRng(random) {
  if (random && random.pick) return random;
  const r = typeof random === 'function' ? random : random && random.random ? () => random.random() : Math.random;
  const api = {
    random: r,
    int: (n) => Math.floor(r() * n),
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    chance: (p) => r() < p,
    shuffle: (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  };
  return api;
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Weighted sampling without replacement. weights[i] ≥ 0. Returns indices. */
export function weightedSample(weights, n, rng) {
  const idx = weights.map((w, i) => [i, Math.max(0, w)]).filter(([, w]) => w > 0);
  const out = [];
  while (out.length < n && idx.length) {
    const total = idx.reduce((s, [, w]) => s + w, 0);
    let x = rng.random() * total, k = 0;
    for (; k < idx.length - 1; k++) { x -= idx[k][1]; if (x <= 0) break; }
    out.push(idx[k][0]);
    idx.splice(k, 1);
  }
  return out;
}

/** Build choice options containing `correct` + up to max-1 unique distractors, shuffled. → {options, answer} */
export function choiceOptions(correct, distractors, rng, max = 4) {
  const ds = [...new Set(distractors.filter((d) => d && d !== correct))];
  const opts = [correct, ...rng.shuffle(ds).slice(0, max - 1)];
  const options = rng.shuffle(opts);
  return { options, answer: options.indexOf(correct) };
}
/** Same, but keep a fixed natural order (e.g. der/die/das). */
export function fixedOptions(correct, all) {
  const options = [...new Set(all)];
  if (!options.includes(correct)) options.push(correct);
  return { options, answer: options.indexOf(correct) };
}

const inLevel = (w, level) => levelIdx(w.lvl || 'A1') <= levelIdx(level);

/** Word pool from content (level-filtered) with built-in fallback when content has too few. */
export function wordPool(ctx, pos, filter = () => true, min = 4) {
  const level = ctx.level || 'B2';
  let pool = ctx.content && ctx.content.words ? ctx.content.words.filter((w) => w.pos === pos && inLevel(w, level) && filter(w)) : [];
  if (pool.length < min) {
    const have = new Set(pool.map((w) => w.de));
    pool = pool.concat(FALLBACK_WORDS.filter((w) => w.pos === pos && inLevel(w, level) && filter(w) && !have.has(w.de)));
  }
  return pool;
}

/** Verb tables (verbs.json) with level from vocab when known. */
export function verbPool(ctx, filter = () => true) {
  const level = ctx.level || 'B2';
  let verbs = ctx.content && ctx.content.verbs ? ctx.content.verbs : [];
  if (verbs.length < 3) verbs = verbs.concat(FALLBACK_VERBS.filter((f) => !verbs.some((v) => v.inf === f.inf)));
  return verbs.filter((v) => {
    const w = ctx.content && ctx.content.word ? ctx.content.word(v.inf, 'verb') : null;
    return (!w || inLevel(w, level)) && filter(v);
  });
}

export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const mark = (s) => `**${s}**`;

/** English article fix-up: 'a old friend' → 'an old friend'. */
export const fixEn = (s) => s.replace(/\ba ([aeiouAEIOU])/g, 'an $1');

// Vocab topics whose nouns are mostly abstract / time words — kept out of "Ich sehe ___ …" style frames.
export const ABSTRACT_TOPICS = new Set(['Zeit', 'Wetter', 'Sport', 'Feste', 'Kultur', 'Gefühle', 'Politik', 'Gesellschaft', 'Wissenschaft', 'Sprache', 'Bildung', 'Medien', 'Kommunikation', 'Recht', 'Wirtschaft', 'Umwelt', 'Abstrakt', 'Allgemein', 'Arbeit', 'Beruf', 'Geld']);
/** Concrete, countable-enough noun for article/adjective frames. */
export const concreteNoun = (w) => w.g !== 'pl' && !ABSTRACT_TOPICS.has(w.topic) && !w.weak && w.pl !== '-';
/** Mass nouns that take a strong singular adjective naturally (guter Wein, kaltes Wasser). */
export const MASS_NOUNS = new Set(['Kaffee', 'Tee', 'Wein', 'Wasser', 'Milch', 'Bier', 'Brot', 'Käse', 'Zucker', 'Reis', 'Saft', 'Obst', 'Gemüse', 'Fleisch', 'Musik', 'Butter', 'Suppe', 'Salz', 'Kuchen', 'Fisch']);
