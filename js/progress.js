// Derived progress figures for the UI (mastery per topic/unit/level, recommended next topic, B2 plan).
// Exercise counts come from loaded topic files; until they are loaded we estimate 40 per topic.
import { store } from './store.js';

export const TARGET = { level: 'B2', date: new Date(2027, 1, 28), label: 'Feb 2027' };
export const MASTERED = 0.8;
const EST_EXERCISES = 40;
const counts = new Map(); // topicId → number of exercises

let content = null;
let allLoaded = null;
export function initProgress(c) { content = c; }

/** Load every topic file in the background (dist: counts come with the curriculum) so counts are exact. Resolves once. */
export function loadAllTopicsInBackground() {
  if (!content) return Promise.resolve();
  if (!allLoaded) {
    // dist: the curriculum already carries exact counts (`n`), so there is nothing to load
    if (content.topics.length && content.topics.every((t) => Number.isFinite(t.n))) return (allLoaded = Promise.resolve());
    allLoaded = content.loadAllTopics().then((all) => {
      for (const [id, t] of Object.entries(all || {})) if (t) counts.set(id, (t.exercises || []).length);
    }).catch(() => {});
  }
  return allLoaded;
}
export function noteTopic(topic) { if (topic?.id) counts.set(topic.id, (topic.exercises || []).length); }
export const exerciseCount = (id) => counts.get(id) ?? content?.topicMeta(id)?.n ?? EST_EXERCISES;

/** 0..1 */
export function topicMastery(id) { return store.topicMastery(id, exerciseCount(id)); }

/** Average mastery over a list of topic metas. */
export function avgMastery(metas) {
  if (!metas?.length) return 0;
  return metas.reduce((s, m) => s + topicMastery(m.id), 0) / metas.length;
}

export function levelMastery(level) { return avgMastery(content?.topicsByLevel?.[level] || []); }

/** Overall progress toward B2 = average mastery over all curriculum topics. */
export function overallMastery() { return avgMastery(content?.topics || []); }

/** First topic (curriculum order) that is not yet mastered; prefers one already started. */
export function recommendedTopic() {
  if (!content) return null;
  const level = store.settings.level || 'B2';
  const LV = ['A1', 'A2', 'B1', 'B2'];
  const metas = content.topics.filter((m) => LV.indexOf(m.level) <= LV.indexOf(level));
  return metas.find((m) => topicMastery(m.id) < MASTERED) || null;
}

/** The topic touched most recently (for "continue where you left off"). */
export function lastTopic() {
  let best = null;
  for (const [id, tp] of Object.entries(store.state.topics || {})) {
    if (!content?.topicMeta(id)) continue;
    if (!best || (tp.lastAt || 0) > best.lastAt) best = { id, lastAt: tp.lastAt || 0 };
  }
  return best ? { ...content.topicMeta(best.id), lastAt: best.lastAt, mastery: topicMastery(best.id) } : null;
}

/**
 * Plan toward B2 by the target date. Linear schedule from the day the app was first used.
 * → {mastered, total, remaining, weeksLeft, perWeek, expected, onTrack, status:'ahead'|'on'|'behind', overall}
 */
export function plan(now = Date.now()) {
  const metas = content?.topics || [];
  const total = metas.length || 1;
  const mastered = metas.filter((m) => topicMastery(m.id) >= MASTERED).length;
  const overall = overallMastery();
  const start = Math.min(store.state.createdAt || now, now);
  const end = TARGET.date.getTime();
  const weeksLeft = Math.max(0, (end - now) / (7 * 86_400_000));
  const elapsed = Math.max(0, Math.min(1, (now - start) / Math.max(1, end - start)));
  const expected = elapsed; // fraction of the curriculum that should be done by now
  const remaining = total - mastered;
  const perWeek = weeksLeft > 0 ? remaining / weeksLeft : remaining;
  const progress = Math.max(overall, mastered / total);
  const status = progress >= expected + 0.05 ? 'ahead' : progress >= expected - 0.05 ? 'on' : 'behind';
  return { mastered, total, remaining, weeksLeft, perWeek, expected, overall, progress, onTrack: status !== 'behind', status };
}
