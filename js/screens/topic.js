// Topic: rich lesson rendering (all block types) + practice buttons, related drills, mastery.
import { h, md, esc, icon, ring, speakBtn, pageHeader, levelBadge, isDetektiv, MOTIF, masteryColor, toast, xpBurst, t } from '../ui.js';
import { drillsForTopic, DRILL_META } from '../drills/index.js';
import { noteTopic, topicMastery } from '../progress.js';
import { dictationsFromTopic } from '../exercises/index.js';
import { cast } from '../cast.js';

/** Render one lesson block → element. Exported for the reference screen (rule/table search). */
export function renderBlock(b) {
  switch (b.type) {
    case 'p': return h('p.lb-p', { html: md(b.text) });
    case 'h': return h('h3.lb-h', { html: md(b.text) });
    case 'list': return h('ul.lb-list', (b.items || []).map((it) => h('li', { html: md(it) })));
    case 'rule': return box('lb-rule', t('rule'), 'lightbulb', b.text);
    case 'tip': return box('lb-tip', t('tip'), 'sparkles', b.text);
    case 'pitfall': return box('lb-pitfall', t('pitfall'), 'alert', b.text);
    case 'table': return tableBlock(b);
    case 'examples': return h('div.examples', (b.items || []).map((it) => h('div.exm',
      h('div.grow',
        h('div.exm-de', { lang: 'de', html: md(it.de) }),
        it.en ? h('div.exm-en', { html: md(it.en) }) : null,
        it.note ? h('div.exm-note', { html: md(it.note) }) : null),
      speakBtn(it.de, { size: 18 }))));
    default: return b.text ? h('p.lb-p', { html: md(b.text) }) : h('div');
  }
}
function box(cls, label, ic, text) {
  return h(`div.box.${cls}`, h('div.box-label', { html: `${icon(ic, { size: 14 })}${label}` }), h('div', { html: md(text) }));
}
export function tableBlock(b) {
  const t = h('table.tbl');
  if (b.head?.length) t.appendChild(h('thead', h('tr', b.head.map((c) => h('th', { scope: 'col', html: md(c) })))));
  t.appendChild(h('tbody', (b.rows || []).map((r) => h('tr', r.map((c) => h('td', { html: md(c) }))))));
  return h('div', b.caption ? h('div.tbl-cap', { html: md(b.caption) }) : null, h('div.tbl-wrap', t));
}

