// Persistent progress store. localStorage key 'dd.v1' (falls back to memory if storage is unavailable).
// Usage: import { store } from './store.js'; store.on('change', fn); store.recordAttempt({...});
import { newCard, review, gradeFromResult, parseCardId, cardId as makeCardId, DAY } from './srs.js';

export const STORAGE_KEY = 'dd.v1';
export const SCHEMA_VERSION = 1;
export const MAX_ATTEMPTS = 5000;
export const XP = { correct: 10, almost: 6, wrong: 1, lessonRead: 15 };

export const DEFAULT_SETTINGS = {
  theme: 'klassisch',        // 'klassisch' | 'detektiv'
  colorScheme: 'auto',       // 'auto' | 'light' | 'dark'
  ttsRate: 0.9,              // 0.5 … 1.5
  ttsVoice: null,            // voiceURI or null = best available
  autoplayAudio: true,
  dailyGoal: 100,            // XP per day
  newWordsPerDay: 10,
  umlautBar: true,
  level: 'B2',               // max level for new words / drills
};

/** Local calendar day 'YYYY-MM-DD'. */
export function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function prevDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1, 12).getTime());
}

export function emptyState(now = Date.now()) {
  return {
    v: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    settings: { ...DEFAULT_SETTINGS },
    xp: 0,
    streak: { current: 0, best: 0, lastDay: null },
    days: {},        // 'YYYY-MM-DD' → {xp, answers, correct, almost, wrong, newWords, ms, goalMet}
    topics: {},      // topicId → {attempts, correct, acc, ex:{exId: lastScore}, lessonRead, best, lastAt, sessions}
    cards: {},       // cardId → SRS card
    attempts: [],    // [{t, id, card, topic, kind, result, given, ms}] newest last, ≤ MAX_ATTEMPTS
    mistakes: {},    // itemId → {id, card, topic, kind, prompt, given, expected, why, count, firstAt, lastAt, streak, resolved}
    drills: {},      // drillId → {attempts, correct, lastAt}
  };
}

/** Bring an older / partial state up to the current schema. */
export function migrate(raw, now = Date.now()) {
  const base = emptyState(now);
  if (!raw || typeof raw !== 'object') return base;
  const s = { ...base, ...raw };
  s.settings = { ...DEFAULT_SETTINGS, ...(raw.settings || {}) };
  s.streak = { ...base.streak, ...(raw.streak || {}) };
  for (const k of ['days', 'topics', 'cards', 'mistakes', 'drills']) if (!s[k] || typeof s[k] !== 'object' || Array.isArray(s[k])) s[k] = {};
  if (!Array.isArray(s.attempts)) s.attempts = [];
  if (s.attempts.length > MAX_ATTEMPTS) s.attempts = s.attempts.slice(-MAX_ATTEMPTS);
  if (typeof s.xp !== 'number') s.xp = 0;
  s.v = SCHEMA_VERSION;
  return s;
}

function defaultStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const ls = window.localStorage, k = '__dd_test__';
    ls.setItem(k, '1'); ls.removeItem(k);
    return ls;
  } catch { return null; }
}

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

/**
 * createStore({storage, key, now, debounceMs}) — storage defaults to localStorage (memory fallback).
 */
