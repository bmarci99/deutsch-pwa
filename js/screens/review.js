// Wiederholung: due counts (by kind), 14-day forecast, "review now" (due cards only), mistakes notebook.
import { h, md, esc, icon, pageHeader, segmented, sectionHead, empty, isDetektiv, levelBadge, toast, confirmSheet, num } from '../ui.js';
import * as srs from '../srs.js';
import { startCustomSession } from '../sources.js';
import { makeRng } from '../drills/index.js';
import { cast } from '../cast.js';

const DAY = 86_400_000;
const KIND = { w: { label: 'Vokabeln', ic: 'vocab' }, ex: { label: 'Grammatik', ic: 'book' }, dr: { label: 'Drills', ic: 'bolt' } };
const PAGE = 25;

export function render(root, ctx) {
  const { content, store, nav } = ctx;
  const det = isDetektiv();
  let mode = 'open';
  let topicFilter = '';
  let shown = PAGE;

  const draw = () => {
    const now = Date.now();
    const cards = Object.values(store.state.cards);
    const counts = store.cardCounts(now);
    const due = srs.dueCards(cards, now);
    const dueBy = { w: 0, ex: 0, dr: 0 };
    for (const c of due) { const k = c.id.split(':')[0]; if (k in dueBy) dueBy[k]++; }
    root.replaceChildren();
    root.appendChild(pageHeader({ title: det ? 'Offene Akten' : 'Wiederholung', sub: det ? 'Was der Detektiv vergisst, holt ihn wieder ein.' : 'Spaced Repetition: wiederholen, kurz bevor du vergisst.', back: 'more' }));
    if (det) root.appendChild(cast.bubble('review'));

    // ---- hero
    const hero = h('section.review-hero',
      h('div.rh-main',
        h('div.rh-num', { text: num(due.length) }),
        h('div.rh-lab', { text: due.length === 1 ? 'Karte fällig' : 'Karten fällig' })),
      h('div.rh-kinds', Object.entries(KIND).map(([k, m]) => h('div.rh-kind', { html: `${icon(m.ic, { size: 16 })}<b>${dueBy[k]}</b><span>${m.label}</span>` }))),
      h('button.btn.btn-lg.btn-block.btn-hero', {
        type: 'button', disabled: !due.length,
        html: due.length ? `${icon('play', { size: 18, fill: true })} ${det ? 'Akten neu aufrollen' : 'Jetzt wiederholen'}` : `${icon('check', { size: 18 })} Alles erledigt`,
        onclick: () => reviewNow(ctx, due),
      }));
    root.appendChild(hero);
    root.appendChild(h('div.grid3',
      stat(counts.learning, 'lernen'), stat(counts.review, 'im Langzeit­gedächtnis'), stat(counts.total, 'Karten gesamt')));

    // ---- forecast
    root.appendChild(h('div', { html: sectionHead('Vorschau · 14 Tage') }));
    const days = [];
    const start = new Date(); start.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) days.push({ t0: start.getTime() + i * DAY, n: 0 });
    for (const c of cards) {
      if (c.state === 'new') continue;
      const idx = c.due <= now ? 0 : Math.floor((c.due - start.getTime()) / DAY);
      if (idx >= 0 && idx < 14) days[idx].n++;
    }
    const max = Math.max(1, ...days.map((d) => d.n));
    const fc = h('div.card.forecast',
      h('div.fc-bars', days.map((d, i) => {
        const dt = new Date(d.t0);
        const lab = dt.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '').slice(0, 2);
        return h('div.fc-col', { title: `${dt.toLocaleDateString('de-DE')}: ${d.n}` },
          h('span.fc-n', { text: d.n ? String(d.n) : '' }),
          h('div.fc-bar', { class: i === 0 ? 'today' : '', style: { height: `${Math.max(d.n ? 6 : 2, (d.n / max) * 100)}%` } }),
          h('span.fc-d', { class: i === 0 ? 'today' : '', text: lab }));
      })),
      h('p.muted.small', { style: { margin: '10px 0 0' }, text: `Diese Woche: ${days.slice(0, 7).reduce((s, d) => s + d.n, 0)} Wiederholungen · nächste Woche: ${days.slice(7).reduce((s, d) => s + d.n, 0)}` }));
    root.appendChild(fc);

    // ---- mistakes notebook
    const all = store.mistakes({ all: true });
    const open = all.filter((m) => !m.resolved);
    root.appendChild(h('div', { html: sectionHead(det ? 'Offene Spuren' : 'Fehlerheft', `<span class="muted small">${open.length} offen · ${all.length - open.length} erledigt</span>`) }));
    if (!all.length) {
      root.appendChild(empty(det ? 'Noch keine falschen Fährten. Der Fall ist sauber.' : 'Noch keine Fehler gesammelt. Jeder Fehler landet hier — und kommt wieder, bis er sitzt.', { ic: 'target' }));
      return;
    }
    root.appendChild(h('button.btn.btn-primary.btn-block.btn-lg', {
      type: 'button', disabled: !open.length, style: { marginBottom: '12px' },
      html: `${icon('target', { size: 18 })} ${topicFilter ? 'Fehler dieses Themas üben' : 'Alle Fehler üben'} (${(topicFilter ? open.filter((m) => m.topic === topicFilter) : open).length})`,
      onclick: () => nav('session/mistakes', topicFilter ? { topic: topicFilter } : null),
    }));
    root.appendChild(segmented([{ value: 'open', label: `Offen (${open.length})` }, { value: 'all', label: `Alle (${all.length})` }], mode, (v) => { mode = v; shown = PAGE; draw(); }));
    // topic chips (only topics that have mistakes)
    const byTopic = new Map();
    for (const m of (mode === 'open' ? open : all)) if (m.topic) byTopic.set(m.topic, (byTopic.get(m.topic) || 0) + 1);
    if (byTopic.size > 1) {
      const chips = h('div.chips', { style: { marginTop: '10px' } },
        h('button.chip', { type: 'button', class: topicFilter ? '' : 'on', text: 'Alle Themen', onclick: () => { topicFilter = ''; shown = PAGE; draw(); } }),
        [...byTopic.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => {
          const tm = content.topicMeta(id);
          return h('button.chip', { type: 'button', class: topicFilter === id ? 'on' : '', html: `${tm ? levelBadge(tm.level) : ''} ${esc(shortTitle(tm?.title || id))} <span class="muted">${n}</span>`, onclick: () => { topicFilter = id; shown = PAGE; draw(); } });
        }));
      root.appendChild(chips);
    }
    let list = mode === 'open' ? open : all;
    if (topicFilter) list = list.filter((m) => m.topic === topicFilter);
    const box = h('div.mistake-list');
    for (const m of list.slice(0, shown)) box.appendChild(mistakeCard(m));
    root.appendChild(box);
    if (list.length > shown) root.appendChild(h('button.btn.btn-ghost.btn-block', { type: 'button', text: `${list.length - shown} weitere anzeigen`, onclick: () => { shown += PAGE * 2; draw(); } }));
    if (all.length - open.length > 0) root.appendChild(h('button.btn.btn-ghost.btn-block', {
      type: 'button', style: { color: 'var(--muted)' }, text: 'Erledigte Fehler löschen',
      onclick: async () => { if (await confirmSheet({ title: 'Erledigte Fehler löschen?', text: `${all.length - open.length} erledigte Einträge werden aus dem Fehlerheft entfernt.`, ok: 'Löschen', danger: true })) { for (const m of all) if (m.resolved) store.deleteMistake(m.id); draw(); } },
    }));
  };

  function mistakeCard(m) {
    const tm = m.topic ? content.topicMeta(m.topic) : null;
    const src = tm ? tm.title : m.drill ? `Drill · ${m.drill}` : m.kind === 'word' ? 'Vokabel' : m.kind === 'exam' ? 'Prüfung' : '';
    const why = m.why ? h('div.mk-why', { hidden: true, html: md(m.why) }) : null;
    const card = h('div.card.mk', { class: m.resolved ? 'resolved' : '' },
      h('div.mk-top',
        h('div.mk-src', { html: `${tm ? levelBadge(tm.level) : ''}<span>${esc(shortTitle(src))}</span>` }),
        m.count > 1 ? h('span.badge.bad', { text: `${m.count}×` }) : null,
        m.resolved ? h('span.badge.good', { html: `${icon('check', { size: 12 })} erledigt` }) : null),
      m.prompt ? h('div.mk-prompt', { lang: 'de', html: md(m.prompt) }) : null,
      m.given ? h('div.mk-given', { lang: 'de', text: m.given }) : null,
      m.expected ? h('div.mk-exp', { lang: 'de', html: `${icon('check', { size: 15 })}<span>${esc(m.expected)}</span>` }) : null,
      why,
      h('div.mk-actions',
        why ? h('button.btn.btn-sm.btn-ghost', { type: 'button', html: `${icon('info', { size: 15 })} Warum?`, onclick: (e) => { why.hidden = !why.hidden; e.currentTarget.classList.toggle('on', !why.hidden); } }) : null,
        h('span.grow'),
        !m.resolved ? h('button.btn.btn-sm.btn-tinted', { type: 'button', html: `${icon('check', { size: 15 })} Sitzt`, onclick: () => { store.resolveMistake(m.id); toast('Als erledigt markiert', { icon: 'check', type: 'good' }); draw(); } }) : null,
        h('button.icon-btn', { type: 'button', 'aria-label': 'Löschen', style: { color: 'var(--muted)' }, html: icon('x', { size: 18 }), onclick: () => { store.deleteMistake(m.id); draw(); } })));
    return card;
  }

  draw();
  const off = store.on('change', (what) => { if (what === 'import' || what === 'reset') draw(); });
  return () => off();
}

const stat = (n, label) => h('div.mini-stat', h('b', { text: num(n) }), h('span', { text: label }));
const shortTitle = (s) => (s && s.length > 34 ? s.slice(0, 32) + '…' : s || '');

/** Session with just the due cards (no new words), most-forgotten first. */
async function reviewNow(ctx, due) {
  const { content, nav } = ctx;
  const rng = makeRng(Date.now());
  const items = [];
  for (const c of due.slice(0, 80)) {
    const it = await srs.itemForCard(c.id, { content, rng }).catch(() => null);
    if (it) items.push({ ...it, source: 'due' });
  }
  if (!items.length) { toast('Nichts Fälliges gefunden.', { icon: 'info' }); return; }
  startCustomSession({ title: isDetektiv() ? 'Offene Akten' : 'Wiederholung', kicker: `${items.length} fällige Karten`, kind: 'due', items, back: 'review' }, nav);
}
