// match: tap an item on the left, then its partner on the right (either order works). Tap a pair to undo it.
import { h, md, esc } from '../ui.js';

const COLORS = ['#2e62f0', '#e0393e', '#1f9e57', '#d9850b', '#8b5cf6', '#0e9aa7'];

export default function match(ex, api) {
  const lefts = ex.pairs.map((p) => p[0]);
  const rights = ex.pairs.map((p) => p[1]);
  const order = rights.map((_, i) => i);
  for (let k = 0; k < 5; k++) {
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    if (order.some((v, i) => v !== i)) break;
  }
  const pairOf = new Map();      // left index → right index
  let pending = null;            // {side:'l'|'r', i}
  let locked = false;

  const mkBtn = (side, i, text) => {
    const b = h('button.m-item', { type: 'button', html: md(text), dataset: { side, i } });
    b.addEventListener('click', () => tap(side, i));
    return b;
  };
  const L = lefts.map((t, i) => mkBtn('l', i, t));
  const R = order.map((ri) => mkBtn('r', ri, rights[ri]));
  const rBtn = (ri) => R.find((b) => Number(b.dataset.i) === ri);

  function tap(side, i) {
    if (locked) return;
    // undo an existing pair
    if (side === 'l' && pairOf.has(i)) { pairOf.delete(i); pending = null; return draw(); }
    if (side === 'r') { for (const [l, r] of pairOf) if (r === i) { pairOf.delete(l); pending = null; return draw(); } }
    if (!pending || pending.side === side) { pending = pending && pending.side === side && pending.i === i ? null : { side, i }; return draw(); }
    const l = side === 'l' ? i : pending.i, r = side === 'r' ? i : pending.i;
    pairOf.set(l, r); pending = null; draw(); api.changed();
  }

  function draw() {
    const colorOf = new Map();
    [...pairOf.keys()].sort((a, b) => a - b).forEach((l, n) => colorOf.set(l, n));
    L.forEach((b, i) => {
      const c = colorOf.get(i);
      b.classList.toggle('paired', c != null); b.classList.toggle('sel', pending?.side === 'l' && pending.i === i);
      b.style.setProperty('--pc', c != null ? COLORS[c % COLORS.length] : '');
    });
    for (const b of R) {
      const ri = Number(b.dataset.i);
      const l = [...pairOf].find(([, r]) => r === ri)?.[0];
      const c = l != null ? colorOf.get(l) : null;
      b.classList.toggle('paired', c != null); b.classList.toggle('sel', pending?.side === 'r' && pending.i === ri);
      b.style.setProperty('--pc', c != null ? COLORS[c % COLORS.length] : '');
    }
  }

  const sol = h('div.match-sol', { hidden: true });
  const el = h('div.ex.ex-match',
    h('div.ex-instr', { html: md(ex.instruction || 'Ordne zu.') }),
    h('div.match', h('div.match-col', L), h('div.match-col', R)),
    sol);

  return {
    el,
    canSubmit: () => pairOf.size === lefts.length,
    response: () => [...pairOf].map(([l, r]) => [lefts[l], rights[r]]),
    reveal(res) {
      locked = true;
      res.pairs.forEach((p, li) => {
        L[li].classList.add(p.ok ? 'ok' : 'no');
        const ri = pairOf.get(li);
        if (ri != null) rBtn(ri).classList.add(p.ok ? 'ok' : 'no');
      });
      if (res.result !== 'correct') {
        sol.hidden = false;
        sol.innerHTML = `<div class="fb-label">Richtig</div>` + ex.pairs.map(([l, r]) => `<div>${md(l)} = <b>${md(r)}</b></div>`).join('');
      }
      void esc;
    },
  };
}
