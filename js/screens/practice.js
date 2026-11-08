// Üben (practice hub): endless per topic, interleaved mixes (unit / level / everything), Schwachstellen,
// and every procedural drill with a level filter (conjugation gets a tense picker).
import { h, esc, icon, sheet, segmented, isDetektiv, levelBadge, sectionHead, pageHeader, masteryColor, ring, num } from '../ui.js';
import { DRILL_META, drillProgress, drillItems } from '../drills/index.js';
import { levelIdx } from '../german.js';
import { topicMastery } from '../progress.js';
import { cast } from '../cast.js';

const UI_KEY = 'dd.ui.practice';
const loadUi = () => { try { return JSON.parse(localStorage.getItem(UI_KEY) || '{}'); } catch { return {}; } };
const saveUi = (o) => { try { localStorage.setItem(UI_KEY, JSON.stringify({ ...loadUi(), ...o })); } catch { /* ignore */ } };

const TENSES = [
  { id: 'pres', label: 'Präsens' }, { id: 'prt', label: 'Präteritum' }, { id: 'perf', label: 'Perfekt' },
  { id: 'fut', label: 'Futur I' }, { id: 'k2', label: 'Konjunktiv II' }, { id: 'imp', label: 'Imperativ' },
];

export function render(root, ctx) {
  const { content, store, nav } = ctx;
  const det = isDetektiv();
  const ui = loadUi();
  let level = ui.level || store.settings.level || 'B2';

  root.appendChild(pageHeader({ title: det ? 'Ermitteln' : 'Üben', sub: det ? 'Jeder Fall macht dich schärfer. Wähle deine Ermittlung.' : 'Üben bis zum Umfallen: endlos, gemischt, gezielt.' }));

  // ---- modes
  const weak = store.weakTopics(5);
  const nMist = store.mistakes().length;
  if (det) root.appendChild(cast.bubble('drill'));
  root.appendChild(modeCard('c1', 'infinity', 'Endlos-Modus', 'Ein Thema, endlos: alle Aufgaben SRS-gewichtet, dann Drills & Diktate.', () => pickTopic(ctx)));
  root.appendChild(modeCard('c2', 'shuffle', det ? 'Gemischte Ermittlung' : 'Gemischt üben', 'Interleaving: Themen durcheinander — nach Einheit, Niveau oder alles.', () => pickMix(ctx)));
  root.appendChild(modeCard('c3', 'target', 'Schwachstellen', weak.length || nMist ? `${weak.length} schwache Themen · ${nMist} offene Fehler` : 'Deine schwächsten Themen und Fehler — sobald es welche gibt.', () => nav('session/weak')));
  root.appendChild(modeCard('c4', 'headphones', 'Diktat', 'Hören → schreiben, Sätze aus einem Thema.', () => pickTopic(ctx, 'diktat')));

  // ---- weakest topics quick list
  if (weak.length) {
    root.appendChild(h('div', { html: sectionHead('Schwächste Themen') }));
    const list = h('div.list');
    for (const w of weak) {
      const m = content.topicMeta(w.id); if (!m) continue;
      list.appendChild(h('a.row.weak-row', { href: `#/practice/${w.id}?m=endlos` },
        h('div.grow', h('div.row-title', { text: m.title }), h('div.row-sub', { html: `${levelBadge(m.level)} ${w.attempts} Antworten` })),
        h('span.acc', { text: `${Math.round(w.acc * 100)} %` }), h('span', { html: icon('chevron', { size: 18 }), style: { color: 'var(--muted-2)' } })));
    }
    root.appendChild(list);
  }

  // ---- drills
  root.appendChild(h('div', { html: sectionHead(det ? 'Fallakten-Drills' : 'Drills', '<span class="muted small">unbegrenzt · SRS</span>') }));
  const seg = segmented(['A1', 'A2', 'B1', 'B2'].map((l) => ({ value: l, label: `bis ${l}` })), level, (v) => { level = v; saveUi({ level: v }); drawDrills(); });
  root.appendChild(seg);
  const grid = h('div.drill-grid', { style: { marginTop: '12px' } });
  root.appendChild(grid);
  const prog = drillProgress(store.state.cards);

  function drawDrills() {
    grid.replaceChildren();
    for (const d of DRILL_META) {
      const locked = levelIdx(d.level) > levelIdx(level);
      let n = 0;
      try { n = locked ? 0 : drillItems(d.id, { content, level }).length; } catch { n = 0; }
      const st = store.state.drills?.[d.id];
      const acc = st?.attempts ? Math.round((st.correct / st.attempts) * 100) : null;
      const p = prog[d.id] || { seen: 0, due: 0 };
      const card = h('button.card.tap.drill-card', { type: 'button', class: locked ? 'locked' : '', style: { textAlign: 'left', font: 'inherit', color: 'inherit' } },
        h('div.d-case', { text: d.detektiv }),
        h('div.d-title', { text: d.title }),
        h('div.d-en', { text: d.en }),
        h('div.d-foot', h('span', { html: locked ? `ab ${esc(d.level)}` : `${num(n)} Items` }), h('span', { html: acc != null ? `${acc} % · ${p.due ? `${p.due} fällig` : `${p.seen} gesehen`}` : levelBadge(d.level) })));
      card.addEventListener('click', () => {
        const lvl = locked ? d.level : level;
        if (d.id === 'conjugation') return pickTenses(ctx, lvl);
        nav(`drill/${d.id}`, { lvl });
      });
      grid.appendChild(card);
    }
  }
  drawDrills();
  if (!content.words.length) root.appendChild(h('p.muted.small', { style: { marginTop: '12px' }, text: 'Hinweis: Drills, die Vokabeln brauchen (Genus, Plural …), nutzen einen kleinen Reserve-Wortschatz, bis die Vokabeldateien geladen sind.' }));
}

