// Hash router. Routes look like '#/topic/a2-dative?m=20'.
// Screen modules export `render(root, ctx)` (may be async) and optionally return a cleanup function.
// ctx = {params, query, path, content, store, nav, route}. See docs/UI_NOTES.md.

const routes = [];
let current = null;           // {route, cleanup, hash}
let ctxBase = {};
let onChange = () => {};
const scrollMemo = new Map(); // hash → scrollY (restored on back/forward)
let navToken = 0;
let pushNav = false;   // true when the navigation came from a link / nav() (→ scroll to top)

/**
 * Register a route. pattern: 'topic/:id' (no leading '#/'). load: () => import('./screens/topic.js').
 * meta: {tab: 'home'|'path'|'practice'|'vocab'|'more', chrome: false to hide the tab bar (sessions)}.
 */
export function route(pattern, load, meta = {}) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/\/:([\w]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }).replace(/^:([\w]+)/, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ pattern, re, keys, load, meta });
}

/** Parse location.hash → {path, params, query, route}. */
export function parse(hash = location.hash) {
  const raw = hash.replace(/^#\/?/, '');
  const [pathPart, qs = ''] = raw.split('?');
  const path = pathPart || 'home';
  const query = Object.fromEntries(new URLSearchParams(qs));
  for (const r of routes) {
    const m = r.re.exec(path);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { path, params, query, route: r };
    }
  }
  return { path, params: {}, query, route: null };
}

/** Navigate: nav('topic/a2-dative', {m: 20}) or nav('#/home'). replace=true replaces the history entry. */
export function nav(path, query = null, { replace = false } = {}) {
  let p = String(path).replace(/^#?\/?/, '');
  if (query) {
    const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v != null && v !== '')).toString();
    if (qs) p += (p.includes('?') ? '&' : '?') + qs;
  }
  const hash = '#/' + p;
  if (hash === location.hash) { render(true); return; }
  pushNav = true;
  if (replace) { history.replaceState(null, '', hash); render(); } else location.hash = hash;
}
/** Build an href for an <a>: href('topic', id) → '#/topic/<id>'. */
export const href = (...parts) => '#/' + parts.map((p) => encodeURIComponent(p)).join('/');
export const back = (fallback = 'home') => { if (history.length > 1) history.back(); else nav(fallback); };

/** Start routing. opts: {root, ctx (merged into every screen ctx), onChange(parsed)} */
export function start({ root, ctx = {}, onChange: cb = () => {} }) {
  ctxBase = { ...ctx, root };
  onChange = cb;
  window.addEventListener('hashchange', () => render());
  document.addEventListener('click', (e) => { const a = e.target.closest?.('a[href^="#/"]'); if (a) pushNav = true; }, true);
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  render();
}

/** Re-render the current route (e.g. after settings change). */
export async function render(force = false) {
  const token = ++navToken;
  const parsed = parse();
  const root = ctxBase.root;
  if (current && current.hash !== location.hash) scrollMemo.set(current.hash, window.scrollY);
  if (!parsed.route) { location.replace('#/home'); return; }
  try { current?.cleanup?.(); } catch (e) { console.error(e); }
  current = { hash: location.hash, cleanup: null, route: parsed.route };
  onChange(parsed);
  let mod;
  try { mod = await parsed.route.load(); } catch (e) { console.error(e); root.innerHTML = `<div class="screen"><div class="empty"><p>Bildschirm konnte nicht geladen werden.</p><pre class="err">${String(e && e.message)}</pre></div></div>`; return; }
  if (token !== navToken) return;
  const screen = document.createElement('div');
  screen.className = `screen screen-${parsed.path.split('/')[0]}`;
  const ctx = { ...ctxBase, ...parsed, nav, href, back, token: () => token === navToken };
  let cleanup = null;
  try { cleanup = await (mod.render || mod.default?.render || mod.default)(screen, ctx); } catch (e) {
    console.error(e);
    screen.innerHTML = `<div class="empty"><p>Hoppla — hier ist etwas schiefgegangen.</p><pre class="err">${String(e && e.message)}</pre><a class="btn btn-secondary" href="#/home">Zur Startseite</a></div>`;
  }
  if (token !== navToken) { try { cleanup?.(); } catch { /* ignore */ } return; }
  current.cleanup = typeof cleanup === 'function' ? cleanup : null;
  root.replaceChildren(screen);
  const y = force ? window.scrollY : !pushNav ? (scrollMemo.get(location.hash) || 0) : 0;
  pushNav = false;
  window.scrollTo(0, y);
  screen.classList.add('enter');
}

export const currentRoute = () => parse();
