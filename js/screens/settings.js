// Einstellungen: design (theme + appearance), learning (daily goal, new words/day, level, umlaut bar),
// audio (voice, rate, autoplay), data (export / import / reset, persistence hint) and about.
import { h, md, esc, icon, pageHeader, segmented, sheet, confirmSheet, toast, speak, isDetektiv, MOTIF, num } from '../ui.js';
import { tts, needsBetterVoice } from '../tts.js';
import { dayKey } from '../store.js';
import { cast } from '../cast.js';

export function render(root, ctx) {
  const { store, content } = ctx;
  const S = () => store.settings;
  const det = isDetektiv();
  root.appendChild(pageHeader({ title: 'Einstellungen', back: 'more' }));

  // ---------------------------------------------------------------- design
  root.appendChild(group('Design'));
  const themes = h('div.theme-pick',
    themeTile('klassisch', 'Klassisch', 'Ruhig, klar, hell & dunkel'),
    themeTile('detektiv', 'Detektiv', 'Blazer-Blau, Fliege, Fallakten'));
  root.appendChild(themes);
  if (det) {
    root.appendChild(group('Detektiv-Team'));
    root.appendChild(h('div.card', cast.settingsPanel()));
  }
  function themeTile(value, label, sub) {
    const on = S().theme === value;
    return h('button.theme-tile', {
      type: 'button', class: `tt-${value}${on ? ' on' : ''}`, 'aria-pressed': String(on),
      onclick: () => { if (S().theme !== value) store.setSetting('theme', value); },
    },
    h('div.tt-preview', { 'aria-hidden': 'true', html: value === 'detektiv' ? `<div class="ttp-bar"></div><div class="ttp-card"><i></i><i></i></div><div class="ttp-btn"></div>${MOTIF.bowtie}` : '<div class="ttp-bar"></div><div class="ttp-card"><i></i><i></i></div><div class="ttp-btn"></div>' }),
    h('div.tt-label', h('b', { text: label }), h('span', { text: sub })),
    h('span.tt-check', { html: icon('check', { size: 16 }) }));
  }
  root.appendChild(h('div.set-label', { text: 'Erscheinungsbild' }));
  root.appendChild(segmented([{ value: 'auto', label: 'Automatisch' }, { value: 'light', label: 'Hell' }, { value: 'dark', label: 'Dunkel' }], S().colorScheme, (v) => store.setSetting('colorScheme', v)));

  // ---------------------------------------------------------------- learning
  root.appendChild(group('Lernen'));
  const learn = h('div.list');
  learn.appendChild(choiceRow('target', 'Tagesziel', 'XP pro Tag', [50, 100, 150, 250], S().dailyGoal, (v) => store.setSetting('dailyGoal', v), (v) => `${v}`));
  learn.appendChild(choiceRow('sparkles', 'Neue Wörter pro Tag', 'In der Tagesübung und den Karteikarten', [0, 5, 10, 15, 20], S().newWordsPerDay, (v) => store.setSetting('newWordsPerDay', v), (v) => (v ? `${v}` : 'aus')));
  learn.appendChild(choiceRow('layers', 'Niveau bis', 'Neue Wörter, Drills und Empfehlungen bis zu diesem Niveau', ['A1', 'A2', 'B1', 'B2'], S().level || 'B2', (v) => store.setSetting('level', v), (v) => v));
  learn.appendChild(toggleRow('keyboard', 'Umlaut-Leiste', 'ä ö ü ß über der Tastatur', S().umlautBar !== false, (v) => store.setSetting('umlautBar', v)));
  root.appendChild(learn);

  // ---------------------------------------------------------------- audio
  root.appendChild(group('Aussprache'));
  const audio = h('div.list');
  const voiceSub = h('div.row-sub');
  const voiceRow = h('button.row', { type: 'button', onclick: () => pickVoice() },
    h('div.row-ic', { class: 'c-audio', html: icon('speaker', { size: 18 }) }),
    h('div.grow', h('div.row-title', { text: 'Stimme' }), voiceSub),
    h('span', { html: icon('chevron', { size: 18 }), style: { color: 'var(--muted-2)' } }));
  audio.appendChild(voiceRow);
  const rateVal = h('span.rate-val', { text: `${Number(S().ttsRate || 0.9).toFixed(2)}×` });
  const rate = h('input.range', { type: 'range', min: '0.6', max: '1.2', step: '0.05', value: String(S().ttsRate || 0.9), 'aria-label': 'Sprechtempo' });
  rate.addEventListener('input', () => { rateVal.textContent = `${Number(rate.value).toFixed(2)}×`; });
  rate.addEventListener('change', () => { store.setSetting('ttsRate', Number(rate.value)); speak('Ich spreche jetzt in diesem Tempo.'); });
  audio.appendChild(h('div.row.row-range',
    h('div.row-ic', { class: 'c-audio', html: icon('turtle', { size: 18 }) }),
    h('div.grow', h('div.row-title', h('span', { text: 'Tempo ' }), rateVal), h('div.range-wrap', h('span.small.muted', { text: 'langsam' }), rate, h('span.small.muted', { text: 'schnell' })))));
  audio.appendChild(toggleRow('play', 'Automatisch abspielen', 'Neue Wörter und Karteikarten vorlesen', S().autoplayAudio !== false, (v) => store.setSetting('autoplayAudio', v)));
  audio.appendChild(h('button.row', { type: 'button', onclick: () => speak('Guten Tag! Ich bin deine Stimme für Deutsch Detektiv.') },
    h('div.row-ic', { class: 'c-audio', html: icon('headphones', { size: 18 }) }),
    h('div.grow.row-title', { text: 'Stimme testen' }),
    h('span', { html: icon('play', { size: 16, fill: true }), style: { color: 'var(--accent)' } })));
  root.appendChild(audio);
  const voiceHint = h('div.set-hint', { hidden: true });
  root.appendChild(voiceHint);

  function voiceLabel() {
    const list = tts.voices();
    if (!tts.supported) return 'Sprachausgabe wird nicht unterstützt';
    const cur = list.find((v) => v.uri === S().ttsVoice);
    const best = list[0];
    if (cur) return `${cur.name}${cur.quality !== 'standard' ? ` · ${cur.quality === 'premium' ? 'Premium' : 'Erweitert'}` : ''}`;
    return best ? `Automatisch (${best.name})` : 'Keine deutsche Stimme gefunden';
  }
  function refreshVoice() {
    voiceSub.textContent = voiceLabel();
    const weak = tts.supported && needsBetterVoice();
    voiceHint.hidden = !weak;
    voiceHint.innerHTML = weak ? `${icon('info', { size: 16 })}<span>${md('Für natürlicheres Deutsch: iPhone-**Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen → Deutsch** → z. B. **Anna (Erweitert)** laden. Danach hier auswählen.')}</span>` : '';
  }
  tts.ready().then(() => { if (ctx.token()) refreshVoice(); });
  refreshVoice();
  function pickVoice() {
    const list = tts.voices();
    const body = h('div.list');
    const mk = (uri, title, sub) => h('button.row', { type: 'button', onclick: () => { store.setSetting('ttsVoice', uri); refreshVoice(); s.close(); setTimeout(() => speak('Hallo! So klinge ich.'), 150); } },
      h('div.grow', h('div.row-title', { text: title }), sub ? h('div.row-sub', { text: sub }) : null),
      (S().ttsVoice || null) === uri ? h('span', { html: icon('check', { size: 18 }), style: { color: 'var(--accent)' } }) : null);
    body.appendChild(mk(null, 'Automatisch', list[0] ? `beste verfügbare: ${list[0].name}` : 'keine deutsche Stimme'));
    for (const v of list) body.appendChild(mk(v.uri, v.name, `${v.lang} · ${v.quality === 'premium' ? 'Premium' : v.quality === 'enhanced' ? 'Erweitert' : 'Standard'}`));
    const s = sheet({ title: 'Stimme', body });
  }

  // ---------------------------------------------------------------- data
  root.appendChild(group('Daten'));
  if (!store.persistent) root.appendChild(h('div.set-hint.bad', { html: `${icon('alert', { size: 16 })}<span>${md('**Privater Modus:** Fortschritt wird nicht gespeichert. Öffne die App normal oder vom Home-Bildschirm.')}</span>` }));
  const data = h('div.list');
  const fileIn = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  fileIn.addEventListener('change', () => importFile(fileIn.files?.[0]));
  data.appendChild(actionRow('download', 'Fortschritt exportieren', 'Backup als JSON-Datei', exportData));
  data.appendChild(actionRow('upload', 'Fortschritt importieren', 'Aus einer Backup-Datei', () => fileIn.click()));
  data.appendChild(actionRow('trash', 'Alles zurücksetzen', 'Fortschritt, Karten und Fehler löschen', resetAll, true));
  root.appendChild(data);
  root.appendChild(fileIn);
  const persistEl = h('p.muted.small.set-foot');
  root.appendChild(persistEl);
  (async () => {
    let persisted = false;
    try { persisted = await navigator.storage?.persisted?.(); } catch { /* ignore */ }
    let used = '';
    try { const est = await navigator.storage?.estimate?.(); if (est?.usage) used = ` · ${(est.usage / 1024 / 1024).toFixed(1)} MB belegt`; } catch { /* ignore */ }
    if (!ctx.token()) return;
    persistEl.textContent = `${persisted ? 'Dauerhafter Speicher aktiv' : 'Speicher: normal (Backup empfohlen)'}${used} · ${num(Object.keys(store.state.cards).length)} Karten · ${num(store.state.attempts.length)} Antworten gespeichert`;
  })();

  function exportData() {
    const json = store.export();
    const name = `deutsch-detektiv-${dayKey()}.json`;
    const blob = new Blob([json], { type: 'application/json' });
    const file = typeof File === 'function' ? new File([blob], name, { type: 'application/json' }) : null;
    // iOS standalone PWAs ignore <a download>; the share sheet can save to Files
    if (file && navigator.canShare?.({ files: [file] }) && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
      navigator.share({ files: [file], title: 'Deutsch Detektiv Backup' }).catch(() => {});
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Backup gespeichert', { icon: 'check', type: 'good' });
  }
  async function importFile(f) {
    fileIn.value = '';
    if (!f) return;
    let text = '';
    try { text = await f.text(); JSON.parse(text); } catch { toast('Das ist keine gültige Backup-Datei.', { type: 'bad', icon: 'alert' }); return; }
    let mode = 'merge';
    const body = h('div', h('p.sheet-text', { text: `„${f.name}“ importieren. Zusammenführen behält die jeweils neueren Daten; Ersetzen überschreibt alles.` }));
    body.appendChild(segmented([{ value: 'merge', label: 'Zusammenführen' }, { value: 'replace', label: 'Ersetzen' }], mode, (v) => { mode = v; }));
    sheet({
      title: 'Backup importieren', body,
      actions: [{ label: 'Abbrechen' }, {
        label: 'Importieren', primary: true, onClick: (close) => {
          try { store.import(text, { mode }); close(); toast('Import erfolgreich', { icon: 'check', type: 'good' }); ctx.nav('settings', null, { replace: true }); } catch (e) { toast(`Import fehlgeschlagen: ${e.message}`, { type: 'bad', icon: 'alert', ms: 4000 }); }
        },
      }],
    });
  }
  async function resetAll() {
    const ok = await confirmSheet({ title: 'Alles zurücksetzen?', text: `**${num(store.state.xp)} XP**, ${num(Object.keys(store.state.cards).length)} Karten und dein Fehlerheft werden gelöscht. Das lässt sich nicht rückgängig machen — exportiere vorher ein Backup.`, ok: 'Weiter', danger: true });
    if (!ok) return;
    const ok2 = await confirmSheet({ title: 'Wirklich löschen?', text: 'Letzte Chance.', ok: 'Endgültig löschen', danger: true });
    if (!ok2) return;
    store.reset();
    toast('Zurückgesetzt. Viel Erfolg beim Neustart!', { icon: 'repeat' });
    ctx.nav('home');
  }

  // ---------------------------------------------------------------- about
  root.appendChild(group('Über'));
  const st = content.stats();
  root.appendChild(h('div.card.about',
    h('div.about-head', h('div.about-logo', { 'aria-hidden': 'true' }), h('div.grow', h('div.card-title', { text: 'Deutsch Detektiv' }), h('div.card-sub', { text: `Grammatik & Wortschatz A1 → B2 · Version ${content.version ? esc(String(content.version).slice(0, 8)) : 'dev'}` }))),
    h('div.about-stats',
      aboutStat(st.topics, 'Themen'), aboutStat(st.words, 'Wörter'), aboutStat(st.verbs, 'Verben')),
    h('p.small.muted', { html: md('Läuft komplett offline, ohne Konto, ohne Tracking. Dein Fortschritt bleibt auf diesem Gerät. Alle Inhalte, Grafiken und Motive sind eigene Arbeit.') }),
    det ? h('p.small.about-motto', { text: '„Es gibt nur eine Wahrheit“ — und die heißt: jeden Tag üben.' }) : null));
}

// ---------------------------------------------------------------- row helpers
const EXTRA_ICONS = {
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3"/>',
};
const ic = (name, size = 18) => (EXTRA_ICONS[name] ? `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${EXTRA_ICONS[name]}</svg>` : icon(name, { size }));

const group = (title) => h('div.unit-title.set-group', { text: title });
const aboutStat = (n, l) => h('div', h('b', { text: num(n) }), h('span', { text: l }));

function toggleRow(icn, title, sub, on, onChange) {
  const sw = h('input.switch', { type: 'checkbox', role: 'switch', checked: !!on, 'aria-label': title });
  sw.addEventListener('change', () => onChange(sw.checked));
  return h('label.row', h('div.row-ic', { html: ic(icn) }), h('div.grow', h('div.row-title', { text: title }), sub ? h('div.row-sub', { text: sub }) : null), sw);
}
function choiceRow(icn, title, sub, values, current, onChange, label) {
  const chips = h('div.choice-chips');
  for (const v of values) {
    const b = h('button.chip', { type: 'button', class: v === current ? 'on' : '', text: label(v) });
    b.onclick = () => { [...chips.children].forEach((c) => c.classList.toggle('on', c === b)); onChange(v); };
    chips.appendChild(b);
  }
  return h('div.row.row-choice', h('div.row-ic', { html: ic(icn) }), h('div.grow', h('div.row-title', { text: title }), sub ? h('div.row-sub', { text: sub }) : null, chips));
}
function actionRow(icn, title, sub, onClick, danger = false) {
  return h('button.row', { type: 'button', class: danger ? 'danger' : '', onclick: onClick },
    h('div.row-ic', { class: danger ? 'c-danger' : '', html: ic(icn) }),
    h('div.grow', h('div.row-title', { text: title }), h('div.row-sub', { text: sub })),
    h('span', { html: icon('chevron', { size: 18 }), style: { color: 'var(--muted-2)' } }));
}