function modeCard(cls, ic, title, sub, onClick) {
  return h('button.card.tap.mode-card', { type: 'button', style: { width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit' }, onclick: onClick },
    h('div.mode-ic', { class: cls, html: icon(ic, { size: 24 }) }),
    h('div.grow', h('div.card-title', { text: title }), h('div.card-sub', { text: sub })),
    h('span', { style: { color: 'var(--muted-2)' }, html: icon('chevron', { size: 18 }) }));
}

/** Topic picker sheet (levels → topics) for endless / dictation. */
function pickTopic(ctx, mode = 'endlos') {
  const { content, nav } = ctx;
  const body = h('div');
  let lv = 'A1';
  const list = h('div.list', { style: { marginTop: '12px' } });
  const draw = () => {
    list.replaceChildren(...(content.topicsByLevel[lv] || []).map((m) => {
      const v = topicMastery(m.id);
      return h('button.row', { type: 'button', onclick: () => { s.close(); nav(`practice/${m.id}`, { m: mode }); } },
        h('div', { html: ring(v, { size: 36, stroke: 4, label: `${Math.round(v * 100)}`, color: masteryColor(v) }) }),
        h('div.grow', h('div.row-title', { text: m.title }), h('div.row-sub', { text: m.en })));
    }));
  };
  body.appendChild(segmented(['A1', 'A2', 'B1', 'B2'].map((l) => ({ value: l, label: l })), lv, (v) => { lv = v; draw(); }));
  body.appendChild(list);
  draw();
  const s = sheet({ title: mode === 'diktat' ? 'Diktat: Thema wählen' : 'Endlos: Thema wählen', body });
}

/** Mix picker: everything / by level / by unit. */
function pickMix(ctx) {
  const { content, nav } = ctx;
  let endless = true;
  const body = h('div');
  const go = (scope) => { s.close(); nav('session/mix', { scope, endless: endless ? '1' : '' }); };
  body.appendChild(segmented([{ value: '1', label: 'Endlos' }, { value: '0', label: '20 Aufgaben' }], '1', (v) => { endless = v === '1'; }));
  body.appendChild(h('div.list', { style: { marginTop: '12px' } },
    h('button.row', { type: 'button', onclick: () => go('all') }, h('div.row-ic', { html: icon('shuffle', { size: 18 }) }), h('div.grow', h('div.row-title', { text: 'Alles gemischt' }), h('div.row-sub', { text: 'Alle Themen A1–B2' })))));
  body.appendChild(h('div.unit-title', { text: 'Nach Niveau' }));
  body.appendChild(h('div.chip-wrap', ['A1', 'A2', 'B1', 'B2'].map((l) => h('button.chip', { type: 'button', onclick: () => go(`level:${l}`), html: `${levelBadge(l)} ${content.topicsByLevel[l]?.length || 0} Themen` }))));
  body.appendChild(h('div.unit-title', { text: 'Nach Einheit' }));
  const ul = h('div.list');
  for (const [key, metas] of Object.entries(content.units)) {
    const [lv, name] = key.split('/');
    ul.appendChild(h('button.row', { type: 'button', onclick: () => go(`unit:${key}`) },
      h('div', { html: levelBadge(lv) }), h('div.grow', h('div.row-title', { text: name }), h('div.row-sub', { text: metas.map((m) => m.title).join(' · ').slice(0, 80) + '…' }))));
  }
  body.appendChild(ul);
  const s = sheet({ title: 'Gemischt üben', body });
}

/** Tense picker for the conjugation drill. */
function pickTenses(ctx, lvl) {
  const sel = new Set(loadUi().tenses || ['pres', 'prt', 'perf']);
  const body = h('div');
  body.appendChild(h('p.sheet-text', { text: 'Welche Zeitformen willst du üben?' }));
  const chips = h('div.chip-wrap');
  for (const tn of TENSES) {
    const c = h('button.chip', { type: 'button', 'aria-pressed': String(sel.has(tn.id)), text: tn.label });
    c.onclick = () => { sel.has(tn.id) ? sel.delete(tn.id) : sel.add(tn.id); c.setAttribute('aria-pressed', String(sel.has(tn.id))); };
    chips.appendChild(c);
  }
  body.appendChild(chips);
  sheet({
    title: 'Konjugation', body,
    actions: [{ label: 'Alle', onClick: (close) => { close(); ctx.nav('drill/conjugation', { lvl }); } },
      { label: 'Start', primary: true, onClick: (close) => { if (!sel.size) return; saveUi({ tenses: [...sel] }); close(); ctx.nav('drill/conjugation', { lvl, t: [...sel].join(',') }); } }],
  });
}
