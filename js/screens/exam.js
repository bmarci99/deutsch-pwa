// Prüfung: adaptive placement test (#/exam/placement, ~30 items A1→B2 → estimated level per area) and a timed
// B2 mock exam (#/exam/mock, 40 items / 45 min → score per unit + recommendations). Own runner on top of
// mountExercise + checkExercise (no per-item feedback, like a real exam). Results: localStorage 'dd.exams'.
import { h, md, esc, icon, pageHeader, sectionHead, bar, ring, levelBadge, isDetektiv, MOTIF, confirmSheet, empty, haptic, reducedMotion, t } from '../ui.js';
import { mountExercise, checkExercise, givenText, expectedText, promptText, TYPE_LABEL } from '../exercises/index.js';
import { wordExercise, makeRng } from '../drills/index.js';
import * as srs from '../srs.js';
import { levelIdx } from '../german.js';
import { topicMastery, MASTERED, noteTopic } from '../progress.js';

const LEVELS = ['A1', 'A2', 'B1', 'B2'];
const RES_KEY = 'dd.exams';
const loadResults = () => { try { return JSON.parse(localStorage.getItem(RES_KEY) || '[]'); } catch { return []; } };
const saveResult = (r) => { try { localStorage.setItem(RES_KEY, JSON.stringify([r, ...loadResults()].slice(0, 20))); } catch { /* ignore */ } };

const AREAS = [
  { id: 'verben', label: 'Verben & Zeiten', units: ['Verben', 'Zeiten', 'Modus', 'Passiv'] },
  { id: 'faelle', label: 'Nomen & Fälle', units: ['Nomen', 'Fälle'] },
  { id: 'praep', label: 'Präpositionen', units: ['Präpositionen'] },
  { id: 'adj', label: 'Adjektive', units: ['Adjektive'] },
  { id: 'satz', label: 'Satzbau & Stil', units: ['Satzbau', 'Stil'] },
  { id: 'wort', label: 'Wortschatz', vocab: true },
];
const PLACEMENT_PER_AREA = 5;
const QUICK = new Set(['choice', 'gap', 'error', 'order']);
const MOCK_TYPES = new Set(['choice', 'gap', 'error', 'order', 'transform', 'translate']);
const MOCK_N = 40;
const MOCK_MS = 45 * 60_000;

export async function render(root, ctx) {
  const kind = ctx.params.kind;
  if (kind === 'placement' || kind === 'mock') {
    root.innerHTML = `<div class="sess"><div class="empty" style="padding-top:30dvh">${icon('exam', { size: 36 })}<p>${isDetektiv() ? 'Beweismaterial wird zusammengestellt …' : 'Prüfung wird vorbereitet …'}</p></div></div>`;
    const all = await ctx.content.loadAllTopics();
    if (!ctx.token()) return;
    for (const tp of Object.values(all)) if (tp) noteTopic(tp);
    return kind === 'placement' ? placement(root, ctx, all) : mock(root, ctx, all);
  }
  return landing(root, ctx);
}

