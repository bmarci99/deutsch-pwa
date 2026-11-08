// Session sources: turn a route (#/practice/<topic>?m=…, #/drill/<id>, #/session/<kind>) into a playable session.
//
//   const src = await buildSource(ctx)   // ctx = router ctx {path, params, query, content, store}
//   src = { title, kicker, items: Item[], more?: () => Promise<Item[]>, endless, topicId?, drillId?, back, empty? }
//
// Item (same shape as srs.buildDailySession items):
//   { cardId|null, kind:'exercise'|'word'|'drill'|'dictation', exercise, topicId?, drillId?, word?, dir?, intro?, source? }
// Other screens can start a session from in-memory items with startCustomSession({title, items, back}).
import * as srs from './srs.js';
import { generate, generateMixed, drillsForTopic, DRILL_META, makeRng } from './drills/index.js';
import { dictationFrom, dictationsFromTopic } from './exercises/index.js';
import { levelIdx } from './german.js';
import { recommendedTopic, noteTopic } from './progress.js';

const rng = () => makeRng(Date.now() ^ Math.floor(Math.random() * 1e9));

// ------------------------------------------------------------------ item factories
export function exerciseItem(topicId, ex, source = null) {
  const cardId = srs.cardId.exercise(topicId, ex.id);
  return { cardId, kind: 'exercise', topicId, exercise: { ...ex, card: cardId, topic: topicId }, source };
}
export function drillItem(ex, source = null) {
  return { cardId: ex.card, kind: 'drill', drillId: ex.drill, exercise: ex, source };
}
export function dictationItem(d, source = 'dictation') {
  return { cardId: null, kind: 'dictation', topicId: d.source?.topic || null, exercise: d, source };
}

/** Selection weight of a content exercise: unseen and wrong first, then due/forgotten cards. */
function exWeight(store, topicId, ex, now) {
  const last = store.state.topics?.[topicId]?.ex?.[ex.id];
  const card = store.state.cards[srs.cardId.exercise(topicId, ex.id)];
  if (last === undefined) return 1.2;
  if (card) return 0.25 + srs.weakness(card, now, 1) + (1 - last);
  return 0.08 + (1 - last) * 1.2;
}

function weightedPick(list, weights, n, r) {
  const idx = list.map((_, i) => i);
  const out = [];
  const w = [...weights];
  while (out.length < n && idx.length) {
    const total = idx.reduce((s, i) => s + Math.max(0, w[i]), 0);
    if (total <= 0) break;
    let x = r.random() * total, k = 0;
    for (; k < idx.length - 1; k++) { x -= Math.max(0, w[idx[k]]); if (x <= 0) break; }
    out.push(list[idx[k]]);
    idx.splice(k, 1);
  }
  return out;
}

const byDifficulty = (a, b) => (a.exercise.d || 1) - (b.exercise.d || 1);

/** Insert `extra` items at spread-out positions of `items`. */
function sprinkle(items, extra) {
  const out = [...items];
  extra.forEach((x, i) => out.splice(Math.min(out.length, Math.round(((i + 1) * out.length) / (extra.length + 1)) + i), 0, x));
  return out;
}

// ------------------------------------------------------------------ topic practice
/**
 * mode: '20' (smart 20: unseen + weak, easy→hard, 2 dictations) | 'all' | 'fehler' | 'endlos' | 'diktat'
 */
export async function topicSource({ content, store, topicId, mode = '20' }) {
  const topic = await content.getTopic(topicId);
  const meta = content.topicMeta(topicId);
  if (!topic) return { title: meta?.title || topicId, items: [], empty: 'Dieses Thema ist noch nicht verfügbar.', back: `topic/${topicId}` };
  noteTopic(topic);
  const r = rng();
  const now = Date.now();
  const exs = topic.exercises || [];
  const base = { topicId, back: `topic/${topicId}`, title: topic.title, level: topic.level };
  const dicts = dictationsFromTopic(topic);

  if (mode === 'all') return { ...base, kicker: `Alle ${exs.length} Aufgaben`, items: exs.map((e) => exerciseItem(topicId, e)) };

  if (mode === 'diktat') return { ...base, kind: 'dictation', kicker: 'Diktat', items: r.shuffle(dicts).slice(0, 12).map((d) => dictationItem(d)) };

  if (mode === 'fehler') {
    const scores = store.state.topics?.[topicId]?.ex || {};
    const wrong = exs.filter((e) => scores[e.id] !== undefined && scores[e.id] < 1);
    return { ...base, kicker: 'Nur Fehler', items: r.shuffle(wrong).map((e) => exerciseItem(topicId, e, 'mistake')), empty: 'Keine offenen Fehler in diesem Thema — stark!' };
  }

  if (mode === 'endlos') {
    const drills = drillsForTopic(topicId, topic);
    let round = 0;
    const more = async () => {
      round++;
      const weights = exs.map((e) => exWeight(store, topicId, e, Date.now()));
      const picked = weightedPick(exs, weights, 8, r).map((e) => exerciseItem(topicId, e, 'endless'));
      const extra = [];
      if (drills.length) {
        const gen = generateMixed(drills, { content, n: 3, rng: r, cards: store.state.cards, level: store.settings.level || 'B2' });
        extra.push(...gen.map((g) => drillItem(g, 'drill')));
      }
      if (dicts.length && round % 2 === 1) extra.push(dictationItem(r.pick(dicts)));
      return sprinkle(r.shuffle(picked), extra);
    };
    return { ...base, kicker: 'Endlos-Modus', endless: true, items: await more(), more };
  }

  // smart 20
  const weights = exs.map((e) => exWeight(store, topicId, e, now));
  let picked = weightedPick(exs, weights, Math.min(18, exs.length), r).map((e) => exerciseItem(topicId, e));
  picked.sort(byDifficulty);
  const ds = r.shuffle(dicts).slice(0, Math.min(2, Math.max(0, 20 - picked.length)));
  picked = sprinkle(picked, ds.map((d) => dictationItem(d)));
  return { ...base, kicker: `${picked.length} Aufgaben`, items: picked };
}

