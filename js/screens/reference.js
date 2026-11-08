// Nachschlagen: one search over lesson rules/tables, verbs and nouns; browse tabs; verb conjugation
// (#/reference/verb/<inf>: all tenses, compound tenses built from aux + Partizip II), noun declension
// (#/reference/noun/<wordKey>) and a topic cheat sheet (#/reference/rule/<topicId>: rules, tables, tips, pitfalls).
import { h, md, esc, icon, pageHeader, segmented, answerInput, speakBtn, levelBadge, genderClass, isDetektiv, empty, sectionHead, stripMd, num } from '../ui.js';
import { renderBlock } from './topic.js';
import * as G from '../german.js';
import { fold } from '../checker.js';
import { displayWord } from '../drills/index.js';

const UI_KEY = 'dd.ui.reference';
const loadUi = () => { try { return JSON.parse(localStorage.getItem(UI_KEY) || '{}'); } catch { return {}; } };
const saveUi = (o) => { try { localStorage.setItem(UI_KEY, JSON.stringify({ ...loadUi(), ...o })); } catch { /* ignore */ } };

const HAETTE = ['hätte', 'hättest', 'hätte', 'hätten', 'hättet', 'hätten'];
const WAERE = ['wäre', 'wärst', 'wäre', 'wären', 'wärt', 'wären'];
const SEARCH_TYPES = new Set(['rule', 'tip', 'pitfall', 'table', 'p', 'list', 'examples']);

export async function render(root, ctx) {
  const { kind, q } = ctx.params;
  if (kind === 'verb') return verbPage(root, ctx, q);
  if (kind === 'noun') return nounPage(root, ctx, q);
  if (kind === 'rule') return rulePage(root, ctx, q);
  return landing(root, ctx);
}

// ====================================================================== landing + search
let blockIndex = null; // [{topicId, level, title, block, text, prio}]
async function buildIndex(content) {
  if (blockIndex) return blockIndex;
  const all = await content.loadAllTopics();
  const out = [];
  for (const m of content.topics) {
    const tp = all[m.id];
    if (!tp) continue;
    let heading = '';
    for (const b of tp.lesson || []) {
      if (b.type === 'h') { heading = stripMd(b.text); continue; }
      if (!SEARCH_TYPES.has(b.type)) continue;
      const text = blockText(b);
      if (!text) continue;
      const prio = b.type === 'rule' ? 0 : b.type === 'table' ? 1 : b.type === 'pitfall' || b.type === 'tip' ? 2 : 3;
      out.push({ topicId: m.id, level: m.level, title: m.title, heading, block: b, text: fold(`${m.title} ${heading} ${text}`), prio });
    }
  }
  blockIndex = out;
  return out;
}
function blockText(b) {
  if (b.type === 'table') return stripMd([b.caption, ...(b.head || []), ...(b.rows || []).flat()].filter(Boolean).join(' '));
  if (b.type === 'list') return stripMd((b.items || []).join(' '));
  if (b.type === 'examples') return stripMd((b.items || []).map((i) => `${i.de} ${i.en || ''}`).join(' '));
  return stripMd(b.text || '');
}

