// Vokabeln: browse/search ~5,000 words (virtualised list, filters level/pos/topic), word detail (#/vocab/<key>),
// flashcards (#/cards?dir=de-en|en-de|g|listen [&lvl=&topic=&pos=]) and "neue Wörter heute".
import { h, md, esc, icon, pageHeader, segmented, sheet, speakBtn, speak, answerInput, levelBadge, genderClass, num,
  isDetektiv, toast, xpBurst, haptic, sectionHead, empty, bar, reducedMotion, MOTIF } from '../ui.js';
import { displayWord, wordInfo, wordExercise, makeRng } from '../drills/index.js';
import * as srs from '../srs.js';
import * as G from '../german.js';
import { checkText, fold } from '../checker.js';
import { startCustomSession } from '../sources.js';

const UI_KEY = 'dd.ui.vocab';
const loadUi = () => { try { return JSON.parse(localStorage.getItem(UI_KEY) || '{}'); } catch { return {}; } };
const saveUi = (o) => { try { localStorage.setItem(UI_KEY, JSON.stringify({ ...loadUi(), ...o })); } catch { /* ignore */ } };

const ROW = 62;           // virtual row height (px) — keep in sync with .vrow in app.css
const OVERSCAN = 10;
const LEVELS = ['A1', 'A2', 'B1', 'B2'];
const POS = [
  { value: '', label: 'Alle' }, { value: 'noun', label: 'Nomen' }, { value: 'verb', label: 'Verben' },
  { value: 'adj', label: 'Adjektive' }, { value: 'other', label: 'Andere' },
];
const POS_LABEL = { noun: 'Nomen', verb: 'Verb', adj: 'Adjektiv', adv: 'Adverb', prep: 'Präposition', conj: 'Konjunktion', pron: 'Pronomen', num: 'Zahlwort', particle: 'Partikel', phrase: 'Wendung', other: 'Sonstiges' };
const DIRS = {
  'de-en': { title: 'Bedeutung', det: 'Zeugenaussage', sub: 'Deutsch → Englisch, selbst bewerten', ic: 'layers' },
  'en-de': { title: 'Schreiben', det: 'Geständnis', sub: 'Englisch → Deutsch tippen', ic: 'keyboard' },
  g: { title: 'Genus & Plural', det: 'Der/die/das-Verhör', sub: 'Artikel wählen, Plural tippen', ic: 'grid' },
  listen: { title: 'Hören', det: 'Abgehört', sub: 'Hören → schreiben', ic: 'headphones' },
};
const collator = new Intl.Collator('de', { sensitivity: 'base' });

export function render(root, ctx) {
  const head = ctx.path.split('/')[0];
  if (head === 'cards') return renderCards(root, ctx);
  if (ctx.params.key) return renderDetail(root, ctx);
  return renderList(root, ctx);
}

// ====================================================================== helpers
/** Learning status of a word from its SRS cards: 'known' | 'learning' | 'new'. */
function wordStatus(cards, key) {
  const c = cards[srs.cardId.word(key, 'de-en')];
  if (!c || c.state === 'new') return 'new';
  return c.state === 'review' && c.s >= 4 ? 'known' : 'learning';
}
const STATUS_LABEL = { known: 'gelernt', learning: 'in Arbeit', new: 'neu' };

/** Word with a gender-coloured article: <span class="art g-m">der</span> Tisch */
function wordHtml(w) {
  if (w.pos === 'noun') {
    const art = w.g === 'pl' ? 'die' : G.DEF_NOM[w.g] || '';
    return `<span class="art ${genderClass(w.g)}">${esc(art)}</span> ${esc(w.de)}${w.g === 'pl' ? ' <small class="muted">(Pl.)</small>' : ''}`;
  }
  if (w.pos === 'verb' && w.refl && !w.de.startsWith('sich ')) return `<span class="muted">sich</span> ${esc(w.de)}`;
  return esc(w.de);
}
const audioOf = (w) => displayWord(w).replace(/ \(Pl\.\)$/, '');

function matchesFilter(w, f) {
  if (f.level && w.lvl !== f.level) return false;
  if (f.topic && (w.topic || 'Sonstiges') !== f.topic) return false;
  if (f.pos) {
    if (f.pos === 'other') { if (['noun', 'verb', 'adj'].includes(w.pos)) return false; } else if (w.pos !== f.pos) return false;
  }
  if (f.status && f.status !== 'all' && wordStatus(f.cards, w.key) !== f.status) return false;
  return true;
}

let sortedCache = null;
function sortedWords(content) {
  if (sortedCache && sortedCache.src === content.words) return sortedCache.list;
  const list = [...content.words].sort((a, b) => G.levelIdx(a.lvl) - G.levelIdx(b.lvl) || collator.compare(a.de, b.de));
  sortedCache = { src: content.words, list };
  return list;
}

/** Start a session with the next n new words (intro card + exercises), same logic as the daily session. */
async function learnNewWords(ctx, n) {
  const { content, store, nav } = ctx;
  const { items } = await srs.buildDailySession({ content, store, maxReviews: 0, weakExercises: 0, newWords: n, rng: makeRng(Date.now()) });
  if (!items.length) { toast('Keine neuen Wörter mehr auf deinem Niveau — beeindruckend!', { icon: 'sparkles' }); return; }
  startCustomSession({ title: 'Neue Wörter', kicker: `${items.filter((i) => i.intro).length} Wörter`, items, back: 'vocab' }, nav);
}