// ------------------------------------------------------------------ drills
/** Endless procedural drill. opts: {lvl, tenses:[…]} */
export function drillSource({ content, store, drillId, lvl, tenses }) {
  const meta = DRILL_META.find((d) => d.id === drillId);
  if (!meta) return { title: drillId, items: [], empty: 'Unbekannter Drill.', back: 'ueben' };
  const r = rng();
  const level = lvl || store.settings.level || 'B2';
  const more = async () => generate(drillId, { content, n: 10, rng: r, cards: store.state.cards, level, tenses: tenses?.length ? tenses : undefined }).map((e) => drillItem(e, 'drill'));
  return more().then((items) => ({
    kind: 'drill', title: meta.title, detektivTitle: meta.detektiv, kicker: `Drill · bis ${level}`, drillId, endless: true, streak: true, items, more, back: 'ueben',
    empty: 'Für diese Auswahl gibt es (noch) keine Aufgaben — sind die Vokabeln schon geladen?',
  }));
}

// ------------------------------------------------------------------ mixed / interleaved practice
/** scope: 'all' | 'level:A2' | 'unit:A1/Verben' | 'topics:id1,id2' */
export function scopeTopics(content, scope = 'all') {
  if (scope.startsWith('level:')) return content.topicsByLevel[scope.slice(6)] || [];
  if (scope.startsWith('unit:')) return content.units[scope.slice(5)] || [];
  if (scope.startsWith('topics:')) return scope.slice(7).split(',').map((id) => content.topicMeta(id)).filter(Boolean);
  const lvl = levelIdx('B2');
  return content.topics.filter((m) => levelIdx(m.level) <= lvl);
}
export function scopeLabel(scope = 'all') {
  if (scope.startsWith('level:')) return `Niveau ${scope.slice(6)}`;
  if (scope.startsWith('unit:')) return scope.slice(5).replace('/', ' · ');
  if (scope.startsWith('topics:')) return 'Auswahl';
  return 'Alles gemischt';
}

export async function mixSource({ content, store, scope = 'all', endless = false }) {
  const metas = scopeTopics(content, scope);
  if (!metas.length) return { title: 'Gemischt', items: [], empty: 'Keine Themen in dieser Auswahl.', back: 'ueben' };
  const r = rng();
  const ids = new Set(metas.map((m) => m.id));
  const drills = DRILL_META.filter((d) => d.topics.some((t) => ids.has(t))).map((d) => d.id);
  const loaded = new Map();
  const getT = async (id) => { if (!loaded.has(id)) { const t = await content.getTopic(id).catch(() => null); if (t) noteTopic(t); loaded.set(id, t); } return loaded.get(id); };
  const more = async () => {
    const out = [];
    // weaker topics are drawn more often
    const tw = metas.map((m) => { const tp = store.state.topics?.[m.id]; return tp ? 0.3 + (1 - (tp.acc ?? 0.5)) : 0.9; });
    for (let i = 0; i < 16; i++) {
      const [m] = weightedPick(metas, tw, 1, r);
      const t = await getT(m.id);
      if (!t?.exercises?.length) continue;
      const w = t.exercises.map((e) => exWeight(store, m.id, e, Date.now()));
      const [e] = weightedPick(t.exercises, w, 1, r);
      if (e && !out.some((x) => x.cardId === srs.cardId.exercise(m.id, e.id))) out.push(exerciseItem(m.id, e, 'mix'));
    }
    if (drills.length) out.push(...generateMixed(r.shuffle(drills).slice(0, 3), { content, n: 4, rng: r, cards: store.state.cards, level: store.settings.level || 'B2' }).map((g) => drillItem(g, 'drill')));
    return r.shuffle(out);
  };
  const items = await more();
  return { title: scopeLabel(scope), kicker: endless ? 'Gemischt · endlos' : 'Gemischte Übung', items, more: endless ? more : null, endless, back: 'ueben' };
}