function landing(root, ctx) {
  const { content, nav } = ctx;
  const det = isDetektiv();
  const ui = loadUi();
  let tab = ui.tab || 'rules';
  root.appendChild(pageHeader({ title: det ? 'Beweisarchiv' : 'Nachschlagen', sub: 'Regeln, Tabellen, Verben und Nomen — alles offline.', back: 'more' }));
  const inp = answerInput({ placeholder: 'z. B. Dativ, wegen, fahren, Haus …', label: 'Nachschlagen' });
  inp.type = 'search'; inp.classList.add('search-in'); inp.setAttribute('enterkeyhint', 'search');
  if (ui.q) inp.value = ui.q;
  root.appendChild(h('div.search-wrap', h('span.search-ic', { html: icon('search', { size: 18 }) }), inp));
  const tabs = segmented([{ value: 'rules', label: 'Regeln' }, { value: 'verbs', label: 'Verben' }, { value: 'nouns', label: 'Nomen' }], tab, (v) => { tab = v; saveUi({ tab: v }); draw(); });
  root.appendChild(tabs);
  const out = h('div.ref-out');
  root.appendChild(out);

  let seq = 0;
  async function draw() {
    const my = ++seq;
    const q = inp.value.trim();
    saveUi({ q });
    tabs.hidden = !!q;
    if (q) return search(q, my);
    out.replaceChildren();
    if (tab === 'rules') {
      for (const lv of G.LEVELS) {
        const metas = content.topicsByLevel[lv] || [];
        if (!metas.length) continue;
        out.appendChild(h('div.unit-title', { html: `${levelBadge(lv)} ${esc(content.levels.find((l) => l.id === lv)?.title || lv)}` }));
        out.appendChild(h('div.list', metas.map((m) => h('a.row', { href: `#/reference/rule/${m.id}` },
          h('div.grow', h('div.row-title', { text: m.title }), h('div.row-sub', { text: `${m.unit} · ${m.en}` })),
          h('span', { html: icon('chevron', { size: 18 }), style: { color: 'var(--muted-2)' } })))));
      }
    } else if (tab === 'verbs') {
      const sorted = [...content.verbs].sort((a, b) => a.inf.localeCompare(b.inf, 'de'));
      out.appendChild(h('p.muted.small', { text: `${num(sorted.length)} Verben mit vollständiger Konjugation. Tippe oben, um zu suchen.` }));
      out.appendChild(verbList(sorted));
    } else {
      out.appendChild(h('p.muted.small', { text: `${num(content.wordsByPos.noun?.length || 0)} Nomen: Artikel, Plural und alle vier Fälle. Suche oben nach einem Nomen.` }));
      const sample = ['Haus', 'Frau', 'Kind', 'Mann', 'Name', 'Student', 'Herr', 'Museum', 'Kollege', 'Zimmer', 'Wohnung', 'Auto'].map((d) => content.word(d, 'noun')).filter(Boolean);
      out.appendChild(nounList(sample));
    }
  }

  async function search(q, my) {
    const fq = fold(q);
    const words = fq.split(/\s+/).filter(Boolean);
    out.replaceChildren(h('p.muted.small', { text: 'Suche …' }));
    // verbs
    const verbs = content.verbs.filter((v) => fold(v.inf).startsWith(fq) || v.pres.some((f) => fold(f).split(' ')[0] === fq) || v.prt.some((f) => fold(f).split(' ')[0] === fq) || fold(v.pp) === fq || fold(v.en).includes(fq))
      .sort((a, b) => (fold(a.inf) === fq ? -1 : fold(b.inf) === fq ? 1 : a.inf.length - b.inf.length)).slice(0, 6);
    const nouns = content.searchWords(q, 40).filter((w) => w.pos === 'noun').slice(0, 6);
    const idx = await buildIndex(content);
    if (my !== seq || !ctx.token()) return;
    const hits = idx.filter((x) => words.every((wd) => x.text.includes(wd)))
      .sort((a, b) => a.prio - b.prio || G.levelIdx(a.level) - G.levelIdx(b.level)).slice(0, 24);
    out.replaceChildren();
    if (!verbs.length && !nouns.length && !hits.length) { out.appendChild(empty(`Nichts gefunden für „${q}“.`, { ic: 'search' })); return; }
    if (verbs.length) { out.appendChild(h('div', { html: sectionHead('Verben') })); out.appendChild(verbList(verbs)); }
    if (nouns.length) { out.appendChild(h('div', { html: sectionHead('Nomen') })); out.appendChild(nounList(nouns)); }
    if (hits.length) {
      out.appendChild(h('div', { html: sectionHead(`Regeln & Tabellen`, `<span class="muted small">${hits.length}${hits.length >= 24 ? '+' : ''}</span>`) }));
      for (const x of hits) {
        out.appendChild(h('div.ref-hit',
          h('a.ref-hit-head', { href: `#/reference/rule/${x.topicId}`, html: `${levelBadge(x.level)}<span class="grow">${esc(x.title)}${x.heading ? ` · <span class="muted">${esc(x.heading)}</span>` : ''}</span>${icon('chevron', { size: 16 })}` }),
          renderBlock(x.block)));
      }
    }
  }

  let tmr = 0;
  inp.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(draw, 180); });
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(tmr); draw(); inp.blur(); } });
  draw();
  void nav;
  return () => clearTimeout(tmr);
}

