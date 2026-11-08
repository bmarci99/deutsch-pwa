// Mehr: entry list for the secondary screens.
import { h, esc, icon, pageHeader, isDetektiv } from '../ui.js';

const ITEMS = [
  { id: 'review', ic: 'review', title: 'Wiederholung', sub: 'Fällige Karten, Vorschau, Fehlerheft' },
  { id: 'exam', ic: 'exam', title: 'Prüfung', sub: 'Einstufungstest & B2-Probeprüfung', det: 'Die große Prüfung' },
  { id: 'reference', ic: 'reference', title: 'Nachschlagen', sub: 'Regeln, Tabellen, Verben, Nomen', det: 'Beweisarchiv' },
  { id: 'stats', ic: 'stats', title: 'Statistik', sub: 'Genauigkeit, Heatmap, Wörter', det: 'Ermittlungsbericht' },
  { id: 'settings', ic: 'settings', title: 'Einstellungen', sub: 'Design, Audio, Tagesziel, Backup' },
];

export function render(root, ctx) {
  const { store } = ctx;
  const det = isDetektiv();
  root.appendChild(pageHeader({ title: 'Mehr' }));
  const due = store.cardCounts().due;
  const list = h('div.list.more-grid');
  for (const it of ITEMS) {
    list.appendChild(h('a.row', { href: `#/${it.id}` },
      h('div.row-ic', { class: `c-${it.id}`, html: icon(it.ic, { size: 18 }) }),
      h('div.grow', h('div.row-title', { text: det && it.det ? it.det : it.title }), h('div.row-sub', { text: it.sub })),
      it.id === 'review' && due ? h('span.badge.bad', { text: String(due) }) : null,
      h('span', { html: icon('chevron', { size: 18 }), style: { color: 'var(--muted-2)' } })));
  }
  root.appendChild(list);
  root.appendChild(h('p.muted.small', { style: { textAlign: 'center', marginTop: '24px' }, html: `Deutsch Detektiv · ${esc(det ? 'Es gibt nur eine Wahrheit.' : 'A1 → B2')}` }));
}