// ====================================================================== list
function renderList(root, ctx) {
  const { content, store, nav } = ctx;
  const det = isDetektiv();
  const ui = loadUi();
  const f = { level: ui.level || '', pos: ui.pos || '', topic: ui.topic || '', status: ui.status || 'all', q: '', cards: store.state.cards };
  const total = content.words.length;
  const learned = content.words.reduce((s, w) => s + (wordStatus(store.state.cards, w.key) !== 'new' ? 1 : 0), 0);

  root.appendChild(pageHeader({
    title: det ? 'Wortkartei' : 'Vokabeln',
    sub: `${num(total)} Wörter · ${num(learned)} ${det ? 'schon verhört' : 'angefangen'}`,
    right: h('a.icon-btn', { href: '#/drill/gender', 'aria-label': 'Genus-Drill', html: icon('bolt') }),
  }));

  if (!total) {
    root.appendChild(empty('Die Vokabeldateien sind noch nicht geladen.', { ic: 'vocab' }));
    return;
  }

  // ---- new words today
  const goal = store.settings.newWordsPerDay ?? 10;
  const doneToday = store.today().newWords || 0;
  const left = Math.max(0, goal - doneToday);
  const nw = h('div.card.newwords',
    h('div.card-row',
      h('div', { html: ringMini(goal ? Math.min(1, doneToday / goal) : 1, `${doneToday}`) }),
      h('div.grow',
        h('div.kicker', { html: `${icon('sparkles', { size: 14 })} ${det ? 'Neue Zeugen heute' : 'Neue Wörter heute'}` }),
        h('div.card-title', { text: left ? `Noch ${left} von ${goal} neuen Wörtern` : goal ? 'Tagesziel geschafft!' : 'Neue Wörter pausiert' }),
        h('div.card-sub', { text: left ? 'Karte ansehen, anhören, dann abfragen.' : 'Lust auf mehr? Fünf Extra-Wörter gehen immer.' })),
    ),
    h('button.btn.btn-primary.btn-block', {
      style: { marginTop: '14px' }, type: 'button',
      html: `${icon('play', { size: 18, fill: true })} ${left ? `${left} neue Wörter lernen` : '5 Extra-Wörter'}`,
      onclick: () => learnNewWords(ctx, left || 5),
    }));
  root.appendChild(nw);

  // ---- flashcard decks
  const cards = store.state.cards;
  const now = Date.now();
  const dueBy = { 'de-en': 0, 'en-de': 0, g: 0 };
  for (const c of srs.dueCards(cards, now, { prefix: 'w:' })) { const d = c.id.slice(c.id.lastIndexOf('|') + 1); if (d in dueBy) dueBy[d]++; }
  root.appendChild(h('div', { html: sectionHead(det ? 'Verhöre' : 'Karteikarten', '<span class="muted small">SRS</span>') }));
  const decks = h('div.deck-grid');
  for (const [dir, m] of Object.entries(DIRS)) {
    const due = dueBy[dir] || 0;
    decks.appendChild(h('button.card.tap.deck', {
      type: 'button', onclick: () => nav('cards', { dir, ...filterQuery(f) }),
    },
    h('div.deck-ic', { html: icon(m.ic, { size: 22 }) }),
    h('div.deck-title', { text: det ? m.det : m.title }),
    h('div.deck-sub', { text: m.sub }),
    h('div.deck-foot', { html: due ? `<span class="badge bad">${due} fällig</span>` : dir === 'listen' ? '<span class="badge">frei üben</span>' : '<span class="badge good">nichts fällig</span>' })));
  }
  root.appendChild(decks);

  // ---- browse
  root.appendChild(h('div', { html: sectionHead(det ? 'Kartei durchsuchen' : 'Alle Wörter') }));
  const search = answerInput({ placeholder: 'Suchen: Deutsch oder Englisch', label: 'Wort suchen' });
  search.classList.add('search-in');
  search.setAttribute('enterkeyhint', 'search');
  search.type = 'search';
  const searchWrap = h('div.search-wrap', h('span.search-ic', { html: icon('search', { size: 18 }) }), search);
  root.appendChild(searchWrap);

  const filterBar = h('div.chips.filter-chips');
  root.appendChild(filterBar);
  const posSeg = segmented(POS, f.pos, (v) => { f.pos = v; saveUi({ pos: v }); refresh(); }, { cls: 'pos-seg' });
  root.appendChild(posSeg);
  const countEl = h('div.list-count');
  root.appendChild(countEl);
  const listEl = h('div.vlist', { role: 'list' });
  root.appendChild(listEl);
  const studyBtn = h('button.btn.btn-tinted.btn-block', { type: 'button', style: { marginTop: '14px' } });
  root.appendChild(studyBtn);

  function drawFilters() {
    filterBar.replaceChildren(...[
      h('button.chip', { type: 'button', class: f.level ? 'on' : '', html: `${icon('layers', { size: 16 })} ${f.level || 'Niveau'}`, onclick: pickLevel }),
      h('button.chip', { type: 'button', class: f.topic ? 'on' : '', html: `${icon('folder', { size: 16 })} ${esc(f.topic || 'Thema')}`, onclick: pickTopic }),
      h('button.chip', { type: 'button', class: f.status !== 'all' ? 'on' : '', html: `${icon('check', { size: 16 })} ${f.status === 'all' ? 'Status' : STATUS_LABEL[f.status]}`, onclick: pickStatus }),
      (f.level || f.topic || f.status !== 'all' || f.pos) ? h('button.chip', { type: 'button', html: `${icon('close', { size: 16 })} Zurücksetzen`, onclick: () => { f.level = ''; f.topic = ''; f.status = 'all'; f.pos = ''; saveUi({ level: '', topic: '', status: 'all', pos: '' }); posSeg.querySelectorAll('.seg').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.value === ''))); refresh(); } }) : null].filter(Boolean));
  }
  function pickLevel() {
    const body = h('div.chip-wrap', [{ v: '', l: 'Alle Niveaus' }, ...LEVELS.map((l) => ({ v: l, l }))].map((o) => h('button.chip', {
      type: 'button', class: f.level === o.v ? 'on' : '', html: o.v ? `${levelBadge(o.v)} ${num(content.wordsByLevel[o.v]?.length || 0)} Wörter` : o.l,
      onclick: () => { f.level = o.v; saveUi({ level: o.v }); s.close(); refresh(); },
    })));
    const s = sheet({ title: 'Niveau', body });
  }
  function pickStatus() {
    const opts = [{ v: 'all', l: 'Alle' }, { v: 'new', l: 'Neu' }, { v: 'learning', l: 'In Arbeit' }, { v: 'known', l: 'Gelernt' }];
    const body = h('div.chip-wrap', opts.map((o) => h('button.chip', { type: 'button', class: f.status === o.v ? 'on' : '', text: o.l, onclick: () => { f.status = o.v; saveUi({ status: o.v }); s.close(); refresh(); } })));
    const s = sheet({ title: 'Lernstatus', body });
  }
  function pickTopic() {
    const list = h('div.list');
    list.appendChild(h('button.row', { type: 'button', onclick: () => { f.topic = ''; saveUi({ topic: '' }); s.close(); refresh(); } }, h('div.grow.row-title', { text: 'Alle Themen' }), f.topic ? null : h('span', { html: icon('check', { size: 18 }), style: { color: 'var(--accent)' } })));
    for (const tp of content.wordTopics) {
      const n = content.wordsByTopic[tp]?.length || 0;
      list.appendChild(h('button.row', { type: 'button', onclick: () => { f.topic = tp; saveUi({ topic: tp }); s.close(); refresh(); } },
        h('div.grow', h('div.row-title', { text: tp })), h('span.muted.small', { text: num(n) }),
        f.topic === tp ? h('span', { html: icon('check', { size: 18 }), style: { color: 'var(--accent)' } }) : null));
    }
    const s = sheet({ title: 'Thema', body: list });
  }

  // ---- virtual list
  let items = [];
  let painted = [-1, -1];
  function refresh() {
    f.cards = store.state.cards;
    drawFilters();
    const q = search.value.trim();
    const base = q ? content.searchWords(q, 400) : sortedWords(content);
    items = base.filter((w) => matchesFilter(w, f));
    countEl.textContent = items.length ? `${num(items.length)} ${items.length === 1 ? 'Wort' : 'Wörter'}${q && base.length >= 400 ? '+' : ''}` : '';
    listEl.style.height = `${items.length * ROW}px`;
    listEl.classList.toggle('is-empty', !items.length);
    painted = [-1, -1];
    if (!items.length) {
      listEl.style.height = '';
      listEl.replaceChildren(empty(q ? `Nichts gefunden für „${q}“.` : 'Keine Wörter mit diesen Filtern.', { ic: 'search' }));
    } else paint();
    const fq = filterQuery(f);
    studyBtn.hidden = !Object.keys(fq).length || !items.length;
    studyBtn.innerHTML = `${icon('layers', { size: 18 })} Diese Auswahl als Karteikarten`;
    studyBtn.onclick = () => nav('cards', { dir: 'de-en', ...fq });
  }
  function rowEl(w, i) {
    const st = wordStatus(store.state.cards, w.key);
    const sub = w.pos === 'noun' && w.g !== 'pl' && w.pl ? `${w.pl === '-' ? 'kein Pl.' : `Pl. ${w.pl}`} · ${w.en}` : w.en;
    return h('a.vrow', { href: `#/vocab/${encodeURIComponent(w.key)}`, role: 'listitem', style: { transform: `translateY(${i * ROW}px)` } },
      h('div.grow',
        h('div.vrow-de', { lang: 'de', html: wordHtml(w) }),
        h('div.vrow-en', { text: sub })),
      h('span.st-dot', { class: `st-${st}`, title: STATUS_LABEL[st] }),
      h('span', { html: levelBadge(w.lvl || '–') }));
  }
  function paint() {
    if (!items.length) return;
    const top = -listEl.getBoundingClientRect().top;
    const vh = window.innerHeight;
    const first = Math.max(0, Math.floor(top / ROW) - OVERSCAN);
    const last = Math.min(items.length, Math.ceil((top + vh) / ROW) + OVERSCAN);
    if (first === painted[0] && last === painted[1]) return;
    painted = [first, last];
    const fr = document.createDocumentFragment();
    for (let i = first; i < last; i++) fr.appendChild(rowEl(items[i], i));
    listEl.replaceChildren(fr);
  }
  let raf = 0;
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); }); };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  let tmr = 0;
  search.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(refresh, 120); });
  search.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); search.blur(); } });
  refresh();
  requestAnimationFrame(paint); // after the router has inserted the screen (rects are 0 before)
  setTimeout(paint, 60);
  return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf); clearTimeout(tmr); };
}

