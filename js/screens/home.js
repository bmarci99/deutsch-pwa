// Heute (Home): greeting, streak, XP, daily goal ring, today's session, continue, A1→B2 progress, quick drills.
import { h, md, esc, icon, ring, bar, greeting, num, isDetektiv, MOTIF, t, levelBadge, sectionHead } from '../ui.js';
import { dailyCounts } from '../sources.js';
import { DRILL_META } from '../drills/index.js';
import { lastTopic, recommendedTopic, plan, levelMastery, loadAllTopicsInBackground, TARGET } from '../progress.js';

export function render(root, ctx) {
  const { content, store } = ctx;
  const draw = () => {
    const st = store.streak();
    const today = store.today();
    const goal = store.settings.dailyGoal || 100;
    const counts = dailyCounts({ content, store });
    const total = counts.due + counts.new;
    const det = isDetektiv();
    const now = new Date();
    const dateStr = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

    root.replaceChildren();
    // ---- top bar
    root.appendChild(h('div.home-top',
      h('div.grow', h('div.home-date', { text: dateStr }), h('h1', { text: det ? `${greeting(now)}, Detektiv` : greeting(now) })),
      h('div.stat-pills',
        h('div.stat-pill', { class: st.activeToday ? '' : 'cold', title: 'Serie', html: `${icon('flame', { size: 17, fill: true })}${st.current}` }),
        h('div.stat-pill', { title: 'XP gesamt', html: `${icon('bolt', { size: 16, fill: true })}${num(store.state.xp)}` }))));

    // ---- hero: today's session
    const goalV = Math.min(1, today.xp / goal);
    const goalRing = ring(goalV, { size: 76, stroke: 8, label: `${today.xp}`, sub: `/ ${goal} XP` });
    const desc = total
      ? `${counts.due ? `${counts.due} Wiederholungen` : ''}${counts.due && counts.new ? ' · ' : ''}${counts.new ? `${counts.new} neue Wörter` : ''}${counts.weak ? ' · Schwachstellen' : ''} + Grammatik`
      : (det ? 'Keine fälligen Akten. Zeit für neue Grammatik.' : 'Alles wiederholt — heute gibt es neue Grammatik.');
    const hero = h('section.hero',
      h('div', { html: MOTIF.magnifier + MOTIF.bowtie }),
      h('div.hero-row',
        h('div.grow',
          h('div.kicker', { style: { color: 'inherit', opacity: '.8' }, text: det ? 'Akte des Tages' : 'Tagesziel' }),
          h('h2', { text: t('today') }),
          h('p', { text: desc })),
        h('div', { html: goalRing })),
      h('div.hero-counts',
        count(counts.due, det ? 'offene Akten' : 'fällig'),
        count(counts.new, 'neue Wörter'),
        count(st.current, st.current === 1 ? 'Tag Serie' : 'Tage Serie')),
      h('a.btn.btn-lg.btn-block.btn-hero', { href: '#/session/daily', html: `${icon('play', { size: 18, fill: true })} ${det ? 'Ermittlung starten' : 'Los geht’s'}` }));
    root.appendChild(hero);

    // ---- continue
    const last = lastTopic();
    const rec = recommendedTopic();
    const cont = last && last.mastery < 0.999 ? last : rec;
    if (cont) {
      const m = cont.mastery ?? 0;
      root.appendChild(h('a.card.tap.continue-card', { href: `#/topic/${cont.id}` },
        h('div.card-row',
          h('div', { html: ring(m, { size: 48, stroke: 5, label: `${Math.round(m * 100)}` }) }),
          h('div.grow',
            h('div.kicker', { html: `${cont === last ? (det ? 'Ermittlung fortsetzen' : 'Weitermachen') : (det ? 'Nächste Akte' : 'Als Nächstes')} ${levelBadge(cont.level)}` }),
            h('div.card-title', { text: cont.title }),
            h('div.card-sub', { text: cont.en })),
          h('span.chev', { html: icon('chevron', { size: 20 }) }))));
    }

    // ---- level progress
    const p = plan();
    const levels = ['A1', 'A2', 'B1', 'B2'];
    const statusText = {
      ahead: `Vor dem Plan — weiter so!`,
      on: `Im Plan für ${TARGET.level} bis ${TARGET.label}.`,
      behind: `Etwas hinter dem Plan: ca. ${Math.ceil(p.perWeek)} Themen pro Woche bis ${TARGET.label}.`,
    }[p.status];
    root.appendChild(h('div', { html: sectionHead(det ? 'Ermittlungsstand' : 'Weg zu B2', `<a href="#/path">${det ? 'Alle Akten' : 'Lernpfad'}</a>`) }));
    root.appendChild(h('div.card',
      h('div.goal-line',
        h('div', { html: ring(p.progress, { size: 64, stroke: 7, label: `${Math.round(p.progress * 100)}%`, color: 'var(--accent)' }) }),
        h('div.grow',
          h('div.card-title', { text: `${p.mastered} von ${p.total} Themen gemeistert` }),
          h('div.card-sub', { text: `Ziel: ${TARGET.level} bis ${TARGET.label} · noch ${Math.max(0, Math.round(p.weeksLeft))} Wochen` }))),
      h('div.levels-track', levels.map((lv) => {
        const v = levelMastery(lv);
        return h('div.lv-cell', { html: `${levelBadge(lv)}${bar(v, { cls: 'thin' })}<small>${Math.round(v * 100)}%</small>` });
      })),
      h('div.ontrack', { class: p.status, html: `<span class="dot"></span><span>${esc(statusText)}</span>` })));

    // ---- quick drills
    root.appendChild(h('div', { html: sectionHead(det ? 'Schnelle Fälle' : 'Schnell-Drills', '<a href="#/ueben">Alle</a>') }));
    const chips = h('div.chips');
    for (const d of DRILL_META) chips.appendChild(h('a.chip', { href: `#/drill/${d.id}`, html: `${icon('bolt', { size: 16 })}${esc(d.title)}` }));
    root.appendChild(chips);

    // ---- weak spots teaser
    const weak = store.weakTopics(3);
    if (weak.length) {
      root.appendChild(h('div', { html: sectionHead('Schwachstellen', '<a href="#/session/weak">Üben</a>') }));
      const list = h('div.list');
      for (const w of weak) {
        const m = content.topicMeta(w.id);
        if (!m) continue;
        list.appendChild(h('a.row.weak-row', { href: `#/practice/${w.id}?m=fehler` },
          h('div.grow', h('div.row-title', { text: m.title }), h('div.row-sub', { text: `${w.attempts} Versuche` })),
          h('span.acc', { text: `${Math.round(w.acc * 100)} %` }),
          h('span.chev', { html: icon('chevron', { size: 18 }) })));
      }
      root.appendChild(list);
    }

    // ---- mistakes / review teaser
    const openMistakes = store.mistakes().length;
    root.appendChild(h('div.grid2', { style: { marginTop: '14px' } },
      h('a.card.tap', { href: '#/review', html: `<div class="kicker">${icon('review', { size: 14 })} Wiederholung</div><div class="card-title">${counts.due} fällig</div><div class="card-sub">Vorschau &amp; Fehlerheft</div>` }),
      h('a.card.tap', { href: '#/session/mistakes', html: `<div class="kicker">${icon('target', { size: 14 })} ${det ? 'Offene Spuren' : 'Fehlerheft'}</div><div class="card-title">${openMistakes} offen</div><div class="card-sub">Alle Fehler üben</div>` })));
    if (!content.words.length) root.appendChild(h('p.muted.small', { style: { marginTop: '14px' }, text: 'Hinweis: Vokabeln werden noch geladen bzw. sind noch nicht vorhanden.' }));
  };
  draw();
  // exact mastery % once every topic file is known
  let alive = true;
  loadAllTopicsInBackground().then(() => { if (alive && ctx.token()) draw(); });
  const off = store.on('change', (what) => { if (what === 'settings' || what === 'import' || what === 'reset') draw(); });
  return () => { alive = false; off(); };
}

function count(n, label) {
  return h('div.hero-count', h('b', { text: String(n) }), h('span', { text: label }));
}
void md;