// ====================================================================== landing
function landing(root, ctx) {
  const det = isDetektiv();
  root.appendChild(pageHeader({ title: det ? 'Die große Prüfung' : 'Prüfung', sub: det ? 'Wie weit ist der Detektiv wirklich? Beweise es.' : 'Wo stehst du — und bist du bereit für B2?', back: 'more' }));
  const results = loadResults();
  const lastP = results.find((r) => r.kind === 'placement');
  const lastM = results.find((r) => r.kind === 'mock');

  root.appendChild(examCard({
    ic: 'target', cls: 'c2', title: det ? 'Einstufung: Täterprofil' : 'Einstufungstest',
    sub: `${AREAS.length * PLACEMENT_PER_AREA} Aufgaben · ca. 12 Min · adaptiv A1 → B2`,
    text: 'Passt sich an: richtig → schwerer, falsch → leichter. Ergebnis: dein Niveau pro Bereich (Verben, Fälle, Präpositionen, Adjektive, Satzbau, Wortschatz).',
    last: lastP ? `Zuletzt: ${lastP.overall} · ${fmtDate(lastP.at)}` : null,
    href: '#/exam/placement', cta: 'Test starten',
  }));
  root.appendChild(examCard({
    ic: 'clock', cls: 'c1', title: det ? 'Probe-Verhör B2' : 'B2-Probeprüfung',
    sub: `${MOCK_N} Aufgaben · ${MOCK_MS / 60000} Minuten · Grammatik + Wortschatz`,
    text: 'Gemischt wie in der echten Prüfung, mit Zeitlimit und ohne Hilfe. Bestanden ab 60 %. Danach: Punkte pro Einheit und was du als Nächstes üben solltest.',
    last: lastM ? `Zuletzt: ${lastM.pct} % · ${fmtDate(lastM.at)}` : null,
    href: '#/exam/mock', cta: 'Prüfung beginnen',
  }));

  if (results.length) {
    root.appendChild(h('div', { html: sectionHead('Bisherige Ergebnisse') }));
    const list = h('div.list');
    for (const r of results.slice(0, 8)) {
      list.appendChild(h('div.row',
        h('div.row-ic', { html: icon(r.kind === 'mock' ? 'clock' : 'target', { size: 18 }) }),
        h('div.grow', h('div.row-title', { text: r.kind === 'mock' ? 'B2-Probeprüfung' : 'Einstufungstest' }), h('div.row-sub', { text: `${fmtDate(r.at)} · ${r.correct}/${r.total} richtig` })),
        r.kind === 'mock' ? h('span.badge', { class: r.pct >= 60 ? 'good' : 'bad', text: `${r.pct} %` }) : h('span', { html: levelBadge(r.overall) })));
    }
    root.appendChild(list);
  }
  root.appendChild(h('p.muted.small', { style: { marginTop: '16px' }, text: 'Deine Antworten zählen auch für den Lernfortschritt: Fehler landen im Fehlerheft und in der Wiederholung.' }));
}

function examCard({ ic, cls, title, sub, text, last, href, cta }) {
  return h('div.card.exam-card',
    h('div.card-row', h('div.mode-ic', { class: cls, html: icon(ic, { size: 24 }) }), h('div.grow', h('div.card-title', { text: title }), h('div.card-sub', { text: sub }))),
    h('p.exam-text', { text }),
    last ? h('div.exam-last', { html: `${icon('clock', { size: 14 })} ${esc(last)}` }) : null,
    h('a.btn.btn-primary.btn-block', { href, html: `${icon('play', { size: 18, fill: true })} ${cta}` }));
}
const fmtDate = (ts) => new Date(ts).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });

// ====================================================================== item pools
function pools(ctx, all) {
  const { content } = ctx;
  const byAreaLevel = {}; // areaId → level → [{topicId, ex}]
  const byUnit = {};
  for (const a of AREAS) byAreaLevel[a.id] = { A1: [], A2: [], B1: [], B2: [] };
  for (const m of content.topics) {
    const tp = all[m.id];
    if (!tp?.exercises?.length) continue;
    const area = AREAS.find((a) => a.units?.includes(m.unit));
    for (const ex of tp.exercises) {
      const entry = { topicId: m.id, unit: m.unit, level: m.level, ex };
      if (area && QUICK.has(ex.type)) byAreaLevel[area.id][m.level]?.push(entry);
      if (MOCK_TYPES.has(ex.type)) (byUnit[m.unit] || (byUnit[m.unit] = [])).push(entry);
    }
  }
  return { byAreaLevel, byUnit };
}

function exItem(entry, extra = {}) {
  const cardId = srs.cardId.exercise(entry.topicId, entry.ex.id);
  return { cardId, kind: 'exercise', topicId: entry.topicId, unit: entry.unit, level: entry.level, exercise: { ...entry.ex, card: cardId, topic: entry.topicId }, ...extra };
}
function wordItem(content, lvl, dir, rng, used) {
  const cand = (content.wordsByLevel[lvl] || []).filter((w) => ['noun', 'verb', 'adj'].includes(w.pos) && !used.has(w.key));
  if (!cand.length) return null;
  const w = rng.pick(cand);
  used.add(w.key);
  const exercise = wordExercise(w, dir, { content, rng });
  return exercise ? { cardId: null, kind: 'word', word: w, unit: 'Wortschatz', level: lvl, exercise } : null;
}