function filterQuery(f) {
  const q = {};
  if (f.level) q.lvl = f.level;
  if (f.topic) q.topic = f.topic;
  if (f.pos) q.pos = f.pos;
  return q;
}

function ringMini(v, label) {
  const size = 52, stroke = 6, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<div class="ring" style="--size:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none"/><circle class="ring-val" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none" stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - v)).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})" style="stroke:var(--good)"/></svg><div class="ring-label"><b>${esc(label)}</b></div></div>`;
}

// ====================================================================== detail
function renderDetail(root, ctx) {
  const { content, store } = ctx;
  const w = content.wordByKey(ctx.params.key);
  if (!w) {
    root.appendChild(pageHeader({ title: 'Wort nicht gefunden', back: 'vocab' }));
    root.appendChild(empty(`„${ctx.params.key}“ ist nicht (mehr) im Wortschatz.`, { ic: 'search' }));
    return;
  }
  const key = w.key;
  const audio = audioOf(w);
  root.appendChild(pageHeader({ title: '', back: 'vocab', kicker: `${levelBadge(w.lvl || '–')} <span>${esc(POS_LABEL[w.pos] || w.pos)}</span>${w.topic ? ` <span>· ${esc(w.topic)}</span>` : ''}` }));

  const hero = h('div.card.word-hero', { class: w.pos === 'noun' ? `wh-${w.g}` : '' },
    h('div.wh-top',
      h('div.grow',
        h('div.wh-word', { lang: 'de', html: wordHtml(w) }),
        wordInfo(w) ? h('div.wh-info', { text: wordInfo(w) }) : null),
      speakBtn(audio, { size: 26, cls: 'big' })),
    h('div.wh-en', { text: w.en }),
    w.pos === 'noun' && w.g && w.g !== 'pl' ? h('div.wh-gender', { html: `<span class="gdot ${genderClass(w.g)}"></span>${esc(G.GENDER_NAMES[w.g])} · ${esc(G.DEF_NOM[w.g])}${w.weak ? ' · n-Deklination' : ''}` }) : null,
    w.ex ? h('div.wh-ex', h('div.grow', h('div', { lang: 'de', text: w.ex }), w.exEn ? h('div.muted.small', { text: w.exEn }) : null), speakBtn(w.ex, { size: 18 }), speakBtn(w.ex, { size: 18, slow: true })) : null);
  root.appendChild(hero);
  if (store.settings.autoplayAudio !== false) setTimeout(() => { if (ctx.token()) speak(audio); }, 350);

  // ---- grammar
  if (w.pos === 'noun') root.appendChild(nounTable(w));
  if (w.pos === 'verb') root.appendChild(verbBlock(content, w));
  if (w.pos === 'adj' && w.comp) {
    root.appendChild(h('div', { html: sectionHead('Steigerung') }));
    const head = h('thead', h('tr', h('th', { text: 'Positiv' }), h('th', { text: 'Komparativ' }), h('th', { text: 'Superlativ' })));
    const body = h('tbody', h('tr', h('td', { text: w.de }), h('td', { text: w.comp }), h('td', { text: w.sup || '' })));
    root.appendChild(h('div.tbl-wrap', h('table.tbl', head, body)));
  }
  if (w.prep || w.obj) root.appendChild(h('div.box.lb-tip', h('div.box-label', { html: `${icon('lightbulb', { size: 14 })} Rektion` }), h('div', { html: md([w.obj && w.obj !== '-' ? `Ergänzung: **${w.obj}**` : '', w.prep ? `Präposition: **${w.prep}**` : ''].filter(Boolean).join(' · ')) })));

  // ---- SRS status + practice
  root.appendChild(h('div', { html: sectionHead('Lernstand') }));
  const dirs = ['de-en', 'en-de', ...(w.pos === 'noun' && ['m', 'f', 'n'].includes(w.g) ? ['g'] : [])];
  const list = h('div.list');
  const now = Date.now();
  for (const d of dirs) {
    const c = store.getCard(srs.cardId.word(key, d));
    const txt = !c || c.state === 'new' ? 'noch nicht gelernt' : c.due <= now ? 'jetzt fällig' : `fällig in ${srs.formatInterval(c.due - now)}`;
    const r = c && c.state !== 'new' ? srs.retrievability(c, now) : 0;
    list.appendChild(h('div.row',
      h('div.row-ic', { html: icon(DIRS[d].ic, { size: 18 }) }),
      h('div.grow', h('div.row-title', { text: DIRS[d].title }), h('div.row-sub', { text: `${txt}${c && c.reps ? ` · ${c.reps}× wiederholt` : ''}` })),
      c && c.state !== 'new' ? h('div', { style: { width: '64px' }, html: bar(r, { cls: 'thin', color: r > 0.85 ? 'var(--good)' : r > 0.6 ? 'var(--accent)' : 'var(--warn)' }) }) : null));
  }
  root.appendChild(list);
  root.appendChild(h('button.btn.btn-primary.btn-block.btn-lg', {
    type: 'button', html: `${icon('play', { size: 18, fill: true })} Dieses Wort üben`,
    onclick: () => {
      const rng = makeRng(Date.now());
      const isNew = !store.getCard(srs.cardId.word(key, 'de-en'));
      const items = dirs.map((d, i) => ({ cardId: srs.cardId.word(key, d), kind: 'word', word: w, dir: d, intro: isNew && i === 0, source: isNew && i === 0 ? 'new' : null, exercise: wordExercise(w, d, { content, rng }) })).filter((i) => i.exercise);
      startCustomSession({ title: displayWord(w), kicker: 'Wort üben', items, back: `vocab/${encodeURIComponent(key)}` }, ctx.nav);
    },
  }));

  // ---- related words (same topic)
  const rel = (content.wordsByTopic[w.topic || 'Sonstiges'] || []).filter((x) => x !== w);
  if (rel.length) {
    const rng = makeRng(key.length * 7919 + rel.length);
    root.appendChild(h('div', { html: sectionHead(`Mehr aus „${w.topic}“`) }));
    root.appendChild(h('div.chip-wrap', rng.shuffle([...rel]).slice(0, 10).map((x) => h('a.chip', { href: `#/vocab/${encodeURIComponent(x.key)}`, lang: 'de', html: wordHtml(x) }))));
  }
  if (w.pos === 'noun') root.appendChild(h('a.card.tap', { href: `#/reference/noun/${encodeURIComponent(key)}`, style: { marginTop: '16px' }, html: `<div class="card-row"><div class="grow"><div class="card-title">Im Nachschlagewerk öffnen</div><div class="card-sub">Alle Fälle mit bestimmtem und unbestimmtem Artikel</div></div>${icon('chevron', { size: 18 })}</div>` }));
}

