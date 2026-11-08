// Detektiv theme cast: characters, their German lines, and avatars.
// Default avatars are original emblem SVGs. The owner can pick his own picture per character ("Bild wählen");
// it is cropped/resized on the device and stored ONLY in this browser's IndexedDB — never part of the site.
//
//   import { cast } from './cast.js';
//   if (cast.active()) container.append(cast.bubble('wrong'));   // speech bubble with avatar + line
//   settingsEl.append(cast.settingsPanel());                     // per-character "Bild wählen"

const CHARACTERS = [
  { id: 'conan', name: 'Conan', role: 'Meisterdetektiv', color: '#1f3a8a', job: 'leitet deine Fälle' },
  { id: 'ai', name: 'Ai', role: 'Wissenschaftlerin', color: '#b8743f', job: 'Wiederholung & Fehleranalyse' },
  { id: 'agasa', name: 'Professor Agasa', role: 'Erfinder', color: '#5b7f3a', job: 'erklärt die Regeln' },
  { id: 'ran', name: 'Ran', role: 'Karate-Champion', color: '#c2185b', job: 'motiviert dich' },
  { id: 'kogoro', name: 'Kogoro', role: 'Privatdetektiv', color: '#6d4c41', job: 'kommentiert Patzer' },
  { id: 'boys', name: 'Detective Boys', role: 'Junior-Detektive', color: '#e08a00', job: 'begleiten die Drills' },
];

// Simple German (A2–B1) with English, so the lines are practice too.
const LINES = {
  sessionStart: [
    ['conan', 'Ein neuer Fall! Konzentrier dich auf die Details.', 'A new case! Focus on the details.'],
    ['conan', 'Jede Endung ist ein Hinweis. Los geht’s!', 'Every ending is a clue. Let’s go!'],
    ['ran', 'Du schaffst das! Ich glaube an dich.', 'You can do it! I believe in you.'],
  ],
  correct: [
    ['conan', 'Fall gelöst!', 'Case solved!'],
    ['conan', 'Genau! Der Kasus hat dich nicht getäuscht.', 'Exactly! The case didn’t fool you.'],
    ['ai', 'Nicht schlecht. Für einen Anfänger.', 'Not bad. For a beginner.'],
    ['ran', 'Super! Weiter so!', 'Great! Keep it up!'],
    ['boys', 'Wir haben den Täter! Äh … die Endung!', 'We caught the culprit! Uh … the ending!'],
  ],
  almost: [
    ['ai', 'Fast. Aber „fast“ reicht in der Wissenschaft nicht.', 'Almost. But “almost” isn’t enough in science.'],
    ['conan', 'Beinahe! Schau dir die Kleinigkeiten an.', 'Nearly! Look at the small details.'],
  ],
  wrong: [
    ['ai', 'Schon wieder? Faszinierend.', 'Again? Fascinating.'],
    ['ai', 'Interessant. Diesen Fehler sehen wir morgen wieder.', 'Interesting. We’ll see this mistake again tomorrow.'],
    ['kogoro', 'Hm! Ganz klar … das war ein schwieriger Fall!', 'Hm! Clearly … that was a tricky case!'],
    ['kogoro', 'Keine Sorge, das passiert sogar dem großen Detektiv Mori!', 'Don’t worry, that even happens to the great detective Mori!'],
    ['conan', 'Nicht aufgeben! Lies die Erklärung — da ist der Hinweis.', 'Don’t give up! Read the explanation — the clue is there.'],
    ['ran', 'Kopf hoch! Beim nächsten Mal klappt es.', 'Chin up! Next time it’ll work.'],
  ],
  perfect: [
    ['conan', 'Es gibt nur eine Wahrheit! Alles richtig!', 'There is only one truth! All correct!'],
    ['ai', 'Hm. Perfekt. Ich bin … beeindruckt.', 'Hm. Perfect. I’m … impressed.'],
  ],
  sessionEnd: [
    ['conan', 'Gute Arbeit, Detektiv. Morgen wartet der nächste Fall.', 'Good work, detective. Tomorrow the next case awaits.'],
    ['ran', 'Toll gemacht! Mach eine kleine Pause.', 'Well done! Take a little break.'],
    ['agasa', 'Ausgezeichnet! Das muss ich in meinem Labor feiern!', 'Excellent! I must celebrate that in my lab!'],
  ],
  review: [
    ['ai', 'Deine Fehler von gestern. Ich habe sie alle gesammelt.', 'Your mistakes from yesterday. I collected them all.'],
    ['ai', 'Wiederholung ist die Mutter des Gedächtnisses. Fang an.', 'Repetition is the mother of memory. Start.'],
  ],
  lesson: [
    ['agasa', 'Meine neueste Erfindung: eine Regel, die immer funktioniert!', 'My newest invention: a rule that always works!'],
    ['agasa', 'Lies zuerst die Akte, dann lösen wir den Fall.', 'Read the file first, then we’ll solve the case.'],
  ],
  drill: [
    ['boys', 'Detective Boys, Einsatz! Wie viele schaffst du am Stück?', 'Detective Boys, go! How many can you get in a row?'],
    ['boys', 'Schneller als Genta beim Essen!', 'Faster than Genta eating!'],
  ],
  streak: [
    ['ran', 'Wieder da! Deine Serie lebt!', 'Back again! Your streak is alive!'],
    ['ai', 'Jeden Tag geübt. Das ist … tatsächlich beeindruckend.', 'Practised every day. That’s … actually impressive.'],
  ],
  comeback: [
    ['ai', 'Du warst weg. Die Grammatik nicht.', 'You were gone. The grammar wasn’t.'],
    ['conan', 'Willkommen zurück! Der Fall ist noch offen.', 'Welcome back! The case is still open.'],
  ],
};

