// Statistik: KPIs, 12-week heatmap, accuracy by level → unit → topic, weakest topics (practise buttons),
// words learned per level, drill accuracy.
import { h, esc, icon, pageHeader, segmented, sectionHead, bar, ring, levelBadge, isDetektiv, num, toast, masteryColor, empty } from '../ui.js';
import { DRILL_META } from '../drills/index.js';
import { topicMastery, levelMastery, loadAllTopicsInBackground } from '../progress.js';

const LEVELS = ['A1', 'A2', 'B1', 'B2'];
const UI_KEY = 'dd.ui.stats';
const loadUi = () => { try { return JSON.parse(localStorage.getItem(UI_KEY) || '{}'); } catch { return {}; } };
const saveUi = (o) => { try { localStorage.setItem(UI_KEY, JSON.stringify({ ...loadUi(), ...o })); } catch { /* ignore */ } };

export function render(root, ctx) {
  const { content, store } = ctx;
  let level = loadUi().level || 'A1';
  const draw = () => {
    const det = isDetektiv();
    root.replaceChildren();
    root.appendChild(pageHeader({ title: det ? 'Ermittlungsbericht' : 'Statistik', sub: det ? 'Alle Beweise über deinen Fortschritt.' : 'Wie du lernst — und wo es noch hakt.', back: 'more' }));
    const st = store.streak();
    const days = Object.values(store.state.days || {});
    const answers = days.reduce((s, d) => s + (d.answers || 0), 0);
    const correct = days.reduce((s, d) => s + (d.correct || 0), 0);
    const ms = days.reduce((s, d) => s + (d.ms || 0), 0);
    const cards = Object.values(store.state.cards);
    const wordCards = cards.filter((c) => c.id.startsWith('w:') && c.id.endsWith('|de-en') && c.state !== 'new');
    const learned = wordCards.filter((c) => c.state === 'review').length;

    // ---- KPIs
    root.appendChild(h('div.kpi-grid',
      kpi('bolt', num(store.state.xp), 'XP gesamt'),
      kpi('flame', `${st.current}`, `Serie · Rekord ${st.best || 0}`),
      kpi('check', answers ? `${Math.round((correct / answers) * 100)} %` : '–', `Treffer · ${num(answers)} Antworten`),
      kpi('vocab', num(learned), `Wörter gelernt · ${num(wordCards.length)} begonnen`),
      kpi('clock', fmtDuration(ms), 'Lernzeit'),
      kpi('target', `${days.filter((d) => d.goalMet).length}`, 'Tage mit Tagesziel')));

    // ---- heatmap
    root.appendChild(h('div', { html: sectionHead('Letzte 12 Wochen') }));
    root.appendChild(heatmap(store));

    // ---- levels
    root.appendChild(h('div', { html: sectionHead('Nach Niveau') }));
    const perTopic = store.state.topics || {};
    const lvList = h('div.list');
    for (const lv of LEVELS) {
      const metas = content.topicsByLevel[lv] || [];
      let att = 0, cor = 0;
      for (const m of metas) { const tp = perTopic[m.id]; if (tp) { att += tp.attempts; cor += tp.correct; } }
      const mast = levelMastery(lv);
      lvList.appendChild(h('div.row.lv-row',
        h('div', { html: levelBadge(lv) }),
        h('div.grow', h('div.lv-bars', h('div', { html: bar(mast, { color: masteryColor(mast) }) })), h('div.row-sub', { text: `${Math.round(mast * 100)} % gemeistert · ${att ? `${Math.round((cor / att) * 100)} % Treffer` : 'noch nicht geübt'}${att ? ` · ${num(att)} Antworten` : ''}` }))));
    }
    root.appendChild(lvList);

    // ---- units / topics of one level
    root.appendChild(h('div', { html: sectionHead('Einheiten & Themen') }));
    root.appendChild(segmented(LEVELS.map((l) => ({ value: l, label: l })), level, (v) => { level = v; saveUi({ level: v }); drawUnits(); }));
    const unitsBox = h('div', { style: { marginTop: '10px' } });
    root.appendChild(unitsBox);
    const drawUnits = () => {
      unitsBox.replaceChildren();
      const metas = content.topicsByLevel[level] || [];
      const units = [];
      for (const m of metas) { let u = units.find((x) => x.name === m.unit); if (!u) units.push(u = { name: m.unit, topics: [] }); u.topics.push(m); }
      for (const u of units) {
        let att = 0, cor = 0;
        for (const m of u.topics) { const tp = perTopic[m.id]; if (tp) { att += tp.attempts; cor += tp.correct; } }
        unitsBox.appendChild(h('div.unit-title', { html: `${esc(u.name)}<span class="ut-right">${att ? `${Math.round((cor / att) * 100)} % Treffer` : '–'}</span>` }));
        unitsBox.appendChild(h('div.list', u.topics.map((m) => {
          const tp = perTopic[m.id];
          const v = topicMastery(m.id);
          return h('a.row.st-topic', { href: `#/topic/${m.id}` },
            h('div', { html: ring(v, { size: 38, stroke: 4, label: `${Math.round(v * 100)}`, color: masteryColor(v) }) }),
            h('div.grow', h('div.row-title', { text: m.title }), h('div.row-sub', { text: tp ? `${tp.attempts} Antworten · ${tp.sessions || 0} Übungen${tp.lessonRead ? ' · Lektion gelesen' : ''}` : 'noch nicht geübt' })),
            h('span.acc', { class: tp ? accClass(tp.acc) : '', text: tp ? `${Math.round((tp.acc ?? 0) * 100)} %` : '' }));
        })));
      }
    };
    drawUnits();

    // ---- weakest
    const weak = store.weakTopics(6);
    root.appendChild(h('div', { html: sectionHead(det ? 'Verdächtige Schwachstellen' : 'Schwächste Themen', weak.length ? '<a href="#/session/weak">Alle üben</a>' : '') }));
    if (!weak.length) root.appendChild(empty('Noch keine Schwachstellen — dafür braucht ein Thema mindestens 3 Antworten unter 80 %.', { ic: 'target' }));
    else {
      const wl = h('div.list');
      for (const w of weak) {
        const m = content.topicMeta(w.id);
        if (!m) continue;
        wl.appendChild(h('div.row.weak-row',
          h('div.grow', h('div.row-title', { text: m.title }), h('div.row-sub', { html: `${levelBadge(m.level)} ${w.attempts} Antworten · <b class="${accClass(w.acc)}">${Math.round(w.acc * 100)} %</b>` })),
          h('a.btn.btn-sm.btn-tinted', { href: `#/practice/${w.id}?m=fehler`, text: 'Fehler' }),
          h('a.btn.btn-sm.btn-primary', { href: `#/practice/${w.id}?m=endlos`, html: icon('infinity', { size: 18 }), 'aria-label': 'Endlos üben' })));
      }
      root.appendChild(wl);
    }

    // ---- words per level
    root.appendChild(h('div', { html: sectionHead('Wortschatz') }));
    const learnedKeys = new Map(wordCards.map((c) => [c.id.slice(2, c.id.lastIndexOf('|')), c.state]));
    const wb = h('div.card.words-card');
    for (const lv of LEVELS) {
      const list = content.wordsByLevel[lv] || [];
      let l = 0, s = 0;
      for (const w of list) { const stt = learnedKeys.get(w.key); if (stt === 'review') l++; else if (stt) s++; }
      wb.appendChild(h('div.wl-row',
        h('div', { html: levelBadge(lv) }),
        h('div.grow', h('div.stack-bar', h('i.sb-l', { style: { width: `${list.length ? (l / list.length) * 100 : 0}%` } }), h('i.sb-s', { style: { width: `${list.length ? (s / list.length) * 100 : 0}%` } }))),
        h('span.wl-n', { text: `${num(l)}/${num(list.length)}` })));
    }
    wb.appendChild(h('div.legend', { html: '<span><i class="sb-l"></i>gelernt</span><span><i class="sb-s"></i>in Arbeit</span>' }));
    root.appendChild(wb);

    // ---- drills
    const drills = DRILL_META.map((d) => ({ d, s: store.state.drills?.[d.id] })).filter((x) => x.s?.attempts);
    if (drills.length) {
      root.appendChild(h('div', { html: sectionHead('Drills') }));
      root.appendChild(h('div.list', drills.sort((a, b) => a.s.correct / a.s.attempts - b.s.correct / b.s.attempts).map(({ d, s }) => {
        const acc = s.correct / s.attempts;
        return h('a.row', { href: `#/drill/${d.id}` },
          h('div.grow', h('div.row-title', { text: det ? d.detektiv : d.title }), h('div.row-sub', { text: `${num(s.attempts)} Antworten` })),
          h('div', { style: { width: '72px' }, html: bar(acc, { cls: 'thin', color: masteryColor(acc) }) }),
          h('span.acc', { class: accClass(acc), text: `${Math.round(acc * 100)} %` }));
      })));
    }
  };
  draw();
  let alive = true;
  loadAllTopicsInBackground().then(() => { if (alive && ctx.token()) { const y = window.scrollY; draw(); window.scrollTo(0, y); } });
  return () => { alive = false; };
}