export async function render(root, ctx) {
  const { content, store, params } = ctx;
  const meta = content.topicMeta(params.id);
  root.appendChild(pageHeader({ title: meta?.title || 'Thema', back: 'path' }));
  const topic = await content.getTopic(params.id);
  if (!ctx.token()) return;
  root.replaceChildren();
  if (!topic) {
    root.appendChild(pageHeader({ title: meta?.title || params.id, sub: 'Dieses Thema ist noch nicht verfügbar.', back: 'path' }));
    return;
  }
  noteTopic(topic);
  const det = isDetektiv();
  const exs = topic.exercises || [];
  const mastery = topicMastery(topic.id);
  const tp = store.topicStats(topic.id);
  const openWrong = Object.entries(tp?.ex || {}).filter(([, s]) => s < 1).length;
  const nDict = dictationsFromTopic(topic).length;

  root.appendChild(pageHeader({
    back: 'path', title: topic.title,
    kicker: `${levelBadge(topic.level)} <span>${esc(meta?.unit || '')}</span>${det ? ` <span>· Akte ${String((meta?.index ?? 0) + 1).padStart(2, '0')}</span>` : ''}`,
    sub: topic.en,
  }));

  const hero = h('div.topic-hero',
    topic.summary ? h('p.topic-summary', { html: md(topic.summary) }) : null,
    h('div.topic-meta',
      h('div', { html: ring(mastery, { size: 58, stroke: 6, label: `${Math.round(mastery * 100)}`, sub: '%', color: masteryColor(mastery) }) }),
      h('div.grow',
        h('div.card-title', { text: mastery >= 0.8 ? (det ? 'Fall gelöst' : 'Gemeistert') : mastery > 0 ? 'In Arbeit' : (det ? 'Neue Akte' : 'Noch nicht geübt') }),
        h('div.card-sub', { text: `${exs.length} Aufgaben${tp ? ` · ${tp.attempts} Antworten · ${Math.round((tp.acc ?? 0) * 100)} % Treffer` : ''}` }))));
  root.appendChild(hero);
  if (det) root.appendChild(cast.bubble('lesson'));
  root.appendChild(practiceButtons(topic, { openWrong, nDict }));

  // lesson
  const lesson = h('article.lesson', { lang: 'en' });
  for (const b of topic.lesson || []) {
    try { lesson.appendChild(renderBlock(b)); } catch (e) { console.error('block', b, e); }
  }
  root.appendChild(lesson);

  // related drills
  const drills = drillsForTopic(topic.id, topic).map((id) => DRILL_META.find((d) => d.id === id)).filter(Boolean);
  if (drills.length) {
    root.appendChild(h('div.sec-head', h('h2', { text: det ? 'Verwandte Fälle' : 'Passende Drills' })));
    root.appendChild(h('div.chip-wrap', drills.map((d) => h('a.chip', { href: `#/drill/${d.id}?lvl=${topic.level}`, html: `${icon('bolt', { size: 16 })}${esc(det ? d.detektiv.replace(/^Fall: /, '') : d.title)}` }))));
  }

  // end of lesson → mark read (+15 XP once) and offer practice
  const end = h('div.lesson-end',
    h('div', { html: MOTIF.bowtie }),
    h('p.muted', { text: det ? 'Akte gelesen. Jetzt die Beweise sichern:' : 'Lektion gelesen? Dann ab ins Üben:' }),
    h('a.btn.btn-primary.btn-lg.btn-block', { href: `#/practice/${topic.id}?m=20`, html: `${icon('play', { size: 18, fill: true })} Üben (20)` }));
  root.appendChild(end);
  const next = content.nextTopic(topic.id);
  if (next) root.appendChild(h('a.card.tap', { href: `#/topic/${next.id}`, style: { marginTop: '14px' }, html: `<div class="card-row"><div class="grow"><div class="kicker">Nächstes Thema ${levelBadge(next.level)}</div><div class="card-title">${esc(next.title)}</div><div class="card-sub">${esc(next.en)}</div></div>${icon('chevron', { size: 18 })}</div>` }));

  let io = null;
  if (!tp?.lessonRead && 'IntersectionObserver' in window) {
    io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect(); io = null;
        const before = store.state.xp;
        store.markLessonRead(topic.id);
        const gained = store.state.xp - before;
        if (gained > 0) { xpBurst(gained, end); toast(det ? 'Akte gelesen · +15 XP' : 'Lektion gelesen · +15 XP', { icon: 'book', type: 'good' }); }
      }
    }, { threshold: 0.6 });
    io.observe(end);
  }
  return () => io?.disconnect();
}

function practiceButtons(topic, { openWrong, nDict }) {
  const id = topic.id;
  const n = (topic.exercises || []).length;
  const wrap = h('div');
  wrap.appendChild(h('div.practice-bar',
    h('a.btn.btn-primary.btn-lg', { href: `#/practice/${id}?m=20`, html: `${icon('play', { size: 18, fill: true })} Üben (20)` }),
    h('a.btn.btn-secondary.btn-lg', { href: `#/practice/${id}?m=endlos`, html: `${icon('infinity', { size: 20 })} Endlos` })));
  wrap.appendChild(h('div.practice-more',
    h('a.chip', { href: `#/practice/${id}?m=all`, html: `${icon('list', { size: 16 })} Alles (${n})` }),
    h('a.chip', { href: `#/practice/${id}?m=fehler`, class: openWrong ? '' : 'disabled', html: `${icon('target', { size: 16 })} Nur Fehler${openWrong ? ` (${openWrong})` : ''}` }),
    nDict ? h('a.chip', { href: `#/practice/${id}?m=diktat`, html: `${icon('headphones', { size: 16 })} Diktat` }) : null));
  return wrap;
}
