// order: tap tiles to build the sentence; tap a placed tile to put it back.
import { h, md } from '../ui.js';

function shuffled(words) {
  const idx = words.map((_, i) => i);
  for (let k = 0; k < 6; k++) {
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    if (idx.some((v, i) => v !== i) || idx.length < 2) break;
  }
  return idx;
}

export default function order(ex, api) {
  const line = h('div.order-line', { role: 'list', 'aria-label': 'Dein Satz' });
  const bank = h('div.order-bank', { role: 'list', 'aria-label': 'Wörter' });
  const placed = []; // indices into ex.words
  let locked = false;

  const bankTiles = shuffled(ex.words).map((wi) => {
    const t = h('button.tile', { type: 'button', text: ex.words[wi], dataset: { wi } });
    t.addEventListener('click', () => {
      if (locked || t.classList.contains('ghost')) return;
      t.classList.add('ghost');
      placed.push(wi);
      draw(); api.changed();
    });
    bank.appendChild(t);
    return t;
  });

  function draw() {
    line.replaceChildren(...placed.map((wi, pos) => {
      const t = h('button.tile', { type: 'button', text: ex.words[wi], role: 'listitem' });
      t.addEventListener('click', () => {
        if (locked) return;
        placed.splice(pos, 1);
        bankTiles.find((b) => Number(b.dataset.wi) === wi && b.classList.contains('ghost'))?.classList.remove('ghost');
        draw(); api.changed();
      });
      return t;
    }));
  }

  const el = h('div.ex.ex-order',
    h('div.ex-instr', { text: 'Bilde den Satz.' }),
    ex.en ? h('div.ex-q', { style: { fontSize: '20px' }, html: md(ex.en) }) : null,
    line, bank);

  return {
    el,
    canSubmit: () => placed.length === ex.words.length,
    response: () => placed.map((wi) => ex.words[wi]),
    reveal(res) {
      locked = true;
      [...line.children].forEach((t, i) => t.classList.add(res.result === 'correct' || res.positions?.[i] ? 'ok' : 'no'));
    },
  };
}