export function createStore(opts = {}) {
  const key = opts.key || STORAGE_KEY;
  const now = opts.now || (() => Date.now());
  const debounceMs = opts.debounceMs ?? 400;
  let storage = opts.storage !== undefined ? opts.storage : defaultStorage();
  const persistent = !!storage;
  if (!storage) storage = memoryStorage();

  let state;
  try { const raw = storage.getItem(key); state = migrate(raw ? JSON.parse(raw) : null, now()); }
  catch { state = emptyState(now()); }

  const listeners = new Map();
  const emit = (ev, data) => { for (const fn of listeners.get(ev) || []) { try { fn(data, api); } catch (e) { console.error(e); } } };
  let timer = null;

  function save() {
    timer = null;
    state.updatedAt = now();
    try { storage.setItem(key, JSON.stringify(state)); emit('saved', state.updatedAt); }
    catch (e) {
      // quota: trim the attempts log and retry once
      try { state.attempts = state.attempts.slice(-1000); storage.setItem(key, JSON.stringify(state)); }
      catch (e2) { emit('error', e2); }
    }
  }
  function changed(what) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, debounceMs);
    emit('change', what);
  }
  function flush() { if (timer) { clearTimeout(timer); save(); } }

  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('pagehide', flush);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  }

  function day(k = dayKey(now())) {
    if (!state.days[k]) state.days[k] = { xp: 0, answers: 0, correct: 0, almost: 0, wrong: 0, newWords: 0, ms: 0, goalMet: false };
    return state.days[k];
  }

  function touchStreak() {
    const today = dayKey(now());
    const st = state.streak;
    if (st.lastDay === today) return;
    st.current = st.lastDay === prevDay(today) ? st.current + 1 : 1;
    st.best = Math.max(st.best, st.current);
    st.lastDay = today;
    emit('streak', { ...st });
  }

  function addXp(n) {
    if (!n) return;
    const d = day();
    const wasMet = d.goalMet;
    state.xp += n; d.xp += n;
    touchStreak();
    if (!wasMet && d.xp >= state.settings.dailyGoal) { d.goalMet = true; emit('goal', { xp: d.xp, goal: state.settings.dailyGoal }); }
    emit('xp', { gained: n, total: state.xp, today: d.xp });
  }

  const api = {
    get state() { return state; },
    get settings() { return state.settings; },
    get persistent() { return persistent; },

    on(ev, fn) { if (!listeners.has(ev)) listeners.set(ev, new Set()); listeners.get(ev).add(fn); return () => listeners.get(ev).delete(fn); },
    off(ev, fn) { listeners.get(ev)?.delete(fn); },
    flush,

    setSetting(k, v) {
      if (!(k in DEFAULT_SETTINGS)) throw new Error(`unknown setting ${k}`);
      state.settings[k] = v;
      changed('settings');
      emit('settings', { key: k, value: v, settings: state.settings });
    },
    setSettings(obj) { for (const [k, v] of Object.entries(obj)) if (k in DEFAULT_SETTINGS) state.settings[k] = v; changed('settings'); emit('settings', { settings: state.settings }); },

    // ------------------------------------------------ SRS cards
    getCard(id) { return state.cards[id] || null; },
    setCard(card) { state.cards[card.id] = card; changed('cards'); },
    removeCard(id) { delete state.cards[id]; changed('cards'); },
    /** Grade a card directly (flashcard self-grading). Returns the updated card. */
    gradeCard(id, grade) {
      const t = now();
      const prev = state.cards[id] || newCard(id, t);
      const wasNew = prev.state === 'new';
      const card = review(prev, grade, t);
      state.cards[id] = card;
      if (wasNew && id.startsWith('w:') && id.endsWith('|de-en')) day().newWords += 1;
      // a word that graduated de→en gets its en→de card
      if (id.startsWith('w:') && id.endsWith('|de-en') && card.state === 'review') {
        const p = parseCardId(id);
        const rev = makeCardId.word(p.wordKey, 'en-de');
        if (!state.cards[rev]) state.cards[rev] = { ...newCard(rev, t), state: 'review', s: 1, d: card.d, due: t + DAY, last: t };
      }
      changed('cards');
      emit('card', card);
      return card;
    },

    /**
     * Record one answered item. a = {
     *   id: unique item id (e.g. 'a2-dative/e05', or the card id), card?: SRS card id to update,
     *   topic?: topicId, drill?: drillId, kind?: 'exercise'|'word'|'drill'|'exam',
     *   result: 'correct'|'almost'|'wrong', score?: 0..1, given?, expected?, prompt?, why?, ms?, grade?: 1..4 (override)
     * }
     * → {xp, card|null, grade}
     */
    recordAttempt(a) {
      const t = now();
      const result = a.result;
      const score = a.score ?? (result === 'correct' ? 1 : result === 'almost' ? 0.5 : 0);
      const d = day();
      d.answers += 1; d[result] = (d[result] || 0) + 1; d.ms += a.ms || 0;

      state.attempts.push({ t, id: a.id, card: a.card, topic: a.topic, drill: a.drill, kind: a.kind, result, score, given: a.given, ms: a.ms });
      if (state.attempts.length > MAX_ATTEMPTS) state.attempts.splice(0, state.attempts.length - MAX_ATTEMPTS);

      if (a.topic) {
        const tp = state.topics[a.topic] || (state.topics[a.topic] = { attempts: 0, correct: 0, acc: 0.5, ex: {}, lessonRead: false, best: 0, lastAt: 0, sessions: 0 });
        tp.attempts += 1; if (result === 'correct') tp.correct += 1;
        tp.acc = tp.attempts === 1 ? score : tp.acc + 0.15 * (score - tp.acc);
        const exId = a.exId || (a.card && a.card.startsWith('ex:') ? parseCardId(a.card).exId : null);
        if (exId) tp.ex[exId] = score;
        tp.lastAt = t;
      }
      if (a.drill) {
        const dr = state.drills[a.drill] || (state.drills[a.drill] = { attempts: 0, correct: 0, lastAt: 0 });
        dr.attempts += 1; if (result === 'correct') dr.correct += 1; dr.lastAt = t;
      }

      // mistakes notebook
      const mid = a.id || a.card;
      if (mid) {
        const m = state.mistakes[mid];
        if (result !== 'correct') {
          state.mistakes[mid] = {
            id: mid, card: a.card, topic: a.topic, drill: a.drill, kind: a.kind, prompt: a.prompt ?? m?.prompt, given: a.given,
            expected: a.expected ?? m?.expected, why: a.why ?? m?.why, count: (m?.count || 0) + 1, firstAt: m?.firstAt || t, lastAt: t, streak: 0, resolved: false,
          };
        } else if (m && !m.resolved) {
          m.streak += 1; m.lastAt = t;
          if (m.streak >= 2) m.resolved = true;
        }
      }

      // SRS: content exercises answered correctly at first sight are not scheduled
      let card = null;
      const grade = a.grade ?? gradeFromResult(result, { fast: false });
      if (a.card && !(a.card.startsWith('ex:') && !state.cards[a.card] && result === 'correct')) card = api.gradeCard(a.card, grade);

      const xp = XP[result] || 0;
      addXp(xp);
      changed('attempt');
      emit('attempt', { ...a, t, xp, card });
      return { xp, card, grade };
    },

    // ------------------------------------------------ topics
    topicStats(id) { return state.topics[id] || null; },
    /** Mastery 0..1 = sum of the last score of each distinct exercise / number of exercises in the topic. */
    topicMastery(id, totalExercises) {
      const tp = state.topics[id];
      if (!tp) return 0;
      const sum = Object.values(tp.ex).reduce((s, x) => s + x, 0);
      const n = totalExercises || Object.keys(tp.ex).length || 1;
      return Math.min(1, sum / n);
    },
    markLessonRead(id) {
      const tp = state.topics[id] || (state.topics[id] = { attempts: 0, correct: 0, acc: 0.5, ex: {}, lessonRead: false, best: 0, lastAt: 0, sessions: 0 });
      if (!tp.lessonRead) { tp.lessonRead = true; addXp(XP.lessonRead); }
      tp.lastAt = now();
      changed('topics');
    },
    /** Call at the end of a practice run. score 0..1. */
    finishSession({ topic, score = 0, ms = 0 } = {}) {
      if (topic) {
        const tp = state.topics[topic];
        if (tp) { tp.sessions += 1; tp.best = Math.max(tp.best, score); }
      }
      changed('session');
      emit('session', { topic, score, ms });
    },
    /** Topics with ≥3 attempts and accuracy < 0.8, weakest first: [{id, acc, attempts}] */
    weakTopics(n = 5) {
      return Object.entries(state.topics)
        .filter(([, t]) => t.attempts >= 3 && t.acc < 0.8)
        .sort((a, b) => a[1].acc - b[1].acc)
        .slice(0, n)
        .map(([id, t]) => ({ id, acc: t.acc, attempts: t.attempts }));
    },

    // ------------------------------------------------ mistakes
    /** Open mistakes, newest first. opts.all includes resolved ones. */
    mistakes({ all = false, topic = null } = {}) {
      return Object.values(state.mistakes).filter((m) => (all || !m.resolved) && (!topic || m.topic === topic)).sort((a, b) => b.lastAt - a.lastAt);
    },
    resolveMistake(id) { if (state.mistakes[id]) { state.mistakes[id].resolved = true; changed('mistakes'); } },
    deleteMistake(id) { delete state.mistakes[id]; changed('mistakes'); },

    // ------------------------------------------------ stats
    today() { return day(); },
    dayStats(k) { return state.days[k] || null; },
    /** Last n days, oldest first: [{day, xp, answers, correct, ...}] (zeros for empty days). */
    history(n = 30) {
      const out = [];
      let k = dayKey(now());
      for (let i = 0; i < n; i++) { out.push({ day: k, ...(state.days[k] || { xp: 0, answers: 0, correct: 0, almost: 0, wrong: 0, newWords: 0, ms: 0, goalMet: false }) }); k = prevDay(k); }
      return out.reverse();
    },
    /** Current streak (0 if the last active day is before yesterday). */
    streak() {
      const st = state.streak, today = dayKey(now());
      const alive = st.lastDay === today || st.lastDay === prevDay(today);
      return { current: alive ? st.current : 0, best: st.best, lastDay: st.lastDay, activeToday: st.lastDay === today };
    },
    cardCounts(t = now()) {
      let due = 0, learning = 0, review_ = 0, total = 0;
      for (const c of Object.values(state.cards)) { total++; if (c.state === 'learning' || c.state === 'relearning') learning++; else if (c.state === 'review') review_++; if (c.state !== 'new' && c.due <= t) due++; }
      return { due, learning, review: review_, total };
    },

    // ------------------------------------------------ persistence
    async persist() {
      try { if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch { /* ignore */ }
      return false;
    },
    export() { flush(); return JSON.stringify({ app: 'deutsch-detektiv', exportedAt: now(), ...state }); },
    /** Replace progress with an exported JSON (string or object). mode 'replace' (default) | 'merge' (keeps newer cards). */
    import(json, { mode = 'replace' } = {}) {
      const raw = typeof json === 'string' ? JSON.parse(json) : json;
      if (!raw || typeof raw !== 'object' || (raw.v && raw.v > SCHEMA_VERSION)) throw new Error('Not a valid progress file');
      const incoming = migrate(raw, now());
      delete incoming.app; delete incoming.exportedAt;
      if (mode === 'merge') {
        for (const [id, c] of Object.entries(incoming.cards)) if (!state.cards[id] || (c.last || 0) > (state.cards[id].last || 0)) state.cards[id] = c;
        for (const [k, d] of Object.entries(incoming.days)) if (!state.days[k] || d.xp > state.days[k].xp) state.days[k] = d;
        for (const [k, tp] of Object.entries(incoming.topics)) if (!state.topics[k] || tp.lastAt > state.topics[k].lastAt) state.topics[k] = tp;
        Object.assign(state.mistakes, incoming.mistakes);
        state.attempts = [...state.attempts, ...incoming.attempts].sort((a, b) => a.t - b.t).slice(-MAX_ATTEMPTS);
        state.xp = Math.max(state.xp, incoming.xp);
        if (incoming.streak.best > state.streak.best) state.streak.best = incoming.streak.best;
      } else state = incoming;
      save();
      emit('change', 'import');
      emit('settings', { settings: state.settings });
      return true;
    },
    reset() { state = emptyState(now()); save(); emit('change', 'reset'); emit('settings', { settings: state.settings }); },
  };
  return api;
}

/** App-wide singleton. */
export const store = createStore();