const accClass = (a) => (a >= 0.8 ? 'acc-good' : a >= 0.6 ? 'acc-mid' : 'acc-bad');
const kpi = (ic, val, label) => h('div.kpi', h('div.kpi-ic', { html: icon(ic, { size: 16, fill: ic === 'flame' || ic === 'bolt' }) }), h('b', { text: val }), h('span', { text: label }));
function fmtDuration(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} Min`;
  return `${(m / 60).toFixed(1).replace('.', ',')} Std`;
}

/** 12 weeks × 7 days (Mon–Sun), current week last. Intensity relative to the daily goal. */
function heatmap(store) {
  const goal = store.settings.dailyGoal || 100;
  const now = new Date();
  const wd = (now.getDay() + 6) % 7; // Mon = 0
  const past = 77 + wd + 1;           // 11 full weeks + this week up to today
  const hist = store.history(past);
  const cells = [...hist, ...Array.from({ length: 6 - wd }, () => null)];
  const lvl = (d) => (!d || !d.xp ? 0 : d.xp >= goal ? 4 : d.xp >= goal * 0.5 ? 3 : d.xp >= goal * 0.2 ? 2 : 1);
  const grid = h('div.heat-grid', { role: 'img', 'aria-label': 'Aktivität der letzten 12 Wochen' });
  const months = h('div.heat-months');
  let lastMonth = -1;
  for (let w = 0; w < 12; w++) {
    const first = cells[w * 7];
    const dt = first ? new Date(first.day + 'T12:00') : null;
    const m = dt ? dt.getMonth() : -1;
    months.appendChild(h('span', { text: m !== lastMonth && dt ? dt.toLocaleDateString('de-DE', { month: 'short' }).replace('.', '') : '' }));
    if (m >= 0) lastMonth = m;
    const col = h('div.heat-col');
    for (let d = 0; d < 7; d++) {
      const c = cells[w * 7 + d];
      const isToday = c && w * 7 + d === hist.length - 1;
      col.appendChild(h('button.heat-cell', {
        type: 'button', class: `h${lvl(c)}${c ? '' : ' future'}${isToday ? ' today' : ''}`, disabled: !c, tabindex: '-1',
        'aria-label': c ? `${c.day}: ${c.xp} XP` : '',
        onclick: () => c && toast(`${new Date(c.day + 'T12:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}: **${c.xp} XP** · ${c.answers} Antworten${c.goalMet ? ' · Ziel ✓' : ''}`, { icon: 'calendar', ms: 2000 }),
      }));
    }
    grid.appendChild(col);
  }
  const week = hist.slice(-7);
  const wk = { xp: week.reduce((s, d) => s + d.xp, 0), ans: week.reduce((s, d) => s + d.answers, 0), goals: week.filter((d) => d.goalMet).length };
  return h('div.card.heat',
    months,
    h('div.heat-body', h('div.heat-days', ['Mo', '', 'Mi', '', 'Fr', '', 'So'].map((x) => h('span', { text: x }))), grid),
    h('div.heat-foot',
      h('span.muted.small', { text: `7 Tage: ${num(wk.xp)} XP · ${num(wk.ans)} Antworten · Ziel an ${wk.goals}/7 Tagen` }),
      h('div.heat-legend', { html: `<span>weniger</span>${[0, 1, 2, 3, 4].map((i) => `<i class="heat-cell h${i}"></i>`).join('')}<span>mehr</span>` })));
}