function nounTable(w) {
  const wrap = h('div');
  wrap.appendChild(h('div', { html: sectionHead('Deklination') }));
  const hasPl = w.g === 'pl' || (w.pl && w.pl !== '-');
  const hasSg = w.g !== 'pl';
  const head = ['', ...(hasSg ? ['Singular'] : []), ...(hasPl ? ['Plural'] : [])];
  const rows = G.CASES.map((c) => {
    const r = [G.CASE_NAMES[c]];
    if (hasSg) r.push(G.nounPhrase({ type: 'def', c, word: w, number: 'sg' }) || '—');
    if (hasPl) r.push(G.nounPhrase({ type: 'def', c, word: w, number: 'pl' }) || '—');
    return r;
  });
  const t = h('table.tbl.decl', h('thead', h('tr', head.map((x) => h('th', { text: x })))),
    h('tbody', rows.map((r) => h('tr', r.map((x, i) => h('td', { lang: i ? 'de' : null, html: i ? highlightArticle(x, i === 1 && hasSg ? w.g : 'pl') : esc(x) }))))));
  wrap.appendChild(h('div.tbl-wrap', t));
  return wrap;
}
function highlightArticle(phrase, g) {
  const [a, ...rest] = String(phrase).split(' ');
  return rest.length ? `<span class="${genderClass(g)}" style="font-weight:700">${esc(a)}</span> ${esc(rest.join(' '))}` : esc(phrase);
}