// ====================================================================== placement (adaptive)
function placement(root, ctx, all) {
  const { content } = ctx;
  const rng = makeRng(Date.now());
  const { byAreaLevel } = pools(ctx, all);
  const used = new Set();
  const usedWords = new Set();
  const areas = AREAS.filter((a) => a.vocab ? content.words.length : LEVELS.some((l) => byAreaLevel[a.id][l].length))
    .map((a) => ({ ...a, theta: 1, step: 1, n: 0, right: 0, log: [] }));
  const total = areas.length * PLACEMENT_PER_AREA;
  let k = 0;

  function pickFor(area) {
    const L = Math.max(0, Math.min(3, Math.round(area.theta)));
    if (area.vocab) return wordItem(content, LEVELS[L], 'de-en', rng, usedWords) || wordItem(content, 'A1', 'de-en', rng, usedWords);
    // nearest level with material
    for (const d of [0, 1, -1, 2, -2, 3, -3]) {
      const lv = LEVELS[L + d];
      if (!lv) continue;
      const cand = byAreaLevel[area.id][lv].filter((e) => !used.has(`${e.topicId}:${e.ex.id}`));
      if (!cand.length) continue;
      // prefer medium difficulty; spread over topics
      const mid = cand.filter((e) => (e.ex.d || 2) === 2);
      const e = rng.pick(mid.length >= 3 ? mid : cand);
      used.add(`${e.topicId}:${e.ex.id}`);
      return exItem(e);
    }
    return null;
  }

  return runExam(root, ctx, {
    title: isDetektiv() ? 'Einstufung' : 'Einstufungstest', total, timeLimit: 0,
    next() {
      while (k < total) {
        const area = areas[k % areas.length];
        k++;
        const it = pickFor(area);
        if (it) { it.area = area; return it; }
      }
      return null;
    },
    onAnswer(it, res) {
      const a = it.area;
      const s = res.result === 'correct' ? 1 : res.result === 'almost' ? 0.3 : -1;
      a.theta = Math.max(-0.6, Math.min(3.6, a.theta + s * a.step));
      a.step = Math.max(0.3, a.step * 0.7);
      a.n++; if (res.result === 'correct') a.right++;
      a.log.push({ level: it.level, ok: res.result === 'correct' });
    },
    finish(stats) {
      const est = areas.filter((a) => a.n).map((a) => ({ id: a.id, label: a.label, units: a.units, vocab: a.vocab, theta: a.theta, level: thetaLevel(a.theta), right: a.right, n: a.n }));
      const mean = est.reduce((s, a) => s + a.theta, 0) / (est.length || 1);
      const r = { kind: 'placement', at: Date.now(), overall: thetaLevel(mean), theta: mean, correct: stats.correct, total: stats.answered, areas: est.map(({ id, label, theta, level }) => ({ id, label, theta, level })) };
      if (stats.answered) saveResult(r);
      placementResult(root, ctx, r, est, stats);
    },
  });
}
const thetaLevel = (th) => (th < -0.25 ? 'A1' : LEVELS[Math.max(0, Math.min(3, Math.floor(th + 0.25)))]);
const thetaText = (th) => {
  if (th < -0.25) return 'unter A1';
  const i = Math.max(0, Math.min(3, Math.floor(th + 0.25)));
  const frac = th + 0.25 - i;
  return i >= 3 && th > 3.2 ? 'B2 sicher' : frac >= 0.6 && i < 3 ? `${LEVELS[i]} → ${LEVELS[i + 1]}` : LEVELS[i];
};