function verbList(verbs) {
  return h('div.list', verbs.map((v) => h('a.row', { href: `#/reference/verb/${encodeURIComponent(v.inf)}` },
    h('div.grow', h('div.row-title', { lang: 'de', html: `${v.refl ? '<span class="muted">sich</span> ' : ''}${esc(v.inf)}` }), h('div.row-sub', { lang: 'de', text: `${v.pres[2]} · ${v.prt[2]} · ${auxWord(v.aux, 2)} ${v.pp}` })),
    h('span.badge', { class: v.type === 'strong' || v.type === 'mixed' ? 'warn' : '', text: TYPE_DE[v.type] || v.type }),
    h('span', { html: icon('chevron', { size: 18 }), style: { color: 'var(--muted-2)' } }))));
}
function nounList(words) {
  return h('div.list', words.map((w) => h('a.row', { href: `#/reference/noun/${encodeURIComponent(w.key)}` },
    h('div.grow', h('div.row-title', { lang: 'de', html: `<span class="${genderClass(w.g)}" style="font-weight:700">${esc(w.g === 'pl' ? 'die' : G.DEF_NOM[w.g])}</span> ${esc(w.de)}` }), h('div.row-sub', { text: `${w.pl && w.pl !== '-' && w.g !== 'pl' ? `die ${w.pl} · ` : ''}${w.en}` })),
    h('span', { html: icon('chevron', { size: 18 }), style: { color: 'var(--muted-2)' } }))));
}
const TYPE_DE = { weak: 'regelmäßig', strong: 'stark', mixed: 'gemischt', modal: 'Modalverb', aux: 'Hilfsverb' };

// ====================================================================== verb page
function auxWord(aux, i, tense = 'pres') {
  const a = String(aux || 'haben');
  const f = (x) => (x === 'sein' ? (tense === 'k2' ? WAERE : G.SEIN[tense]) : (tense === 'k2' ? HAETTE : G.HABEN[tense]))[i];
  return a === 'haben/sein' ? `${f('haben')}/${f('sein')}` : f(a);
}
const auxInf = (aux) => (aux === 'haben/sein' ? 'haben/sein' : aux || 'haben');

/** Build every tense: [{id, title, en, rows:[[person, html, plain]]}] */
export function conjugate(v) {
  const refl = v.refl ? (v.refl === 'dat' ? 'dat' : 'akk') : null;
  const R = (i) => (refl ? G.REFLEXIVE[refl][i] : '');
  const rp = (i) => (refl ? ` <span class="refl">${R(i)}</span>` : '');
  /** finite form with the reflexive pronoun after the first word: 'rege auf' → 'rege mich auf' */
  const fin = (form, i) => {
    const [first, ...rest] = String(form).split(' ');
    return { html: `${esc(first)}${rp(i)}${rest.length ? ' ' + esc(rest.join(' ')) : ''}`, plain: [first, R(i), ...rest].filter(Boolean).join(' ') };
  };
  const comp = (auxF, i, tail) => ({ html: `${esc(auxF)}${rp(i)} ${esc(tail)}`, plain: [auxF, R(i), tail].filter(Boolean).join(' ') });
  const P = G.PERSONS;
  const rows = (fn) => P.map((p, i) => { const r = fn(i); return [p, r.html, r.plain]; });
  const out = [
    { id: 'pres', title: 'Präsens', en: 'present', rows: rows((i) => fin(v.pres[i], i)) },
    { id: 'prt', title: 'Präteritum', en: 'simple past', rows: rows((i) => fin(v.prt[i], i)) },
    { id: 'perf', title: 'Perfekt', en: `${auxInf(v.aux)} + Partizip II`, rows: rows((i) => comp(auxWord(v.aux, i), i, v.pp)) },
    { id: 'plusq', title: 'Plusquamperfekt', en: `${v.aux === 'sein' ? 'war' : v.aux === 'haben/sein' ? 'hatte/war' : 'hatte'} + Partizip II`, rows: rows((i) => comp(auxWord(v.aux, i, 'prt'), i, v.pp)) },
    { id: 'fut', title: 'Futur I', en: 'werden + Infinitiv', rows: rows((i) => comp(G.WERDEN.pres[i], i, v.inf)) },
    { id: 'fut2', title: 'Futur II', en: `werden + Partizip II + ${auxInf(v.aux)}`, rows: rows((i) => comp(G.WERDEN.pres[i], i, `${v.pp} ${auxInf(v.aux)}`)) },
  ];
  if (v.k2?.length === 6) out.push({ id: 'k2', title: 'Konjunktiv II', en: v.type === 'weak' ? 'meist: würde + Infinitiv' : 'Gegenwart', rows: rows((i) => fin(v.k2[i], i)) });
  out.push({ id: 'wuerde', title: 'würde + Infinitiv', en: 'Konjunktiv II (Ersatzform)', rows: rows((i) => comp(G.WERDEN.k2[i], i, v.inf)) });
  out.push({ id: 'k2past', title: 'Konjunktiv II Vergangenheit', en: `${v.aux === 'sein' ? 'wäre' : 'hätte'} + Partizip II`, rows: rows((i) => comp(auxWord(v.aux, i, 'k2'), i, v.pp)) });
  if (v.k1?.length === 6) out.push({ id: 'k1', title: 'Konjunktiv I', en: 'indirekte Rede', rows: rows((i) => fin(v.k1[i], i)) });
  if (v.imp?.length) {
    const pron = ['dich', 'euch', 'sich'];
    const pronD = ['dir', 'euch', 'sich'];
    const labels = ['du', 'ihr', 'Sie'];
    out.push({
      id: 'imp', title: 'Imperativ', en: 'commands',
      rows: v.imp.map((f, i) => {
        if (!refl) return [labels[i], esc(f) + '!', f + '!'];
        const words = String(f).split(' ');
        const pr = (refl === 'dat' ? pronD : pron)[i];
        // 'fahren Sie ab' → 'freuen Sie sich'; 'freu' → 'freu dich'
        const at = i === 2 ? 2 : 1;
        const arr = [...words.slice(0, at), `\u0000${pr}`, ...words.slice(at)];
        return [labels[i], arr.map((x) => (x.startsWith('\u0000') ? `<span class="refl">${esc(x.slice(1))}</span>` : esc(x))).join(' ') + '!', arr.map((x) => x.replace('\u0000', '')).join(' ') + '!'];
      }),
    });
  }
  return out;
}

