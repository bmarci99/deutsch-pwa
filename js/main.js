// Boot: theme, content, router, tab bar, keyboard/umlaut bar, service worker, global store events.
import { loadContent } from './content.js';
import { unlockIfNeeded } from './lock.js';
import { store } from './store.js';
import { tts } from './tts.js';
import { route, start, render as rerender } from './router.js';
import { applyTheme, h, icon, initKeyboard, toast, closeAllSheets, t } from './ui.js';
import { initProgress, loadAllTopicsInBackground } from './progress.js';

const S = (name) => () => import(`./screens/${name}.js`);
// tab: which bottom tab is highlighted · chrome:false hides the tab bar (full-screen session)
route('home', S('home'), { tab: 'home' });
route('path', S('path'), { tab: 'path' });
route('topic/:id', S('topic'), { tab: 'path' });
route('practice/:id', S('session'), { chrome: false });   // topic practice: ?m=20|all|fehler|endlos|diktat
route('drill/:id', S('session'), { chrome: false });      // procedural drill: ?lvl=B1&t=pres,prt
route('session/:kind', S('session'), { chrome: false });  // daily | mix | weak | mistakes
route('ueben', S('practice'), { tab: 'practice' });
route('vocab', S('vocab'), { tab: 'vocab' });
route('vocab/:key', S('vocab'), { tab: 'vocab' });
route('cards', S('vocab'), { tab: 'vocab' });              // flashcards (?dir=de-en|en-de|g|listen)
route('more', S('more'), { tab: 'more' });
route('review', S('review'), { tab: 'more' });
route('exam', S('exam'), { tab: 'more' });
route('exam/:kind', S('exam'), { tab: 'more', chrome: false });
route('reference', S('reference'), { tab: 'more' });
route('reference/:kind/:q', S('reference'), { tab: 'more' });
route('stats', S('stats'), { tab: 'more' });
route('settings', S('settings'), { tab: 'more' });

const TABS = [
  { id: 'home', label: 'Heute', icon: 'home', href: '#/home' },
  { id: 'path', label: 'Lernpfad', icon: 'path', href: '#/path', detektiv: 'Akten' },
  { id: 'practice', label: 'Üben', icon: 'practice', href: '#/ueben' },
  { id: 'vocab', label: 'Vokabeln', icon: 'vocab', href: '#/vocab' },
  { id: 'more', label: 'Mehr', icon: 'more', href: '#/more' },
];

function buildTabbar() {
  const nav = document.getElementById('tabbar');
  nav.replaceChildren(...TABS.map((tb) => h('a.tab', { href: tb.href, dataset: { tab: tb.id }, html: `${icon(tb.icon, { size: 25 })}<span class="tab-label" data-k="${tb.label}" data-d="${tb.detektiv || tb.label}"></span>` })));
}

function onRoute(parsed) {
  closeAllSheets();
  tts.cancel();
  const meta = parsed.route?.meta || {};
  document.documentElement.classList.toggle('no-chrome', meta.chrome === false);
  for (const a of document.querySelectorAll('#tabbar .tab')) {
    const on = a.dataset.tab === meta.tab;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
}

function registerSW() {
  if (!('serviceWorker' in navigator) || location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const offer = () => {
      // first install also passes through "installed" (reg.waiting) — only an update replacing a controller is news
      if (!reg.waiting || !navigator.serviceWorker.controller) return;
      toast('Neue Version verfügbar — tippen zum Aktualisieren', { icon: 'sparkles', ms: 8000 });
      const el = document.querySelector('#toast-root .toast:last-child');
      el?.addEventListener('click', () => reg.waiting?.postMessage({ type: 'SKIP_WAITING' }));
    };
    offer();
    reg.addEventListener('updatefound', () => reg.installing?.addEventListener('statechange', offer));
    // reload only when an update replaces a running version — not when the first install claims this page
    let reloaded = false;
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
  }).catch(() => {});
}

function wireStore() {
  store.on('settings', ({ key, settings }) => {
    applyTheme(settings);
    tts.setRate(settings.ttsRate); tts.setVoice(settings.ttsVoice);
    if (key === 'theme' || key === 'colorScheme' || !key) rerender(true);
  });
  store.on('goal', () => toast(document.documentElement.dataset.theme === 'detektiv' ? 'Tagesziel erreicht — der Fall des Tages ist gelöst!' : 'Tagesziel erreicht! 🎯', { type: 'good', icon: 'target', ms: 3200 }));
  store.on('streak', ({ current }) => { if (current > 1) toast(`🔥 ${current} Tage in Folge!`, { type: 'good', ms: 2600 }); });
  store.on('error', () => toast('Speichern fehlgeschlagen — Speicher voll?', { type: 'bad', icon: 'alert' }));
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme(store.settings));
}

async function boot() {
  applyTheme(store.settings);
  tts.setRate(store.settings.ttsRate); tts.setVoice(store.settings.ttsVoice);
  buildTabbar();
  initKeyboard();
  wireStore();
  store.persist();
  const content = await loadContent({ fetch: await unlockIfNeeded() });
  if (content.errors?.length) console.warn('content problems:', content.errors);
  initProgress(content);
  window.__dd = { content, store }; // handy for debugging in Safari's console
  start({ root: document.getElementById('view'), ctx: { content, store }, onChange: onRoute });
  if (!location.hash) history.replaceState(null, '', '#/home');
  // exact exercise counts for mastery %, without blocking the first paint
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 400));
  idle(() => loadAllTopicsInBackground());
  registerSW();
  if (!store.persistent) setTimeout(() => toast('Privater Modus: Fortschritt wird nicht gespeichert.', { type: 'bad', icon: 'alert', ms: 5000 }), 800);
  void t;
}

boot().catch((e) => {
  console.error(e);
  document.getElementById('view').innerHTML = `<div class="screen"><div class="empty"><p>Die App konnte nicht starten.</p><pre class="err">${String(e && e.message)}</pre></div></div>`;
});