// ---- emblem avatars (original art: symbols, not faces)
const EMBLEMS = {
  conan: '<path d="M30 52 l14 -8 v16 z M70 52 l-14 -8 v16 z" fill="#e53935"/><circle cx="50" cy="52" r="5" fill="#b71c1c"/><circle cx="36" cy="34" r="9" fill="none" stroke="#fff" stroke-width="3.5"/><circle cx="64" cy="34" r="9" fill="none" stroke="#fff" stroke-width="3.5"/><path d="M45 34 h10" stroke="#fff" stroke-width="3.5"/>',
  ai: '<rect x="26" y="30" width="30" height="13" rx="6.5" transform="rotate(-30 41 36)" fill="#fff"/><path d="M41 36 l13 -7.5 a6.5 6.5 0 0 1 6.5 11.3 l-13 7.5 z" fill="#e53935"/><path d="M60 50 h14 M67 50 v16 l-8 14 h16 l-8 -14" fill="none" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/><circle cx="67" cy="76" r="3" fill="#7fe0c8"/>',
  agasa: '<path d="M50 22 a16 16 0 0 1 10 28 v8 h-20 v-8 a16 16 0 0 1 10 -28 z" fill="#ffe082"/><rect x="41" y="60" width="18" height="6" rx="2" fill="#fff"/><path d="M28 74 c8 -6 14 -6 22 0 c8 -6 14 -6 22 0" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>',
  ran: '<path d="M50 20 l8 18 l20 2 l-15 13 l5 20 l-18 -11 l-18 11 l5 -20 l-15 -13 l20 -2 z" fill="#fff"/><path d="M30 76 h40" stroke="#fff" stroke-width="5" stroke-linecap="round"/>',
  kogoro: '<path d="M26 44 h48 l-6 -16 h-36 z" fill="#fff"/><rect x="22" y="44" width="56" height="6" rx="3" fill="#fff"/><path d="M34 66 c6 6 26 6 32 0" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M36 60 c4 -3 8 -3 12 0 M52 60 c4 -3 8 -3 12 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
  boys: '<circle cx="44" cy="44" r="16" fill="none" stroke="#fff" stroke-width="5"/><path d="M56 56 l16 16" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="M38 40 a8 8 0 0 1 8 -6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.7"/>',
};
const emblemURL = (c) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="${c.color}"/>${EMBLEMS[c.id]}</svg>`);

// ---- on-device avatar storage (IndexedDB; falls back to memory)
const DB = 'dd-cast', STORE = 'avatars';
const mem = new Map();
const urls = new Map();
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch { res(null); }
  });
  return dbp;
}
async function idb(mode, fn) {
  const d = await db();
  if (!d) return null;
  return new Promise((res) => {
    try {
      const tx = d.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => res(req && req.result);
      tx.onerror = tx.onabort = () => res(null);
    } catch { res(null); }
  });
}

/** Centre-crop to a square and downscale to 384px JPEG (keeps storage tiny). */
async function toSquareBlob(file, size = 384) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    // portraits: bias the crop upwards so faces stay in frame
    const sx = (img.naturalWidth - s) / 2;
    const sy = img.naturalHeight > img.naturalWidth ? Math.max(0, (img.naturalHeight - s) * 0.2) : (img.naturalHeight - s) / 2;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    c.getContext('2d').drawImage(img, sx, sy, s, s, 0, 0, size, size);
    return await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.88));
  } finally { URL.revokeObjectURL(url); }
}

const listeners = new Set();
const emit = (id) => listeners.forEach((f) => { try { f(id); } catch { /* ignore */ } });

async function getCustom(id) {
  if (urls.has(id)) return urls.get(id);
  const blob = mem.get(id) || await idb('readonly', (s) => s.get(id));
  const u = blob ? URL.createObjectURL(blob) : null;
  urls.set(id, u);
  return u;
}

async function setAvatar(id, file) {
  const blob = await toSquareBlob(file);
  mem.set(id, blob);
  await idb('readwrite', (s) => s.put(blob, id));
  if (urls.get(id)) URL.revokeObjectURL(urls.get(id));
  urls.delete(id);
  emit(id);
}

async function clearAvatar(id) {
  mem.delete(id);
  await idb('readwrite', (s) => s.delete(id));
  if (urls.get(id)) URL.revokeObjectURL(urls.get(id));
  urls.delete(id);
  emit(id);
}

const byId = (id) => CHARACTERS.find((c) => c.id === id);

/** Fill an <img> with the character's avatar (custom picture if set, emblem otherwise) and keep it updated. */
function avatarImg(id, size = 44) {
  const c = byId(id);
  const img = document.createElement('img');
  img.className = 'cast-avatar';
  img.width = img.height = size;
  img.alt = c ? c.name : '';
  img.src = c ? emblemURL(c) : '';
  const refresh = async () => { const u = await getCustom(id); img.src = u || emblemURL(c); };
  refresh();
  const onChange = (changed) => { if (changed === id) { if (!img.isConnected) listeners.delete(onChange); else refresh(); } };
  listeners.add(onChange);
  return img;
}

let counter = 0;
/** A line for an event: {char, de, en}. Rotates deterministically so lines don't repeat back to back. */
function line(event) {
  const list = LINES[event] || LINES.correct;
  const [id, de, en] = list[(counter++ + event.length) % list.length];
  return { char: byId(id), de, en };
}

const active = () => typeof document !== 'undefined' && document.documentElement.dataset.theme === 'detektiv';

/** Speech bubble element: avatar + German line + English gloss (tap to reveal). */
function bubble(event, opts = {}) {
  injectCSS();
  const l = opts.line || line(event);
  const el = document.createElement('div');
  el.className = 'cast-bubble';
  el.append(avatarImg(l.char.id, opts.size || 44));
  const body = document.createElement('div');
  body.className = 'cast-body';
  const who = document.createElement('div');
  who.className = 'cast-who';
  who.textContent = l.char.name;
  const de = document.createElement('div');
  de.className = 'cast-de';
  de.textContent = l.de;
  const en = document.createElement('div');
  en.className = 'cast-en';
  en.textContent = l.en;
  body.append(who, de, en);
  el.append(body);
  el.addEventListener('click', () => el.classList.toggle('show-en'));
  return el;
}

/** Settings section: one row per character with "Bild wählen" / "Zurücksetzen". */
function settingsPanel() {
  injectCSS();
  const wrap = document.createElement('div');
  wrap.className = 'cast-settings';
  const note = document.createElement('p');
  note.className = 'cast-note';
  note.textContent = 'Wähle für jede Figur ein eigenes Bild aus deinen Fotos. Es wird nur auf diesem Gerät gespeichert und nie hochgeladen.';
  wrap.append(note);
  for (const c of CHARACTERS) {
    const row = document.createElement('div');
    row.className = 'cast-row';
    const info = document.createElement('div');
    info.className = 'cast-info';
    info.innerHTML = `<strong></strong><span></span>`;
    info.querySelector('strong').textContent = c.name;
    info.querySelector('span').textContent = `${c.role} · ${c.job}`;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.hidden = true;
    const pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'cast-btn';
    pick.textContent = 'Bild wählen';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'cast-btn cast-btn-ghost';
    reset.textContent = 'Zurücksetzen';
    const syncReset = async () => { reset.hidden = !(await getCustom(c.id)); };
    pick.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      pick.disabled = true;
      try { await setAvatar(c.id, f); } catch { pick.textContent = 'Fehler — anderes Bild?'; }
      pick.disabled = false;
      input.value = '';
      syncReset();
    });
    reset.addEventListener('click', async () => { await clearAvatar(c.id); syncReset(); });
    syncReset();
    const btns = document.createElement('div');
    btns.className = 'cast-btns';
    btns.append(pick, reset);
    row.append(avatarImg(c.id, 52), info, btns, input);
    wrap.append(row);
  }
  return wrap;
}

let cssDone = false;
function injectCSS() {
  if (cssDone || typeof document === 'undefined') return;
  cssDone = true;
  const s = document.createElement('style');
  s.textContent = `