function verbBlock(content, w) {
  const wrap = h('div');
  const inf = w.de.replace(/^sich /, '');
  const v = content.verb(inf);
  wrap.appendChild(h('div', { html: sectionHead('Konjugation', v ? `<a href="#/reference/verb/${encodeURIComponent(inf)}">Alle Zeiten</a>` : '') }));
  if (v) {
    const refl = w.refl || v.refl;
    const t = h('table.tbl.compact', h('thead', h('tr', h('th', { text: '' }), h('th', { text: 'Präsens' }), h('th', { text: 'Präteritum' }), h('th', { text: 'Perfekt' }))),
      h('tbody', G.PERSONS.map((p, i) => h('tr',
        h('td', { text: p }),
        h('td', { lang: 'de', html: withRefl(v.pres[i], refl, i) }),
        h('td', { lang: 'de', html: withRefl(v.prt[i], refl, i) }),
        h('td', { lang: 'de', html: `${esc(perfAux(v.aux, i))}${refl ? ` <span class="muted">${esc(G.REFLEXIVE[refl === 'dat' ? 'dat' : 'akk'][i])}</span>` : ''} ${esc(v.pp)}` })))));
    wrap.appendChild(h('div.tbl-wrap', t));
  } else {
    wrap.appendChild(h('div.card', h('div.kv', kv('er/sie/es', w.p3), kv('Präteritum', w.prt), kv('Perfekt', w.pp ? `${w.aux === 'sein' ? 'ist' : w.aux === 'haben/sein' ? 'hat/ist' : 'hat'} ${w.pp}` : ''))));
  }
  return wrap;
}
const kv = (k, v) => v ? h('div.kv-row', h('span.kv-k', { text: k }), h('span.kv-v', { lang: 'de', text: v })) : null;
function perfAux(aux, i) {
  const a = String(aux || 'haben');
  if (a === 'haben/sein') return `${G.HABEN.pres[i]}/${G.SEIN.pres[i]}`;
  return (a === 'sein' ? G.SEIN : G.HABEN).pres[i];
}
/** Insert the reflexive pronoun after the finite verb: 'rege auf' → 'rege <mich> auf'. */
export function withRefl(form, refl, i) {
  if (!refl || !form) return esc(form || '');
  const pr = G.REFLEXIVE[refl === 'dat' ? 'dat' : 'akk'][i];
  const [first, ...rest] = String(form).split(' ');
  return `${esc(first)} <span class="muted">${esc(pr)}</span>${rest.length ? ' ' + esc(rest.join(' ')) : ''}`;
}