// ------------------------------------------------------------------ weak spots & mistakes
export async function mistakesSource({ content, store, topic = null }) {
  const ms = store.mistakes({ topic });
  const r = rng();
  const items = [];
  for (const m of ms) {
    if (!m.card) continue;
    const it = await srs.itemForCard(m.card, { content, rng: r }).catch(() => null);
    if (it) items.push({ ...it, source: 'mistake' });
    if (items.length >= 40) break;
  }
  return { title: 'Fehler üben', kicker: `${items.length} offene Fehler`, items: r.shuffle(items), back: 'review', empty: 'Keine offenen Fehler. Sauber!' };
}

export async function weakSource({ content, store }) {
  const weak = store.weakTopics(5);
  const r = rng();
  const items = [];
  for (const w of weak) {
    const t = await content.getTopic(w.id).catch(() => null);
    if (!t) continue;
    noteTopic(t);
    const ws = t.exercises.map((e) => exWeight(store, w.id, e, Date.now()));
    items.push(...weightedPick(t.exercises, ws, 5, r).map((e) => exerciseItem(w.id, e, 'weak')));
    const ds = drillsForTopic(w.id, t);
    if (ds.length) items.push(...generate(r.pick(ds), { content, n: 2, rng: r, cards: store.state.cards, level: store.settings.level || 'B2' }).map((g) => drillItem(g, 'drill')));
  }
  const mist = await mistakesSource({ content, store });
  const have = new Set(items.map((i) => i.cardId));
  items.push(...mist.items.filter((i) => !have.has(i.cardId)).slice(0, 10));
  return { title: 'Schwachstellen', kicker: weak.length ? `${weak.length} schwache Themen + Fehler` : 'Fehler', items: r.shuffle(items), back: 'ueben', empty: 'Noch keine Schwachstellen — übe ein paar Themen, dann weiß der Detektiv mehr.' };
}

// ------------------------------------------------------------------ daily session
export async function dailySource({ content, store }) {
  const r = rng();
  const { items, counts } = await srs.buildDailySession({ content, store, rng: r });
  // a little new grammar every day: if there are few weak exercises, add some from the recommended topic
  if (counts.weak < 4) {
    const next = recommendedTopic();
    const t = next && await content.getTopic(next.id).catch(() => null);
    if (t) {
      noteTopic(t);
      const ws = t.exercises.map((e) => exWeight(store, t.id, e, Date.now()));
      const pick = weightedPick(t.exercises, ws, 6, r).map((e) => exerciseItem(t.id, e, 'next')).sort(byDifficulty);
      items.push(...pick);
      counts.next = pick.length;
      counts.nextTopic = next;
    }
  }
  return { title: 'Heute üben', kicker: 'Tagesübung', items, counts, back: 'home', empty: 'Für heute ist alles erledigt. Lust auf mehr? Probier den Endlos-Modus im Üben-Tab.' };
}

/** Counts for the Home card without building the whole session (cheap). */
export function dailyCounts({ content, store }) {
  const now = Date.now();
  const due = srs.dueCards(store.state.cards, now).length;
  const today = store.today();
  const newLeft = Math.max(0, (store.settings.newWordsPerDay ?? 10) - (today.newWords || 0));
  const newAvail = content.words.length ? newLeft : 0;
  const weak = store.weakTopics(3).length;
  return { due, new: newAvail, weak };
}

// ------------------------------------------------------------------ custom sessions (from other screens)
let pendingCustom = null;
/** Start a session from in-memory items: startCustomSession({title, kicker, items, back}, nav). */
export function startCustomSession(src, nav) {
  pendingCustom = { ...src, items: [...src.items] };
  nav('session/custom', { t: Date.now() });
}
export function takeCustomSession() { const s = pendingCustom; return s; }

// ------------------------------------------------------------------ router → source
export async function buildSource(ctx) {
  const { path, params, query, content, store } = ctx;
  const head = path.split('/')[0];
  if (head === 'practice') return topicSource({ content, store, topicId: params.id, mode: query.m || '20' });
  if (head === 'drill') return drillSource({ content, store, drillId: params.id, lvl: query.lvl, tenses: query.t ? query.t.split(',') : null });
  switch (params.kind) {
    case 'daily': return dailySource({ content, store });
    case 'mix': return mixSource({ content, store, scope: query.scope || 'all', endless: query.endless === '1' });
    case 'weak': return weakSource({ content, store });
    case 'mistakes': return mistakesSource({ content, store, topic: query.topic || null });
    case 'custom': return takeCustomSession() || { title: 'Übung', items: [], empty: 'Diese Übung ist abgelaufen.', back: 'home' };
    default: return { title: 'Übung', items: [], empty: 'Unbekannte Übung.', back: 'home' };
  }
}
export { dictationFrom };