.cast-avatar{border-radius:50%;object-fit:cover;flex:none;box-shadow:0 0 0 2px var(--accent-2,#e9c46a);background:#fff}
.cast-bubble{display:flex;gap:10px;align-items:flex-start;margin:10px 0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.cast-body{position:relative;background:var(--surface,#fff);color:var(--text,#1b1f2a);border:1px solid var(--border,#d9dce3);border-radius:14px;border-top-left-radius:4px;padding:8px 12px;box-shadow:0 1px 3px rgba(0,0,0,.08);max-width:100%}
.cast-who{font-size:12px;font-weight:700;letter-spacing:.02em;color:var(--accent,#c62828);margin-bottom:2px}
.cast-de{font-size:15px;line-height:1.35}
.cast-en{font-size:13px;line-height:1.3;color:var(--muted,#6b7280);max-height:0;overflow:hidden;transition:max-height .2s ease}
.cast-bubble.show-en .cast-en{max-height:60px;margin-top:3px}
.cast-settings{display:flex;flex-direction:column;gap:10px}
.cast-note{font-size:13px;color:var(--muted,#6b7280);margin:0 0 4px}
.cast-row{display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border,#e5e7eb)}
.cast-info{flex:1;min-width:0;display:flex;flex-direction:column}
.cast-info span{font-size:12px;color:var(--muted,#6b7280);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cast-btns{display:flex;flex-direction:column;gap:4px;align-items:stretch}
.cast-btn{min-height:36px;padding:6px 12px;border-radius:10px;border:0;background:var(--accent,#c62828);color:#fff;font:inherit;font-size:13px;font-weight:600}
.cast-btn-ghost{background:transparent;color:var(--muted,#6b7280);border:1px solid var(--border,#d1d5db)}
@media (prefers-reduced-motion:reduce){.cast-en{transition:none}}`;
  document.head.append(s);
}

export const cast = { characters: CHARACTERS, lines: LINES, line, bubble, avatarImg, settingsPanel, setAvatar, clearAvatar, active };