// ====================================================================== flashcards
function renderCards(root, ctx) {
  const { content, store, query, nav } = ctx;
  const dir = DIRS[query.dir] ? query.dir : 'de-en';
  const det = isDetektiv();
  const filt = { level: query.lvl || '', topic: query.topic || '', pos: query.pos || '', status: 'all', cards: store.state.cards };
  const filtLabel = [filt.level, filt.topic, filt.pos && (POS.find((p) => p.value === filt.pos)?.label)].filter(Boolean).join(' · ');
  const meta = DIRS[dir];

  const segWrap = h('div.cards-seg', segmented(Object.entries(DIRS).map(([value, m]) => ({ value, label: m.title.split(' ')[0] })), dir, (v) => nav('cards', { dir: v, lvl: filt.level, topic: filt.topic, pos: filt.pos }, { replace: true })));
  root.appendChild(pageHeader({ title: det ? meta.det : meta.title, sub: `${meta.sub}${filtLabel ? ` · ${filtLabel}` : ''}`, back: 'vocab', kicker: det ? `${icon('magnifier', { size: 14 })} Verhör` : 'Karteikarten' }));
  root.appendChild(segWrap);
  const stage = h('div.flash-stage');
  root.appendChild(stage);

  const deck = buildDeck(content, store, dir, filt);
  let i = 0, right = 0, xp = 0, seen = 0;
  let keyHandler = null;
  const setKeys = (fn) => { if (keyHandler) document.removeEventListener('keydown', keyHandler); keyHandler = fn; if (fn) document.addEventListener('keydown', fn); };

  if (!deck.length) {
    stage.appendChild(empty(dir === 'en-de' ? 'Noch keine gelernten Wörter für diese Richtung. Lerne zuerst ein paar neue Wörter (Bedeutung).' : 'Für diese Auswahl ist gerade nichts fällig.', {
      ic: 'sparkles', action: h('button.btn.btn-primary', { type: 'button', text: 'Neue Wörter lernen', onclick: () => learnNewWords(ctx, Math.max(5, (store.settings.newWordsPerDay ?? 10) - (store.today().newWords || 0))) }),
    }));
    return () => setKeys(null);
  }

  const progEl = h('div.flash-prog');
  stage.before(progEl);

  function show() {
    if (i >= deck.length) return summary();
    progEl.innerHTML = `${bar(i / deck.length)}<span>${i + 1}/${deck.length}</span>`;
    const it = deck[i];
    const card = h('div.card.flashcard', { class: `fc-${dir}` });
    stage.replaceChildren(card);
    if (dir === 'de-en') return showDeEn(card, it);
    if (dir === 'en-de') return showTyped(card, it, 'en-de');
    if (dir === 'g') return showGender(card, it);
    return showTyped(card, it, 'listen');
  }

  // ---------- de → en: flip + self grade
  function showDeEn(card, it) {
    const w = it.word;
    const back = h('div.fc-back', { hidden: true },
      h('div.fc-en', { text: w.en }),
      wordInfo(w) ? h('div.fc-info', { lang: 'de', text: wordInfo(w) }) : null,
      w.ex ? h('div.fc-ex', h('div.grow', h('div', { lang: 'de', text: w.ex }), w.exEn ? h('div.muted.small', { text: w.exEn }) : null), speakBtn(w.ex, { size: 18 })) : null);
    card.append(
      it.isNew ? h('div.new-badge', { html: `${icon('sparkles', { size: 14 })} Neues Wort · ${esc(w.lvl || '')}` }) : h('div.fc-meta', { html: `${levelBadge(w.lvl || '–')} <span>${esc(POS_LABEL[w.pos] || '')}</span>` }),
      h('div.fc-word', { lang: 'de', html: wordHtml(w) }),
      h('div.fc-speak', speakBtn(audioOf(w), { size: 24 })),
      back);
    const grades = gradeRow(it, null, (g) => { record(it, g); next(); });
    grades.hidden = true;
    const reveal = h('button.btn.btn-primary.btn-lg.btn-block', { type: 'button', text: 'Aufdecken', onclick: () => flip() });
    stage.append(reveal, grades);
    function flip() {
      if (!back.hidden) return;
      back.hidden = false; card.classList.add('flipped'); reveal.remove(); grades.hidden = false; haptic();
    }
    card.addEventListener('click', flip);
    if (store.settings.autoplayAudio !== false) setTimeout(() => speak(audioOf(w)), 250);
    setKeys((e) => {
      if (e.target.matches?.('input, textarea')) return;
      if ((e.key === ' ' || e.key === 'Enter') && back.hidden) { e.preventDefault(); flip(); }
      else if (!back.hidden && /^[1-4]$/.test(e.key)) grades.querySelectorAll('button')[Number(e.key) - 1]?.click();
    });
  }

  // ---------- en → de typed  /  listening
  function showTyped(card, it, mode) {
    const w = it.word;
    const answers = expectedForms(w);
    const inp = answerInput({ placeholder: mode === 'listen' ? 'Was hörst du?' : w.pos === 'noun' ? 'mit Artikel, z. B. der Tisch' : 'Deutsch …' });
    const checkBtn = h('button.btn.btn-primary.btn-lg.btn-block', { type: 'button', text: isDetektiv() ? 'Beweis prüfen' : 'Prüfen' });
    if (mode === 'listen') {
      const play = speakBtn(audioOf(w), { size: 34, cls: 'big', label: 'Wort abspielen' });
      card.append(h('div.fc-meta', { html: `${icon('headphones', { size: 16 })} <span>Hör zu und schreib das Wort</span>` }), h('div.dict-play', play, speakBtn(audioOf(w), { size: 22, slow: true })));
      setTimeout(() => speak(audioOf(w), { btn: play }), 300);
    } else {
      card.append(...[h('div.fc-meta', { html: `${levelBadge(w.lvl || '–')} <span>${esc(POS_LABEL[w.pos] || '')}</span>` }), h('div.fc-prompt', { text: w.en }), w.pos === 'noun' ? h('div.ex-hint', { text: '(mit Artikel)' }) : null].filter(Boolean));
    }
    card.append(h('div.answer-wrap', inp));
    stage.append(checkBtn);
    let done = false;
    const check = () => {
      if (done) return;
      if (!inp.value.trim()) { inp.focus(); return; }
      done = true;
      let res = checkText(inp.value, answers, { ignoreInitialCase: w.pos !== 'noun' });
      // a noun typed without its article (en→de) → "almost"
      if (res.result === 'wrong' && w.pos === 'noun' && mode === 'en-de' && fold(inp.value) === fold(w.de)) res = { ...res, result: 'almost', notices: ['Artikel fehlt — lern Nomen immer mit der/die/das.'] };
      if (mode === 'listen' && res.result !== 'correct' && fold(inp.value) === fold(w.de)) res = { ...res, result: 'correct' };
      inp.readOnly = true; inp.blur();
      inp.classList.add(res.result === 'correct' ? 'ok' : res.result === 'almost' ? 'almost' : 'no');
      haptic(res.result === 'correct' ? 'success' : 'error');
      checkBtn.remove();
      const sol = h('div.fc-solution',
        h('div.fc-sol-head', { html: `${icon(res.result === 'correct' ? 'check' : res.result === 'almost' ? 'alert' : 'x', { size: 18 })} <b>${esc(res.result === 'correct' ? pickCorrect() : res.result === 'almost' ? 'Fast richtig' : isDetektiv() ? 'Falsche Fährte' : 'Leider falsch')}</b>` }),
        h('div.fc-sol-word', h('div.grow', { lang: 'de', html: wordHtml(w) }), speakBtn(audioOf(w), { size: 20 })),
        h('div.muted', { text: [w.en, wordInfo(w)].filter(Boolean).join(' · ') }),
        ...(res.notices || []).map((n) => h('div.fb-notice', { html: `${icon('info', { size: 16 })}<span>${esc(n)}</span>` })));
      sol.classList.add(`r-${res.result}`);
      card.appendChild(sol);
      if (mode === 'listen') {
        const result = res.result;
        const nx = h('button.btn.btn-primary.btn-lg.btn-block', { type: 'button', text: 'Weiter', onclick: () => { recordListen(it, result, inp.value); next(); } });
        stage.append(nx);
        setTimeout(() => setKeys((e) => { if (e.key === 'Enter') { e.preventDefault(); nx.click(); } }), 150);
      } else {
        const suggested = res.result === 'correct' ? 3 : res.result === 'almost' ? 2 : 1;
        const grades = gradeRow(it, suggested, (g) => { record(it, g, inp.value); next(); });
        stage.append(grades);
        setTimeout(() => setKeys((e) => {
          if (e.key === 'Enter') { e.preventDefault(); grades.querySelector('.btn-primary')?.click(); }
          else if (/^[1-4]$/.test(e.key)) grades.querySelectorAll('button')[Number(e.key) - 1]?.click();
        }), 150);
      }
      if (res.result !== 'correct' && store.settings.autoplayAudio !== false && mode !== 'listen') setTimeout(() => speak(audioOf(w)), 200);
    };
    checkBtn.onclick = check;
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !done) { e.preventDefault(); check(); } });
    setKeys(null);
    if (!('ontouchstart' in window) || mode === 'listen') setTimeout(() => inp.focus(), 200);
  }

  // ---------- gender + plural
  function showGender(card, it) {
    const w = it.word;
    let art = null;
    const arts = h('div.opts.g-opts', ['der', 'die', 'das'].map((a) => h('button.opt', { type: 'button', class: `g-${a}`, text: a, onclick: () => { if (done) return; art = a; [...arts.children].forEach((b) => b.classList.toggle('sel', b.textContent === a)); upd(); if (!('ontouchstart' in window)) inp.focus(); } })));
    const inp = answerInput({ placeholder: 'Plural, z. B. Tische (oder –)', label: 'Plural' });
    card.append(
      h('div.fc-meta', { html: `${levelBadge(w.lvl || '–')} <span>${esc(w.en)}</span>` }),
      h('div.fc-word', { lang: 'de', html: `<span class="blank"></span> ${esc(w.de)}` }),
      h('div.fc-speak', speakBtn(w.de, { size: 22 })),
      arts,
      h('div.answer-label', { text: 'Plural: die …' }),
      h('div.answer-wrap', inp));
    const checkBtn = h('button.btn.btn-primary.btn-lg.btn-block', { type: 'button', text: isDetektiv() ? 'Beweis prüfen' : 'Prüfen', disabled: true });
    stage.append(checkBtn);
    let done = false;
    function upd() { checkBtn.disabled = !art || !inp.value.trim(); }
    inp.addEventListener('input', upd);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (!checkBtn.disabled) check(); } });
    function check() {
      if (done) return; done = true;
      const okArt = art === G.DEF_NOM[w.g];
      const noPl = !w.pl || w.pl === '-';
      const given = inp.value.trim().replace(/^die\s+/i, '');
      const pr = noPl ? { result: /^(-|–|—|kein.*|keine?n?|0|x)$/i.test(given) ? 'correct' : 'wrong' } : checkText(given, [w.pl], {});
      [...arts.children].forEach((b) => { b.classList.remove('sel'); b.classList.add(b.textContent === G.DEF_NOM[w.g] ? 'ok' : b.textContent === art ? 'no' : 'dim'); });
      arts.classList.add('done');
      inp.readOnly = true; inp.blur();
      inp.classList.add(pr.result === 'correct' ? 'ok' : pr.result === 'almost' ? 'almost' : 'no');
      card.querySelector('.fc-word').innerHTML = wordHtml(w);
      const result = okArt && pr.result === 'correct' ? 'correct' : okArt && pr.result === 'almost' ? 'almost' : 'wrong';
      haptic(result === 'correct' ? 'success' : 'error');
      checkBtn.remove();
      const hint = G.genderHint(w);
      card.appendChild(h('div.fc-solution', { class: `r-${result}` },
        h('div.fc-sol-head', { html: `${icon(result === 'correct' ? 'check' : result === 'almost' ? 'alert' : 'x', { size: 18 })} <b>${esc(result === 'correct' ? pickCorrect() : result === 'almost' ? 'Fast richtig' : isDetektiv() ? 'Falsche Fährte' : 'Nicht ganz')}</b>` }),
        h('div.fc-sol-word', h('div.grow', { lang: 'de', html: `${wordHtml(w)} · <span class="g-pl">${esc(noPl ? 'kein Plural' : `die ${w.pl}`)}</span>` }), speakBtn(noPl ? audioOf(w) : `${audioOf(w)}, die ${w.pl}`, { size: 20 })),
        hint && hint.g === w.g ? h('div.fb-why', { html: md(hint.rule || `Endung **-${hint.suffix}** → ${G.DEF_NOM[hint.g]}`) }) : null));
      const grades = gradeRow(it, result === 'correct' ? 3 : result === 'almost' ? 2 : 1, (g) => { record(it, g, `${art} ${given}`); next(); });
      stage.append(grades);
      setTimeout(() => setKeys((e) => {
        if (e.key === 'Enter') { e.preventDefault(); grades.querySelector('.btn-primary')?.click(); }
        else if (/^[1-4]$/.test(e.key)) grades.querySelectorAll('button')[Number(e.key) - 1]?.click();
      }), 150);
    }
    checkBtn.onclick = check;
    setKeys((e) => { if (done || e.target.matches?.('input, textarea')) return; const k = { 1: 'der', 2: 'die', 3: 'das' }[e.key]; if (k) [...arts.children].find((b) => b.textContent === k)?.click(); });
  }

  // ---------- grading
  function gradeRow(it, suggested, onGrade) {
    const card = store.getCard(it.cardId) || srs.newCard(it.cardId);
    const iv = srs.previewIntervals(card);
    const labels = [[1, 'Nochmal', 'again'], [2, 'Schwer', 'hard'], [3, 'Gut', 'good'], [4, 'Leicht', 'easy']];
    return h('div.grade-row', labels.map(([g, l, cls]) => h('button.btn.grade', {
      type: 'button', class: `gr-${cls}${suggested === g ? ' btn-primary' : ''}`,
      html: `<b>${l}</b><small>${esc(srs.formatInterval(iv[g]))}</small>`,
      onclick: (e) => { e.currentTarget.disabled = true; onGrade(g); },
    })));
  }
  function record(it, grade, given = '') {
    const w = it.word;
    const result = grade >= 3 ? 'correct' : grade === 2 ? 'almost' : 'wrong';
    let out = { xp: 0 };
    try {
      out = store.recordAttempt({ id: it.cardId, card: it.cardId, kind: 'word', result, grade, given, expected: dir === 'g' ? `${displayWord(w)}, die ${w.pl}` : displayWord(w), prompt: dir === 'de-en' ? displayWord(w) : w.en, why: `**${displayWord(w)}** — ${w.en}` });
    } catch (e) { console.error(e); }
    seen++; if (result === 'correct') right++;
    xp += out.xp || 0;
    xpBurst(out.xp, progEl);
  }
  function recordListen(it, result, given) {
    const w = it.word;
    let out = { xp: 0 };
    try { out = store.recordAttempt({ id: `listen:${w.key}`, kind: 'word', result, given, expected: displayWord(w), prompt: '🔊 Hören', why: `**${displayWord(w)}** — ${w.en}` }); } catch (e) { console.error(e); }
    seen++; if (result === 'correct') right++;
    xp += out.xp || 0;
    xpBurst(out.xp, progEl);
  }
  function next() { i++; window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' }); show(); }

  function summary() {
    setKeys(null);
    progEl.innerHTML = bar(1);
    const acc = seen ? right / seen : 0;
    const perfect = seen >= 5 && right === seen;
    stage.replaceChildren(h('div.card.flash-sum',
      isDetektiv() ? h('div', { html: MOTIF.magnifier }) : null,
      h('h2', { text: perfect ? (isDetektiv() ? 'Es gibt nur eine Wahrheit!' : 'Alles gewusst!') : isDetektiv() ? 'Verhör beendet' : 'Runde geschafft!' }),
      h('div.sum-stats',
        h('div.sum-stat', h('b', { text: `${right}/${seen}` }), h('span', { text: 'gewusst' })),
        h('div.sum-stat', h('b', { text: `${Math.round(acc * 100)}%` }), h('span', { text: 'Treffer' })),
        h('div.sum-stat', h('b', { text: `+${xp}` }), h('span', { text: 'XP' }))),
      h('div.sum-actions',
        h('button.btn.btn-primary.btn-lg', { type: 'button', html: `${icon('repeat', { size: 18 })} Nächste Runde`, onclick: () => ctx.nav(location.hash, null) }),
        h('a.btn.btn-ghost', { href: '#/vocab', text: 'Fertig' }))));
  }

  show();
  return () => setKeys(null);
}

