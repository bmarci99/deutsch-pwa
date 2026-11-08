// Placeholder used by screens that the next agent builds (vocab, review, exam, reference, stats, settings).
import { h, md, icon, pageHeader } from '../ui.js';

export function stub(root, { title, sub = '', ic = 'sparkles', todo = [], links = [], back = null }) {
  root.appendChild(pageHeader({ title, sub, back }));
  root.appendChild(h('div.stub-note', { html: `${icon(ic, { size: 32 })}<p><b>Kommt bald.</b></p>${todo.length ? `<p class="small">${todo.map((t) => md(t)).join('<br>')}</p>` : ''}` }));
  if (links.length) root.appendChild(h('div.list', { style: { marginTop: '14px' } }, links.map((l) => h('a.row', { href: l.href }, h('div.grow.row-title', { text: l.label }), h('span', { html: icon('chevron', { size: 18 }), style: { color: 'var(--muted-2)' } })))));
}
