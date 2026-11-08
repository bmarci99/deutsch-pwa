// Lernpfad: levels → units → topics with mastery rings. Everything is open; the recommended next topic is highlighted.
import { h, esc, icon, ring, bar, segmented, isDetektiv, levelBadge, masteryColor } from '../ui.js';
import { topicMastery, levelMastery, recommendedTopic, loadAllTopicsInBackground, MASTERED } from '../progress.js';

export function render(root, ctx) {
  const { content } = ctx;
  const draw = () => {
    const det = isDetektiv();
    const rec = recommendedTopic();
    const levels = content.levels.length ? content.levels : ['A1', 'A2', 'B1', 'B2'].map((id) => ({ id, title: id, en: '' }));
    root.replaceChildren();
    const tabs = segmented(levels.map((l) => ({ value: l.id, label: l.id })), rec?.level || 'A1', (v) => {
      document.getElementById(`lvl-${v}`)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    });
    root.appendChild(h('div.level-tabs', tabs));
    root.appendChild(h('header.page-head', h('div.page-head-text',
      h('h1', { text: det ? 'Fallakten' : 'Lernpfad' }),
      h('p.page-sub', { text: `${content.topics.length} Themen von A1 bis B2 — alles ist offen. ${det ? 'Die rot markierte Akte ist dein aktueller Fall.' : 'Markiert: dein nächster Schritt.'}` }))));

    for (const lv of levels) {
      const metas = content.topicsByLevel[lv.id] || [];
      const lm = levelMastery(lv.id);
      const done = metas.filter((m) => topicMastery(m.id) >= MASTERED).length;
      const sec = h('section.level-sec', { id: `lvl-${lv.id}` });
      sec.appendChild(h('div.level-head',
        h('div', { html: ring(lm, { size: 52, stroke: 6, label: lv.id, color: masteryColor(lm) }) }),
        h('div.grow', h('h2', { text: lv.title || lv.id }), h('p', { text: `${lv.en ? lv.en + ' · ' : ''}${done}/${metas.length} gemeistert · ${Math.round(lm * 100)} %` }))));
      // group by unit, keep curriculum order
      const units = [];
      for (const m of metas) { let u = units.find((x) => x.name === m.unit); if (!u) units.push(u = { name: m.unit, topics: [] }); u.topics.push(m); }
      for (const u of units) {
        const um = u.topics.reduce((s, m) => s + topicMastery(m.id), 0) / u.topics.length;
        sec.appendChild(h('div.unit-title', { html: `${esc(u.name)} <span style="float:right;font-weight:600;letter-spacing:0">${Math.round(um * 100)} %</span>` }));
        const list = h('div.list');
        for (const m of u.topics) {
          const v = topicMastery(m.id);
          const cls = [rec && rec.id === m.id ? 'next' : '', v >= MASTERED ? 'done' : ''].join(' ');
          list.appendChild(h('a.topic-row', { href: `#/topic/${m.id}`, class: cls, id: `t-${m.id}` },
            h('div', { html: ring(v, { size: 44, stroke: 5, label: v >= MASTERED ? '✓' : `${Math.round(v * 100)}`, color: masteryColor(v) }) }),
            h('div.grow', h('div.t-title', { text: m.title }), h('div.t-en', { text: m.en })),
            h('span.chev', { style: { color: 'var(--muted-2)' }, html: icon('chevron', { size: 18 }) })));
        }
        sec.appendChild(list);
      }
      root.appendChild(sec);
    }
    // a unit-mix shortcut at the bottom
    root.appendChild(h('a.card.tap', { href: '#/ueben', style: { marginTop: '22px' }, html: `<div class="card-row"><div class="mode-ic c2">${icon('shuffle', { size: 22 })}</div><div class="grow"><div class="card-title">Gemischt üben</div><div class="card-sub">Nach Einheit, Niveau oder alles durcheinander</div></div>${icon('chevron', { size: 18 })}</div>` }));
    void bar;
  };
  draw();
  let alive = true;
  loadAllTopicsInBackground().then(() => { if (alive && ctx.token()) { const y = window.scrollY; draw(); window.scrollTo(0, y); } });
  return () => { alive = false; };
}