function placementResult(root, ctx, r, est, stats) {
  const { content } = ctx;
  const det = isDetektiv();
  const v = Math.max(0, Math.min(1, (r.theta + 0.5) / 4));
  const wrap = h('div.exam-result.sess-card',
    det ? h('div', { html: MOTIF.magnifier }) : null,
    h('div.kicker', { style: { justifyContent: 'center' }, text: det ? 'Täterprofil erstellt' : 'Dein Ergebnis' }),
    h('div.er-level', h('span', { html: levelBadge(r.overall) }), thetaText(r.theta) !== r.overall ? h('b', { text: thetaText(r.theta) }) : null),
    h('p.muted', { text: `${stats.correct} von ${stats.answered} richtig · ${Math.max(1, Math.round(stats.ms / 60000))} Min` }),
    h('div', { style: { margin: '6px 0 4px' }, html: scaleBar(v) }),
    det ? h('div.stamp', { text: 'Akte angelegt' }) : null);
  const areasEl = h('div.list.area-list');
  for (const a of est) {
    areasEl.appendChild(h('div.row.area-row',
      h('div.grow', h('div.row-title', { text: a.label }), h('div.row-sub', { text: `${a.right}/${a.n} richtig` })),
      h('div.area-bar', { html: scaleBar(Math.max(0, Math.min(1, (a.theta + 0.5) / 4)), true) }),
      h('span', { html: levelBadge(a.level) })));
  }
  // recommendations: weakest areas → first unmastered topic at/below their level (+1)
  const recs = [];
  for (const a of [...est].filter((x) => !x.vocab).sort((x, y) => x.theta - y.theta)) {
    const maxL = Math.min(3, Math.max(0, Math.round(a.theta)) + 1);
    // the learner's frontier first (unmastered topics at the estimated level), then anything up to one level above
    const target = Math.min(3, Math.max(0, Math.round(a.theta)));
    const m = content.topics.find((tm) => a.units.includes(tm.unit) && levelIdx(tm.level) === target && topicMastery(tm.id) < MASTERED) || content.topics.find((tm) => a.units.includes(tm.unit) && levelIdx(tm.level) <= maxL && topicMastery(tm.id) < MASTERED);
    if (m && !recs.some((x) => x.id === m.id)) recs.push({ ...m, why: a.label });
    if (recs.length >= 3) break;
  }
  const actions = h('div.sum-actions',
    h('a.btn.btn-primary.btn-lg', { href: '#/path', html: `${icon('path', { size: 18 })} Zum Lernpfad` }),
    h('a.btn.btn-ghost', { href: '#/exam', text: 'Fertig' }));
  const body = root.querySelector('.sess-body') || root;
  body.replaceChildren(...[wrap,
    h('div', { html: sectionHead('Niveau pro Bereich') }), areasEl,
    recs.length ? h('div', { html: sectionHead(det ? 'Nächste Spuren' : 'Empfehlungen') }) : null,
    recs.length ? recList(recs) : null,
    actions].filter(Boolean));
  window.scrollTo({ top: 0 });
}

function scaleBar(v, compact = false) {
  return `<div class="lvl-scale${compact ? ' compact' : ''}"><div class="ls-track">${bar(v)}</div>${compact ? '' : `<div class="ls-labels">${LEVELS.map((l) => `<span>${l}</span>`).join('')}</div>`}</div>`;
}
function recList(recs) {
  return h('div.list', recs.map((m) => h('a.row', { href: `#/topic/${m.id}` },
    h('div', { html: levelBadge(m.level) }),
    h('div.grow', h('div.row-title', { text: m.title }), h('div.row-sub', { text: m.why })),
    h('span', { html: icon('chevron', { size: 18 }), style: { color: 'var(--muted-2)' } }))));
}