const pickCorrect = () => { const l = isDetektiv() ? ['Fall gelöst!', 'Treffer!', 'Beweis gesichert!'] : ['Richtig!', 'Genau!', 'Super!']; return l[Math.floor(Math.random() * l.length)]; };

/** Accepted German forms for typed answers (nouns with article). */
function expectedForms(w) {
  if (w.pos === 'noun') return [w.g === 'pl' ? `die ${w.de}` : `${G.DEF_NOM[w.g]} ${w.de}`];
  if (w.pos === 'verb' && w.refl && !w.de.startsWith('sich ')) return [`sich ${w.de}`, w.de];
  return [w.de];
}

/**
 * Deck for a flashcard round: due cards of this direction first, then fresh material.
 * → [{word, cardId, isNew}] (max 20)
 */
function buildDeck(content, store, dir, f) {
  const N = 20;
  const now = Date.now();
  const cards = store.state.cards;
  let pool = content.words.filter((w) => matchesFilter(w, f));
  if (dir === 'g') pool = pool.filter((w) => w.pos === 'noun' && ['m', 'f', 'n'].includes(w.g));
  const byKey = new Map(pool.map((w) => [w.key, w]));
  const rng = makeRng(now);
  const out = [];
  const have = new Set();
  const add = (w, cid, isNew = false) => { if (!w || have.has(w.key) || out.length >= N) return; have.add(w.key); out.push({ word: w, cardId: cid, isNew }); };
  const cdir = dir === 'listen' ? 'de-en' : dir;

  // 1. due
  if (dir !== 'listen') {
    for (const c of srs.dueCards(cards, now, { prefix: 'w:' })) {
      if (!c.id.endsWith(`|${cdir}`)) continue;
      const p = srs.parseCardId(c.id);
      add(byKey.get(p.wordKey), c.id);
    }
  }
  const known = pool.filter((w) => { const c = cards[srs.cardId.word(w.key, 'de-en')]; return c && c.state !== 'new'; });
  if (dir === 'de-en') {
    // 2. new words within today's allowance (at least 5 when nothing is due)
    const leftToday = Math.max(0, (store.settings.newWordsPerDay ?? 10) - (store.today().newWords || 0));
    const nNew = Math.max(leftToday, out.length ? 0 : 5);
    const fresh = pool.filter((w) => !cards[srs.cardId.word(w.key, 'de-en')]).sort((a, b) => G.levelIdx(a.lvl) - G.levelIdx(b.lvl));
    for (const w of fresh.slice(0, nNew)) add(w, srs.cardId.word(w.key, 'de-en'), true);
    // 3. top up with the most-forgotten known words (early review)
    fillWeakest(known, 'de-en');
  } else if (dir === 'en-de' || dir === 'g') {
    // words already met in de→en, missing this card → introduce; then weakest
    for (const w of rng.shuffle([...known])) if (!cards[srs.cardId.word(w.key, cdir)]) add(w, srs.cardId.word(w.key, cdir));
    fillWeakest(known.filter((w) => cards[srs.cardId.word(w.key, cdir)]), cdir);
    if (dir === 'g' && out.length < N) for (const w of pool.filter((x) => !cards[srs.cardId.word(x.key, 'g')]).sort((a, b) => G.levelIdx(a.lvl) - G.levelIdx(b.lvl)).slice(0, 40)) add(w, srs.cardId.word(w.key, 'g'));
  } else {
    // listening: known words first, then easy words
    for (const w of rng.shuffle([...known])) add(w, null);
    const easy = pool.filter((w) => G.levelIdx(w.lvl) <= 1 && w.pos !== 'phrase');
    for (const w of rng.shuffle([...easy]).slice(0, 60)) add(w, null);
  }
  return out;

  function fillWeakest(list, d) {
    if (out.length >= N) return;
    const scored = list.map((w) => { const c = cards[srs.cardId.word(w.key, d)]; return { w, r: c ? srs.retrievability(c, now) : 0 }; }).sort((a, b) => a.r - b.r);
    for (const { w } of scored.slice(0, N)) add(w, srs.cardId.word(w.key, d));
  }
}
