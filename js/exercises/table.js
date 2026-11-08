// table: fill the blanks of a paradigm. The table scrolls horizontally; Enter moves to the next blank.
import { parseTable } from '../checker.js';
import { h, md, esc, answerInput } from '../ui.js';

export default function table(ex, api) {
  const { head, rows } = parseTable(ex);
  const inputs = new Map(); // key → input
  const order = [];

  const tbl = h('table.tbl');
  if (head?.length) tbl.appendChild(h('thead', h('tr', head.map((c) => h('th', { html: md(c) })))));
  const tb = h('tbody');
  rows.forEach((row) => {
    const tr = h('tr');
    row.forEach((cell) => {
      const td = h('td');
      for (const p of cell.parts) {
        if (p.blank) {
          const inp = answerInput({ cls: 'cell-in', label: 'Feld' });
          inp.addEventListener('input', () => api.changed());
          inp.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const k = order.indexOf(p.blank);
            const next = order.slice(k + 1).map((x) => inputs.get(x)).find((x) => !x.value);
            if (next) next.focus(); else api.submit();
          });
          inputs.set(p.blank, inp); order.push(p.blank);
          td.appendChild(inp);
        } else td.appendChild(h('span', { html: md(p.text) }));
      }
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
  tbl.appendChild(tb);

  const el = h('div.ex.ex-table',
    h('div.ex-instr', { html: md(ex.caption || 'Ergänze die Tabelle.') }),
    h('div.tbl-wrap', tbl));

  return {
    el,
    focus: () => inputs.get(order[0])?.focus(),
    canSubmit: () => [...inputs.values()].some((i) => i.value.trim()),
    response: () => Object.fromEntries([...inputs].map(([k, i]) => [k, i.value])),
    reveal(res) {
      for (const [k, inp] of inputs) {
        const c = res.cells?.[k];
        inp.readOnly = true; inp.blur();
        inp.classList.add(c?.result === 'correct' ? 'ok' : c?.result === 'almost' ? 'almost' : 'no');
        if (c && c.result !== 'correct') inp.after(h('span.cell-fix', { html: esc(c.expected) }));
      }
    },
  };
}