// ====================================================================== mock exam
function mock(root, ctx, all) {
  const { content } = ctx;
  const rng = makeRng(Date.now());
  const { byUnit } = pools(ctx, all);
  const want = { A2: 6, B1: 13, B2: 13 };
  const items = [];
  const seen = new Set();
  // grammar: spread across units, weighted toward B1/B2
  const flat = Object.values(byUnit).flat();
  for (const [lv, n] of Object.entries(want)) {
    const cand = rng.shuffle(flat.filter((e) => e.level === lv && (e.ex.d || 2) >= (lv === 'A2' ? 2 : 1)));
    const perUnit = {};
    for (const e of cand) {
      if (items.filter((x) => x.level === lv).length >= n) break;
      const key = `${e.topicId}:${e.ex.id}`;
      if (seen.has(key) || (perUnit[e.unit] || 0) >= Math.ceil(n / 4) || items.some((x) => x.topicId === e.topicId)) continue;
      seen.add(key); perUnit[e.unit] = (perUnit[e.unit] || 0) + 1;
      items.push(exItem(e));
    }
  }
  // vocab: 8 items (B1/B2), half recognise, half produce
  const usedWords = new Set();
  for (let i = 0; i < MOCK_N - items.length && i < 8; i++) {
    const it = wordItem(content, i % 2 ? 'B2' : 'B1', i < 4 ? 'de-en' : 'en-de', rng, usedWords);
    if (it) items.push(it);
  }
  // top up with B1/B2 grammar if the content was thin
  for (const e of rng.shuffle(flat.filter((x) => levelIdx(x.level) >= 2))) {
    if (items.length >= MOCK_N) break;
    const key = `${e.topicId}:${e.ex.id}`;
    if (!seen.has(key)) { seen.add(key); items.push(exItem(e)); }
  }
  // grammar easy → hard, vocabulary spread evenly through the paper
  const gram = rng.shuffle(items.filter((x) => x.kind !== 'word')).sort((a, b) => (a.exercise.d || 2) - (b.exercise.d || 2));
  const voc = items.filter((x) => x.kind === 'word');
  const order = [...gram];
  voc.forEach((v, i) => order.splice(Math.round(((i + 1) * order.length) / (voc.length + 1)) + i, 0, v));
  let k = 0;
  const answers = [];

  return runExam(root, ctx, {
    title: isDetektiv() ? 'Probe-Verhör B2' : 'B2-Probeprüfung', total: order.length, timeLimit: MOCK_MS,
    next: () => (k < order.length ? order[k++] : null),
    onAnswer(it, res, given) { answers.push({ it, res, given }); },
    finish(stats) {
      // unanswered items (time over / aborted) count as wrong
      const answeredSet = new Set(answers.map((a) => a.it));
      for (const it of order) if (!answeredSet.has(it)) answers.push({ it, res: { result: 'wrong', score: 0 }, given: '', skipped: true });
      const total = order.length;
      const pts = answers.reduce((s, a) => s + (a.res.result === 'correct' ? 1 : a.res.result === 'almost' ? 0.5 : 0), 0);
      const pct = Math.round((pts / Math.max(1, total)) * 100);
      const units = {};
      for (const a of answers) {
        const u = units[a.it.unit] || (units[a.it.unit] = { unit: a.it.unit, pts: 0, n: 0, wrongTopics: new Map() });
        u.n++; u.pts += a.res.result === 'correct' ? 1 : a.res.result === 'almost' ? 0.5 : 0;
        if (a.res.result !== 'correct' && a.it.topicId) u.wrongTopics.set(a.it.topicId, (u.wrongTopics.get(a.it.topicId) || 0) + 1);
      }
      const r = { kind: 'mock', at: Date.now(), pct, correct: answers.filter((a) => a.res.result === 'correct').length, total, ms: stats.ms, units: Object.values(units).map((u) => ({ unit: u.unit, pct: Math.round((u.pts / u.n) * 100) })) };
      if (stats.answered) saveResult(r);
      mockResult(root, ctx, r, Object.values(units), answers, stats);
    },
  });
}