function verbPage(root, ctx, inf) {
  const { content } = ctx;
  const v = content.verb(inf);
  if (!v) {
    root.appendChild(pageHeader({ title: inf, back: 'reference' }));
    const w = content.word(inf, 'verb');
    if (w) {
      root.appendChild(h('div.card', h('div.kv',
        kvRow('Bedeutung', w.en), kvRow('er/sie/es', w.p3), kvRow('Präteritum', w.prt), kvRow('Perfekt', w.pp ? `${w.aux === 'sein' ? 'ist' : 'hat'} ${w.pp}` : ''))));
      root.appendChild(h('p.muted.small', { text: 'Für dieses Verb gibt es (noch) keine vollständige Tabelle.' }));
    } else root.appendChild(empty('Dieses Verb ist nicht im Nachschlagewerk.', { ic: 'search' }));
    return;
  }
  const w = content.word(v.inf, 'verb');
  root.appendChild(pageHeader({
    title: `${v.refl ? '<span class="muted">sich</span> ' : ''}${esc(v.inf)}`, back: 'reference',
    kicker: `${w?.lvl ? levelBadge(w.lvl) : ''} <span>${esc(TYPE_DE[v.type] || v.type || '')}</span>${v.sep ? ` <span>· trennbar (${esc(v.sep)}-)</span>` : ''}`,
    sub: v.en,
  }));
  root.querySelector('.page-head h1').innerHTML = `${v.refl ? '<span class="muted">sich</span> ' : ''}${esc(v.inf)}`;
  root.appendChild(h('div.card.verb-sum',
    h('div.vs-forms', vsCell('Infinitiv', v.inf), vsCell('Präteritum', v.prt[2]), vsCell('Partizip II', v.pp), vsCell('Hilfsverb', auxInf(v.aux))),
    speakBtn(`${v.inf}, ${v.prt[2]}, ${auxWord(v.aux, 2)} ${v.pp}`, { size: 20 })));
  if (v.aux === 'haben/sein') root.appendChild(h('div.box.lb-tip', h('div.box-label', { html: `${icon('lightbulb', { size: 14 })} haben oder sein?` }), h('div', { html: md('Mit Akkusativobjekt meist **haben** (_Ich habe den Vertrag abgebrochen._), als Bewegung/Zustandsänderung ohne Objekt **sein** (_Der Kontakt ist abgebrochen._).') })));
  const tenses = conjugate(v);
  const jump = h('div.chips', tenses.map((tn) => h('button.chip', { type: 'button', text: tn.title, onclick: () => document.getElementById(`t-${tn.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) })));
  root.appendChild(jump);
  const grid = h('div.conj-grid');
  for (const tn of tenses) {
    grid.appendChild(h('section.card.conj', { id: `t-${tn.id}` },
      h('div.conj-head', h('div.grow', h('h3', { text: tn.title }), h('div.conj-en', { text: tn.en })), speakBtn(tn.rows.map((r) => `${r[0].split('/')[0]} ${r[2]}`).join('. '), { size: 18 })),
      h('div.conj-rows', tn.rows.map((r) => h('div.conj-row', h('span.conj-p', { text: r[0] }), h('span.conj-f', { lang: 'de', html: r[1] }))))));
  }
  root.appendChild(grid);
  if (w?.ex) root.appendChild(h('div.examples', { style: { marginTop: '12px' } }, h('div.exm', h('div.grow', h('div.exm-de', { lang: 'de', text: w.ex }), w.exEn ? h('div.exm-en', { text: w.exEn }) : null), speakBtn(w.ex, { size: 18 }))));
  if (w) root.appendChild(h('a.card.tap', { href: `#/vocab/${encodeURIComponent(w.key)}`, style: { marginTop: '12px' }, html: `<div class="card-row"><div class="grow"><div class="card-title">Als Vokabel öffnen</div><div class="card-sub">Lernstand, Beispiel, Karteikarten</div></div>${icon('chevron', { size: 18 })}</div>` }));
  root.appendChild(h('a.btn.btn-tinted.btn-block', { href: `#/drill/conjugation`, style: { marginTop: '12px' }, html: `${icon('bolt', { size: 18 })} Konjugation drillen` }));
}
const vsCell = (k, v) => h('div.vs-cell', h('span', { text: k }), h('b', { lang: 'de', text: v }));
const kvRow = (k, v) => (v ? h('div.kv-row', h('span.kv-k', { text: k }), h('span.kv-v', { lang: 'de', text: v })) : null);

// ====================================================================== noun page
function nounPage(root, ctx, key) {
  const { content } = ctx;
  const w = content.wordByKey(key) || content.word(key, 'noun');
  if (!w || w.pos !== 'noun') {
    root.appendChild(pageHeader({ title: key, back: 'reference' }));
    root.appendChild(empty('Dieses Nomen ist nicht im Wortschatz.', { ic: 'search' }));
    return;
  }
  const art = w.g === 'pl' ? 'die' : G.DEF_NOM[w.g];
  root.appendChild(pageHeader({ title: w.de, back: 'reference', kicker: `${levelBadge(w.lvl || '–')} <span>${esc(G.GENDER_NAMES[w.g] || '')}</span>${w.weak ? ' <span>· n-Deklination</span>' : ''}`, sub: w.en }));
  root.querySelector('.page-head h1').innerHTML = `<span class="${genderClass(w.g)}">${esc(art)}</span> ${esc(w.de)}`;
  root.appendChild(h('div.card.verb-sum',
    h('div.vs-forms', vsCell('Genus', `${art} (${G.GENDER_NAMES[w.g]})`), vsCell('Plural', w.g === 'pl' ? 'nur Plural' : w.pl && w.pl !== '-' ? `die ${w.pl}` : 'kein Plural'), vsCell('Genitiv', w.g === 'pl' ? `der ${w.de}` : `des ${G.genitiveSg(w).join(' / ')}`.replace(/^des (.*)$/, w.g === 'f' ? 'der $1' : 'des $1'))),
    speakBtn(displayWord(w).replace(/ \(Pl\.\)$/, ''), { size: 20 })));

  const hasSg = w.g !== 'pl';
  const hasPl = w.g === 'pl' || (w.pl && w.pl !== '-');
  const cols = [];
  if (hasSg) cols.push({ label: 'Sg. bestimmt', type: 'def', number: 'sg' }, { label: 'Sg. unbestimmt', type: 'indef', number: 'sg' });
  if (hasPl) cols.push({ label: 'Pl. bestimmt', type: 'def', number: 'pl' }, { label: 'Pl. mit kein', type: 'kein', number: 'pl' });
  const t = h('table.tbl.decl',
    h('thead', h('tr', h('th', { text: '' }), cols.map((c) => h('th', { text: c.label })))),
    h('tbody', G.CASES.map((c) => h('tr', h('td', { text: G.CASE_NAMES[c] }), cols.map((col) => {
      const ph = G.nounPhrase({ type: col.type, c, word: w, number: col.number }) || '—';
      const g = col.number === 'pl' ? 'pl' : w.g;
      const [a, ...rest] = ph.split(' ');
      return h('td', { lang: 'de', html: rest.length ? `<b class="${genderClass(g)}">${esc(a)}</b> ${esc(rest.join(' '))}` : esc(ph) });
    })))));
  root.appendChild(h('div', { html: sectionHead('Alle vier Fälle') }));
  root.appendChild(h('div.tbl-wrap', t));
  const notes = [];
  if (w.weak) notes.push(`**n-Deklination:** außer im Nominativ Singular endet das Nomen auf **-(e)n**: _den ${G.nounForm(w, 'akk')}, dem ${G.nounForm(w, 'dat')}, des ${G.nounForm(w, 'gen')}_.`);
  if (hasPl) notes.push(`**Dativ Plural** bekommt ein **-n**, außer der Plural endet schon auf -n oder -s: _mit den ${G.nounForm(w, 'dat', 'pl')}_.`);
  if (hasSg && (w.g === 'm' || w.g === 'n') && !w.weak) notes.push(`**Genitiv Singular** (maskulin/neutral): **-s** oder **-es** — _des ${G.genitiveSg(w)[0]}_.`);
  const hint = G.genderHint(w);
  if (hint && hint.g === w.g && hint.reliable) notes.push(`**Genus-Tipp:** Nomen auf **-${hint.suffix}** sind fast immer **${G.DEF_NOM[hint.g]}**-Wörter.`);
  if (notes.length) root.appendChild(h('div.box.lb-tip', { style: { marginTop: '4px' } }, h('div.box-label', { html: `${icon('lightbulb', { size: 14 })} Regeln` }), h('ul.lb-list', { style: { margin: '4px 0 0' } }, notes.map((n) => h('li', { html: md(n) })))));
  if (w.ex) root.appendChild(h('div.examples', { style: { marginTop: '12px' } }, h('div.exm', h('div.grow', h('div.exm-de', { lang: 'de', text: w.ex }), w.exEn ? h('div.exm-en', { text: w.exEn }) : null), speakBtn(w.ex, { size: 18 }))));
  root.appendChild(h('a.card.tap', { href: `#/vocab/${encodeURIComponent(w.key)}`, style: { marginTop: '12px' }, html: `<div class="card-row"><div class="grow"><div class="card-title">Als Vokabel öffnen</div><div class="card-sub">Lernstand, Beispiel, Karteikarten</div></div>${icon('chevron', { size: 18 })}</div>` }));
}

// ====================================================================== rule cheat sheet
async function rulePage(root, ctx, id) {
  const { content } = ctx;
  const meta = content.topicMeta(id);
  root.appendChild(pageHeader({ title: meta?.title || id, back: 'reference' }));
  const tp = await content.getTopic(id);
  if (!ctx.token()) return;
  root.replaceChildren();
  const det = isDetektiv();
  root.appendChild(pageHeader({ title: tp?.title || meta?.title || id, back: 'reference', kicker: `${levelBadge(meta?.level || tp?.level || '')} <span>${esc(meta?.unit || '')}</span> <span>· ${det ? 'Beweismittel' : 'Spickzettel'}</span>`, sub: tp?.en || meta?.en }));
  if (!tp) { root.appendChild(empty('Dieses Thema ist noch nicht verfügbar.', { ic: 'book' })); return; }
  if (tp.summary) root.appendChild(h('p.topic-summary', { html: md(tp.summary) }));
  const sheet = h('article.lesson.cheat');
  let heading = null;
  for (const b of tp.lesson || []) {
    if (b.type === 'h') { heading = b; continue; }
    if (!['rule', 'table', 'tip', 'pitfall'].includes(b.type)) continue;
    if (heading) { sheet.appendChild(renderBlock(heading)); heading = null; }
    try { sheet.appendChild(renderBlock(b)); } catch (e) { console.error(e); }
  }
  if (!sheet.childElementCount) sheet.appendChild(empty('Keine Regelkästen in diesem Thema.', { ic: 'book' }));
  root.appendChild(sheet);
  root.appendChild(h('div.practice-bar', { style: { marginTop: '18px' } },
    h('a.btn.btn-secondary.btn-lg', { href: `#/topic/${id}`, html: `${icon('book', { size: 18 })} Ganze ${det ? 'Akte' : 'Lektion'}` }),
    h('a.btn.btn-primary.btn-lg', { href: `#/practice/${id}?m=20`, html: `${icon('play', { size: 18, fill: true })} Üben` })));
}
