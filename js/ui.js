// UI toolkit: DOM helpers, inline markup, icons, theme copy, toasts, sheets, rings, umlaut bar, speaker buttons.
// Vanilla, no dependencies. See docs/UI_NOTES.md for the component API.
import { store } from './store.js';
import { tts } from './tts.js';

// ------------------------------------------------------------------ DOM helpers
/** Escape text for innerHTML. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * h('div.card.big#id', {onclick, dataset:{x:1}, html:'<b>..</b>', text:'..', style:{}, attrs}, ...children)
 * children: Node | string (text) | array | null/false (skipped).
 */
export function h(sel, props = {}, ...children) {
  if (props == null || typeof props !== 'object' || props instanceof Node || Array.isArray(props)) { children.unshift(props); props = {}; }
  const m = /^([a-z0-9-]*)((?:[.#][\w-]+)*)$/i.exec(sel) || [];
  const el = document.createElement(m[1] || 'div');
  for (const part of (m[2] || '').match(/[.#][\w-]+/g) || []) {
    if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
  }
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== 'string' && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === true) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
/** Parse an HTML string into a single element (or fragment if several roots). */
export function frag(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.childElementCount === 1 ? t.content.firstElementChild : t.content;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const pct = (x) => `${Math.round((x || 0) * 100)} %`;

/** Light haptic tick where supported (Android; iOS Safari ignores). */
export function haptic(kind = 'light') {
  try { navigator.vibrate?.(kind === 'error' ? [30, 40, 30] : kind === 'success' ? 18 : 8); } catch { /* ignore */ }
}

// ------------------------------------------------------------------ inline markup
const GAP_TOKEN = '\u0000GAP\u0000';
/**
 * Render the content markup to HTML: **bold**, _italic_, ==highlight==, ✗/✓ marks. Input is escaped first.
 * opts.gap: html to use for each ___ (default a blank chip). opts.strip: return plain text without markup.
 */
export function md(text, opts = {}) {
  let s = String(text ?? '');
  if (opts.strip) return stripMd(s);
  s = s.replace(/_{3,}/g, GAP_TOKEN);
  s = esc(s);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/==(.+?)==/g, '<mark>$1</mark>');
  s = s.replace(/(^|[\s(„"“‚'>/—–-])_([^_\n]+?)_(?=$|[\s.,;:!?)"“”'’<…/—–-])/g, '$1<em>$2</em>');
  s = s.replace(/✗/g, '<span class="mk-x">✗</span>').replace(/✓/g, '<span class="mk-ok">✓</span>');
  s = s.replace(new RegExp(GAP_TOKEN, 'g'), opts.gap ?? '<span class="blank" aria-label="Lücke">&nbsp;</span>');
  return s;
}
/** Remove markup: '**der** ==Tisch==' → 'der Tisch'. */
export function stripMd(s) {
  return String(s ?? '').replace(/\*\*|==/g, '').replace(/(^|\s)_([^_]+?)_(?=\s|$|[.,;:!?])/g, '$1$2');
}

// ------------------------------------------------------------------ icons (stroke icons, 24×24, currentColor)
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  path: '<circle cx="6" cy="5" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="6" cy="19" r="2"/><path d="M8 5h6a4 4 0 0 1 0 8H10a4 4 0 0 0 0 8"/>',
  practice: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  vocab: '<rect x="3" y="4" width="13" height="16" rx="2"/><path d="M16 7h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-1"/><path d="M7 9h5M7 13h4"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  review: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/>',
  exam: '<path d="M9 3h6v3H9z"/><path d="M8 4.5H6a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5.5a1 1 0 0 0-1-1h-2"/><path d="m9 13 2 2 4-4"/>',
  reference: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  speaker: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  turtle: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="m15 6-6 6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  flame: '<path d="M12 22c4 0 7-2.7 7-6.8 0-3.6-2.4-5.6-4-8.2-.6 2-1.6 3-3 3.5.4-3-1-6.3-3.5-8.5C8.8 5.5 5 8.6 5 15.2 5 19.3 8 22 12 22z"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  play: '<path d="M7 4.5v15a.8.8 0 0 0 1.2.7l12-7.5a.8.8 0 0 0 0-1.4l-12-7.5A.8.8 0 0 0 7 4.5z"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  infinity: '<path d="M12 12c-2-2.7-3.6-4-5.5-4a4 4 0 0 0 0 8c1.9 0 3.5-1.3 5.5-4zm0 0c2 2.7 3.6 4 5.5 4a4 4 0 0 0 0-8c-1.9 0-3.5 1.3-5.5 4z"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5A2.5 2.5 0 0 1 6.5 19H20v3H6.5"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  lightbulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  keyboard: '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 15h10"/>',
  headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="17" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  sparkles: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  magnifier: '<circle cx="10" cy="10" r="6.5"/><path d="m14.8 14.8 6 6" stroke-width="3"/><path d="M7 8.2a3.5 3.5 0 0 1 2.2-1.9" opacity=".6"/>',
  bowtie: '<path d="M2.5 7v10l7-3.2v-3.6zM21.5 7v10l-7-3.2v-3.6z" fill="currentColor" stroke-linejoin="round"/><rect x="9.5" y="9.5" width="5" height="5" rx="1.2" fill="currentColor"/>',
};
/** Inline SVG icon markup. icon('speaker', {size: 20, cls: 'x'}) */
export function icon(name, { size = 24, cls = '', fill = false } = {}) {
  return `<svg class="ic ic-${name} ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] || ''}</svg>`;
}
/** Same as icon(), as a DOM node. */
export const iconEl = (name, opts) => frag(icon(name, opts));

/** Original SVG motifs for the Detektiv theme (magnifier, bow tie). */
export const MOTIF = {
  magnifier: `<svg class="motif motif-mag" viewBox="0 0 64 64" aria-hidden="true"><circle cx="26" cy="26" r="17" fill="var(--motif-glass)" stroke="var(--yellow)" stroke-width="6"/><path d="M38.5 38.5 56 56" stroke="var(--yellow)" stroke-width="8" stroke-linecap="round"/><path d="M16 21a11 11 0 0 1 8-8" stroke="#fff" stroke-opacity=".7" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
  bowtie: `<svg class="motif motif-bow" viewBox="0 0 64 32" aria-hidden="true"><path d="M3 4c0-2 2-3 4-2l20 10v8L7 30c-2 1-4 0-4-2z" fill="var(--red)"/><path d="M61 4c0-2-2-3-4-2L37 12v8l20 10c2 1 4 0 4-2z" fill="var(--red)"/><rect x="25" y="9" width="14" height="14" rx="4" fill="var(--red-deep)"/></svg>`,
};

// ------------------------------------------------------------------ theme + copy
export const isDetektiv = () => document.documentElement.dataset.theme === 'detektiv';

const COPY = {
  klassisch: {
    correct: ['Richtig!', 'Genau!', 'Super!', 'Sehr gut!', 'Perfekt!'], almost: 'Fast richtig', wrong: 'Leider falsch',
    session: 'Übung', newSession: 'Neue Übung', perfect: 'Alles richtig!', done: 'Geschafft!', lesson: 'Lektion',
    lessons: 'Lektionen', today: 'Heute üben', check: 'Prüfen', next: 'Weiter', path: 'Lernpfad', topic: 'Thema',
    dontKnow: 'Weiß ich nicht', summaryTitle: 'Übung beendet', rule: 'Regel', tip: 'Tipp', pitfall: 'Typischer Fehler',
  },
  detektiv: {
    correct: ['Fall gelöst!', 'Treffer!', 'Messerscharf kombiniert!', 'Beweis gesichert!', 'Volltreffer!'], almost: 'Fast gelöst — eine Spur fehlt', wrong: 'Falsche Fährte',
    session: 'Fall', newSession: 'Neuer Fall', perfect: 'Es gibt nur eine Wahrheit!', done: 'Fall abgeschlossen', lesson: 'Akte',
    lessons: 'Akten', today: 'Neuer Fall', check: 'Beweis prüfen', next: 'Nächste Spur', path: 'Fallakten', topic: 'Akte',
    dontKnow: 'Keine Spur', summaryTitle: 'Fall abgeschlossen', rule: 'Beweisstück', tip: 'Hinweis', pitfall: 'Achtung, Falle!',
  },
};
/** Theme-aware copy: t('correct') → random pick if the entry is a list. */
export function t(key) {
  const v = (isDetektiv() ? COPY.detektiv : COPY.klassisch)[key] ?? COPY.klassisch[key] ?? key;
  return Array.isArray(v) ? v[Math.floor(Math.random() * v.length)] : v;
}

/** Resolve settings → <html data-theme data-scheme data-mode> + meta theme-color. */
export function applyTheme(settings = store.settings) {
  const r = document.documentElement;
  r.dataset.theme = settings.theme === 'detektiv' ? 'detektiv' : 'klassisch';
  r.dataset.scheme = settings.colorScheme || 'auto';
  const dark = settings.colorScheme === 'dark' || (settings.colorScheme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  r.dataset.mode = dark ? 'dark' : 'light';
  r.classList.toggle('no-umlautbar', settings.umlautBar === false);
  const bar = getComputedStyle(r).getPropertyValue('--chrome').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && bar) meta.setAttribute('content', bar);
}

// ------------------------------------------------------------------ progress ring / bar
/**
 * SVG progress ring. ring(0.42, {size:56, stroke:6, label:'42 %', sub:'', cls:'', color:'var(--accent)'})
 * Returns an HTML string.
 */
export function ring(value, { size = 56, stroke = 6, label = null, sub = null, cls = '', color = null, track = null } = {}) {
  const v = Math.max(0, Math.min(1, value || 0));
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const lab = label === null ? `${Math.round(v * 100)}` : label;
  return `<div class="ring ${cls}" style="--size:${size}px" role="img" aria-label="${esc(String(lab))}${sub ? ' ' + esc(sub) : ''}">
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none"${track ? ` style="stroke:${track}"` : ''}/>
<circle class="ring-val" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none" stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - v)).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"${color ? ` style="stroke:${color}"` : ''}/></svg>
<div class="ring-label"><b>${esc(String(lab))}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div></div>`;
}
/** Thin progress bar HTML. */
export function bar(value, { cls = '', color = null } = {}) {
  const v = Math.max(0, Math.min(1, value || 0));
  return `<div class="pbar ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(v * 100)}"><i style="width:${(v * 100).toFixed(1)}%${color ? `;background:${color}` : ''}"></i></div>`;
}
/** Colour for a mastery value (0..1). */
export function masteryColor(v) {
  if (v >= 0.8) return 'var(--good)';
  if (v >= 0.4) return 'var(--accent)';
  if (v > 0) return 'var(--warn)';
  return 'var(--muted-2)';
}

// ------------------------------------------------------------------ toasts
/** toast('Gespeichert', {icon:'check', type:'good'|'bad'|'info'|'xp', ms:2200}) */
export function toast(msg, { icon: ic = null, type = 'info', ms = 2200 } = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = h('div.toast', { class: `toast-${type}`, role: 'status', html: `${ic ? icon(ic, { size: 18 }) : ''}<span>${md(msg)}</span>` });
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ms);
}

/** Floating "+10 XP" bubble near an element (or the top centre). */
export function xpBurst(n, anchor = null) {
  if (!n) return;
  const el = h('div.xp-burst', { text: `+${n} XP` });
  const r = anchor?.getBoundingClientRect?.();
  el.style.left = r ? `${r.left + r.width / 2}px` : '50%';
  el.style.top = r ? `${r.top}px` : '18%';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

// ------------------------------------------------------------------ sheets (bottom sheet / dialog)
let sheetStack = [];
/**
 * Bottom sheet. sheet({title, body: Node|string, actions:[{label, primary, danger, onClick(close)}], onClose, cls})
 * → {el, body, close()}. Escape / backdrop tap / close button dismiss it. Focus is trapped loosely (first button).
 */
export function sheet({ title = '', body = null, actions = [], onClose = null, cls = '', dismissible = true } = {}) {
  const root = document.getElementById('overlay-root') || document.body;
  const backdrop = h('div.sheet-backdrop');
  const bodyEl = h('div.sheet-body');
  if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
  const panel = h('div.sheet', { class: cls, role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog' },
    h('div.sheet-grip', { 'aria-hidden': 'true' }),
    title ? h('div.sheet-head', h('h2.sheet-title', { text: title }), dismissible ? h('button.icon-btn.sheet-x', { 'aria-label': 'Schließen', html: icon('close', { size: 20 }), onclick: () => close() }) : null) : null,
    bodyEl,
    actions.length ? h('div.sheet-actions', actions.map((a) => h('button.btn', {
      class: a.primary ? 'btn-primary' : a.danger ? 'btn-danger' : 'btn-secondary', text: a.label,
      onclick: () => a.onClick ? a.onClick(close) : close(),
    }))) : null);
  const wrap = h('div.sheet-wrap', backdrop, panel);
  let closed = false;
  function close(reason) {
    if (closed) return; closed = true;
    wrap.classList.remove('in'); wrap.classList.add('out');
    document.removeEventListener('keydown', onKey);
    sheetStack = sheetStack.filter((s) => s !== api);
    setTimeout(() => wrap.remove(), reducedMotion() ? 0 : 260);
    onClose && onClose(reason);
  }
  const onKey = (e) => { if (e.key === 'Escape' && dismissible && sheetStack[sheetStack.length - 1] === api) close('escape'); };
  if (dismissible) backdrop.addEventListener('click', () => close('backdrop'));
  document.addEventListener('keydown', onKey);
  // swipe down on the grip/head to dismiss
  let y0 = null;
  panel.addEventListener('touchstart', (e) => { if (panel.scrollTop <= 0 && dismissible) y0 = e.touches[0].clientY; }, { passive: true });
  panel.addEventListener('touchmove', (e) => { if (y0 == null) return; const dy = e.touches[0].clientY - y0; if (dy > 0) panel.style.transform = `translateY(${dy}px)`; }, { passive: true });
  panel.addEventListener('touchend', (e) => {
    if (y0 == null) return; const dy = e.changedTouches[0].clientY - y0; y0 = null;
    panel.style.transform = ''; if (dy > 90) close('swipe');
  });
  root.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('in'));
  const api = { el: panel, body: bodyEl, close };
  sheetStack.push(api);
  setTimeout(() => (panel.querySelector('.btn-primary, input, button') || panel).focus?.({ preventScroll: true }), 50);
  return api;
}
/** Promise-based confirm sheet → true/false. */
export function confirmSheet({ title, text = '', ok = 'OK', cancel = 'Abbrechen', danger = false }) {
  return new Promise((resolve) => {
    let res = false;
    sheet({
      title, body: `<p class="sheet-text">${md(text)}</p>`, onClose: () => resolve(res),
      actions: [{ label: cancel }, { label: ok, primary: !danger, danger, onClick: (close) => { res = true; close(); } }],
    });
  });
}
/** Close every open sheet (used on navigation). */
export function closeAllSheets() { [...sheetStack].forEach((s) => s.close('nav')); }

// ------------------------------------------------------------------ segmented control / chips
/**
 * segmented([{value, label}], current, onChange) → element (role=tablist). Keeps its own selection state.
 */
export function segmented(options, current, onChange, { cls = '' } = {}) {
  const el = h('div.segmented', { role: 'tablist', class: cls });
  for (const o of options) {
    const b = h('button.seg', { role: 'tab', type: 'button', 'aria-selected': String(o.value === current), html: o.html || esc(o.label), dataset: { value: o.value } });
    b.addEventListener('click', () => {
      for (const x of el.children) x.setAttribute('aria-selected', String(x === b));
      onChange(o.value);
    });
    el.appendChild(b);
  }
  return el;
}

// ------------------------------------------------------------------ speaker button
/**
 * speakBtn(text, {size, label, slow}) → <button> that speaks German text via tts. Visually pulses while speaking.
 */
export function speakBtn(text, { size = 20, label = 'Anhören', slow = false, cls = '' } = {}) {
  const b = h('button.speak-btn', { type: 'button', class: cls, 'aria-label': slow ? 'Langsam anhören' : label, html: icon(slow ? 'turtle' : 'speaker', { size }) });
  b.addEventListener('click', (e) => { e.stopPropagation(); speak(text, { slow, btn: b }); });
  if (!tts.supported) b.hidden = true;
  return b;
}
/** Speak with the user's rate (slow = 0.7×). Marks btn as .speaking while playing. */
export async function speak(text, { slow = false, btn = null } = {}) {
  if (!text) return;
  const rate = (store.settings.ttsRate || 0.9) * (slow ? 0.7 : 1);
  btn?.classList.add('speaking');
  try { await tts.speak(text, { rate }); } finally { btn?.classList.remove('speaking'); }
}

// ------------------------------------------------------------------ text inputs + umlaut bar
/** Standard answer input attributes (no autocorrect / autocapitalize / spellcheck). */
export function answerInput({ placeholder = '', multiline = false, cls = '', value = '', label = 'Antwort' } = {}) {
  const el = multiline ? h('textarea.answer', { rows: 1, class: cls }) : h('input.answer', { type: 'text', class: cls, enterkeyhint: 'done' });
  el.setAttribute('autocapitalize', 'off'); el.setAttribute('autocorrect', 'off'); el.setAttribute('autocomplete', 'off');
  el.setAttribute('spellcheck', 'false'); el.setAttribute('aria-label', label); el.setAttribute('lang', 'de');
  el.dataset.umlaut = '1';
  if (placeholder) el.placeholder = placeholder;
  if (value) el.value = value;
  if (multiline) {
    const grow = () => { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; };
    el.addEventListener('input', grow);
    requestAnimationFrame(grow);
  }
  return el;
}

/** Insert text at the caret of an input/textarea and fire 'input'. */
export function insertAtCursor(el, text) {
  const s = el.selectionStart ?? el.value.length, e = el.selectionEnd ?? el.value.length;
  el.value = el.value.slice(0, s) + text + el.value.slice(e);
  const p = s + text.length;
  try { el.setSelectionRange(p, p); } catch { /* ignore */ }
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

const UMLAUTS = ['ä', 'ö', 'ü', 'ß'];
const UPPER = { ä: 'Ä', ö: 'Ö', ü: 'Ü', ß: 'ß' };
let activeInput = null;
/**
 * Global umlaut bar + keyboard tracking. Shows above the on-screen keyboard while an input with
 * data-umlaut is focused. Sets CSS vars --kb (keyboard height) and --ub (umlaut bar height) on <html>
 * and classes .kb-open / .ub-open so fixed footers can sit above them.
 * Keys are lower case; ⇧ capitalises the next umlaut only (like the iOS keyboard), then switches off.
 */
export function initKeyboard() {
  const barEl = document.getElementById('umlautbar');
  const root = document.documentElement;
  if (barEl && !barEl.childElementCount) {
    let shift = false;
    const keys = [];
    const setShift = (on) => {
      shift = on;
      shiftBtn.classList.toggle('on', on);
      shiftBtn.setAttribute('aria-pressed', String(on));
      for (const [b, ch] of keys) b.textContent = on ? UPPER[ch] : ch;
    };
    // pointerdown + preventDefault keeps the focus (and the keyboard) on the input;
    // click with detail 0 = keyboard/assistive activation (no pointerdown happened)
    const press = (b, fn) => {
      let viaPointer = false;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); viaPointer = true; fn(); });
      b.addEventListener('click', (e) => { e.preventDefault(); if (!viaPointer) fn(); viaPointer = false; });
    };
    const shiftBtn = h('button.uml.uml-shift', { type: 'button', text: '⇧', 'aria-label': 'Großbuchstabe', 'aria-pressed': 'false', tabindex: '-1' });
    press(shiftBtn, () => setShift(!shift));
    barEl.appendChild(shiftBtn);
    for (const ch of UMLAUTS) {
      const b = h('button.uml', { type: 'button', text: ch, 'aria-label': `${ch} einfügen`, tabindex: '-1' });
      press(b, () => {
        if (!activeInput) return;
        insertAtCursor(activeInput, shift ? UPPER[ch] : ch);
        haptic();
        if (shift) setShift(false);
      });
      keys.push([b, ch]);
      barEl.appendChild(b);
    }
  }
  const isText = (el) => el && el.matches?.('input[data-umlaut]:not([readonly]), textarea[data-umlaut]:not([readonly])');
  const update = () => {
    const vv = window.visualViewport;
    const kb = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
    root.style.setProperty('--kb', `${kb}px`);
    root.classList.toggle('kb-open', kb > 80);
    const show = !!activeInput && store.settings.umlautBar !== false;
    if (barEl) barEl.hidden = !show;
    root.classList.toggle('ub-open', show);
    if (show && activeInput && kb > 80) {
      // keep the focused field visible above keyboard + bar
      const r = activeInput.getBoundingClientRect();
      const limit = (vv ? vv.height + vv.offsetTop : window.innerHeight) - 120;
      if (r.bottom > limit) activeInput.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  };
  document.addEventListener('focusin', (e) => { if (isText(e.target)) { activeInput = e.target; update(); } });
  document.addEventListener('focusout', () => {
    setTimeout(() => { if (!isText(document.activeElement)) { activeInput = null; update(); } }, 60);
  });
  window.visualViewport?.addEventListener('resize', update);
  window.visualViewport?.addEventListener('scroll', update);
  update();
}

// ------------------------------------------------------------------ misc components
/** Section header HTML. */
export const sectionHead = (title, extra = '') => `<div class="sec-head"><h2>${esc(title)}</h2>${extra}</div>`;

/** Empty-state block. */
export function empty(text, { ic = 'sparkles', action = null } = {}) {
  return h('div.empty', { html: `${icon(ic, { size: 32 })}<p>${md(text)}</p>` }, action);
}

/** Level badge HTML ('A1' → coloured pill). */
export const levelBadge = (lvl) => `<span class="lvl lvl-${esc(String(lvl).toLowerCase())}">${esc(lvl)}</span>`;

/** Gender-coloured noun: der blue / die red / das green. genderWord('der Tisch', 'm') */
export function genderClass(g) { return g === 'm' ? 'g-m' : g === 'f' ? 'g-f' : g === 'n' ? 'g-n' : g === 'pl' ? 'g-pl' : ''; }

/** Format a number with German thousands separators. */
export const num = (n) => Number(n || 0).toLocaleString('de-DE');

/** Greeting by local time. */
export function greeting(d = new Date()) {
  const hr = d.getHours();
  return hr < 5 ? 'Gute Nacht' : hr < 11 ? 'Guten Morgen' : hr < 18 ? 'Guten Tag' : 'Guten Abend';
}

/** Page header with optional back button. Returns element. */
export function pageHeader({ title, sub = '', back = null, right = null, kicker = '' }) {
  return h('header.page-head',
    back ? h('button.icon-btn.back-btn', { 'aria-label': 'Zurück', html: icon('back'), onclick: () => (typeof back === 'function' ? back() : (history.length > 1 ? history.back() : (location.hash = back))) }) : null,
    h('div.page-head-text', kicker ? h('div.kicker', { html: kicker }) : null, h('h1', { html: md(title) }), sub ? h('p.page-sub', { html: md(sub) }) : null),
    right);
}