function mockResult(root, ctx, r, units, answers, stats) {
  const { content } = ctx;
  const det = isDetektiv();
  const passed = r.pct >= 60;
  const mins = Math.max(1, Math.round(stats.ms / 60000));
  const wrap = h('div.exam-result.sess-card',
    h('div', { html: ring(r.pct / 100, { size: 132, stroke: 12, label: `${r.pct}%`, sub: passed ? 'bestanden' : 'noch nicht', color: passed ? 'var(--good)' : r.pct >= 45 ? 'var(--warn)' : 'var(--bad)' }) }),
    h('h1', { text: passed ? (det ? (r.pct >= 90 ? 'Es gibt nur eine Wahrheit!' : 'Fall gelöst!') : 'Bestanden!') : det ? 'Die Ermittlungen gehen weiter' : 'Noch nicht ganz' }),
    h('p.muted', { text: `${r.correct}/${r.total} richtig · ${mins} Min${stats.timeUp ? ' · Zeit abgelaufen' : ''}` }),
    det ? h('div.stamp', { class: passed ? '' : 'open', text: passed ? 'Gelöst' : 'Offen' }) : null);

  const list = h('div.list.area-list');
  for (const u of [...units].sort((a, b) => a.pts / a.n - b.pts / b.n)) {
    const p = u.pts / u.n;
    list.appendChild(h('div.row.area-row',
      h('div.grow', h('div.row-title', { text: u.unit }), h('div.row-sub', { text: `${u.pts % 1 ? u.pts.toFixed(1) : u.pts}/${u.n} Punkte` })),
      h('div.area-bar', { html: bar(p, { color: p >= 0.8 ? 'var(--good)' : p >= 0.6 ? 'var(--accent)' : 'var(--warn)' }) }),
      h('span.area-pct', { text: `${Math.round(p * 100)} %` })));
  }
  // recommendations: topics with the most wrong answers in the weakest units
  const recs = [];
  for (const u of [...units].sort((a, b) => a.pts / a.n - b.pts / b.n)) {
    for (const [id] of [...u.wrongTopics.entries()].sort((a, b) => b[1] - a[1])) {
      const m = content.topicMeta(id);
      if (m && !recs.some((x) => x.id === id)) recs.push({ ...m, why: `${u.unit} · ${Math.round((u.pts / u.n) * 100)} %` });
      if (recs.length >= 5) break;
    }
    if (recs.length >= 5) break;
  }
  const wrong = answers.filter((a) => a.res.result !== 'correct');
  const review = h('div.list.sum-mistakes');
  for (const a of wrong.slice(0, 40)) {
    review.appendChild(h('div.mistake',
      h('div.m-prompt', { lang: 'de', html: md(promptText(a.it.exercise)) }),
      a.skipped ? h('div.m-given', { style: { textDecoration: 'none', color: 'var(--muted)' }, text: '(nicht beantwortet)' }) : a.given ? h('div.m-given', { text: a.given }) : null,
      h('div.m-exp', { text: `✓ ${expectedText(a.it.exercise).replace(/\*\*|==/g, '')}` })));
  }
  const body = root.querySelector('.sess-body') || root;
  body.replaceChildren(...[wrap,
    h('div', { html: sectionHead('Punkte pro Einheit') }), list,
    recs.length ? h('div', { html: sectionHead(det ? 'Nächste Spuren' : 'Das solltest du üben') }) : null,
    recs.length ? recList(recs) : null,
    wrong.length ? h('div', { html: sectionHead(`Fehler (${wrong.length})`) }) : null,
    wrong.length ? review : null,
    h('div.sum-actions',
      wrong.some((a) => a.it.cardId) ? h('a.btn.btn-primary.btn-lg', { href: '#/session/mistakes', html: `${icon('repeat', { size: 18 })} Fehler üben` }) : null,
      h('a.btn.btn-secondary.btn-lg', { href: '#/exam', text: 'Zur Übersicht' }))].filter(Boolean));
  window.scrollTo({ top: 0 });
  if (passed && r.pct >= 90 && !reducedMotion()) haptic('success');
}

// ====================================================================== exam runner
/**
 * cfg: {title, total, timeLimit (ms, 0 = none), next() → item|null, onAnswer(item, res, given, ms), finish(stats)}
 * No feedback per item. Answers are recorded with kind 'exam'.
 */
function runExam(root, ctx, cfg) {
  const { store, nav } = ctx;
  let answered = 0, correct = 0, ctl = null, current = null, startedAt = 0, done = false, timer = 0, locked = false;
  const t0 = Date.now();
  const closeBtn = h('button.icon-btn.sess-close', { type: 'button', 'aria-label': 'Abbrechen', html: icon('close') });
  const pbarWrap = h('div', { style: { flex: 1 }, html: bar(0) });
  const clock = h('div.exam-clock', { hidden: !cfg.timeLimit });
  const countEl = h('div.sess-count');
  const top = h('div.sess-top', closeBtn, pbarWrap, clock, countEl);
  const titleEl = h('div.sess-title', { html: `<span>${esc(cfg.title)}</span>` });
  const body = h('div.sess-body');
  const foot = h('div.sess-foot');
  root.replaceChildren(h('div.sess', top, titleEl, body));
  document.body.appendChild(foot);

  closeBtn.onclick = async () => {
    if (done) return nav('exam');
    if (!answered) return nav('exam');
    const ok = await confirmSheet({ title: 'Prüfung beenden?', text: cfg.timeLimit ? 'Offene Aufgaben zählen als falsch. Du bekommst trotzdem eine Auswertung.' : 'Du bekommst eine Auswertung mit den bisherigen Antworten.', ok: 'Beenden & auswerten', cancel: 'Weitermachen' });
    if (ok) end(false);
  };

  if (cfg.timeLimit) {
    const tick = () => {
      const left = Math.max(0, cfg.timeLimit - (Date.now() - t0));
      const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
      clock.innerHTML = `${icon('clock', { size: 15 })}<span>${m}:${String(s).padStart(2, '0')}</span>`;
      clock.classList.toggle('low', left < 5 * 60000);
      if (left <= 0) end(true);
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  function show() {
    if (done) return;
    current = cfg.next();
    if (!current) return end(false);
    if (window.__dd) window.__dd.sessionItem = current; // debug / smoke tests
    pbarWrap.innerHTML = bar(answered / cfg.total);
    countEl.textContent = `${Math.min(answered + 1, cfg.total)}/${cfg.total}`;
    const ex = current.exercise;
    try { ctl?.destroy?.(); } catch { /* ignore */ }
    try { ctl = mountExercise(ex, { submit: () => submit(false), changed: upd }); } catch (e) { console.error(e); return show(); }
    const kind = h('div.ex-kind', { html: `${esc(TYPE_LABEL[ex.type] || '')}${current.level ? ` · ${levelBadge(current.level)}` : ''}` });
    body.replaceChildren(h('div.sess-card', kind, ctl.el));
    const skip = h('button.btn.btn-ghost', { type: 'button', text: 'Überspringen', style: { flex: 'none', paddingInline: '12px' }, onclick: () => submit(true) });
    const go = h('button.btn.btn-primary.btn-lg', { type: 'button', text: 'Weiter', onclick: () => submit(false) });
    foot.replaceChildren(...[skip, ctl.auto ? null : go].filter(Boolean));
    if (ctl.auto) skip.style.flex = '1';
    upd();
    locked = false;
    startedAt = Date.now();
    if (!('ontouchstart' in window)) { const mine = ctl; setTimeout(() => { if (ctl === mine && !locked && !done) ctl.focus?.(); }, reducedMotion() ? 0 : 300); }
    window.scrollTo({ top: 0 });
  }
  function upd() { const b = foot.querySelector('.btn-primary'); if (b && ctl) b.disabled = !ctl.canSubmit(); }

  function submit(skip) {
    if (locked || done || !ctl || !current) return;
    if (!skip && !ctl.canSubmit()) return;
    locked = true;
    const ex = current.exercise;
    const response = ctl.response();
    let res;
    try { res = skip ? { result: 'wrong', score: 0 } : checkExercise(ex, response); } catch (e) { console.error(e); res = { result: 'wrong', score: 0 }; }
    const ms = Date.now() - startedAt;
    const given = skip ? '(übersprungen)' : givenText(ex, response);
    answered++; if (res.result === 'correct') correct++;
    if (current.cardId) {
      try {
        store.recordAttempt({ id: current.cardId, card: current.cardId, topic: current.topicId, exId: ex.id, kind: 'exam', result: res.result, score: res.score, given, expected: expectedText(ex).replace(/\*\*|==/g, ''), prompt: promptText(ex), why: ex.why, ms });
      } catch (e) { console.error(e); }
    }
    cfg.onAnswer(current, res, given, ms);
    haptic();
    // a tiny pause so a tapped option registers visually
    setTimeout(show, ctl.auto && !skip ? 220 : 60);
  }

  function end(timeUp) {
    if (done) return;
    done = true;
    clearInterval(timer);
    try { ctl?.destroy?.(); } catch { /* ignore */ }
    foot.replaceChildren();
    foot.remove();
    pbarWrap.innerHTML = bar(1);
    countEl.textContent = '';
    clock.hidden = true;
    titleEl.innerHTML = `<span>${esc(cfg.title)} · Auswertung</span>`;
    cfg.finish({ answered, correct, ms: Date.now() - t0, timeUp });
  }

  // Enter = Weiter (inputs handle their own Enter via submit hook)
  const onKey = (e) => { if (e.key === 'Enter' && !e.isComposing && !e.target.matches?.('input, textarea') && !done) { const b = foot.querySelector('.btn-primary'); if (b && !b.disabled) { e.preventDefault(); b.click(); } } };
  document.addEventListener('keydown', onKey);
  show();
  return () => { done = true; clearInterval(timer); document.removeEventListener('keydown', onKey); try { ctl?.destroy?.(); } catch { /* ignore */ } foot.remove(); };
}
void empty; void t;
