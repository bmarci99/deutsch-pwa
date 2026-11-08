// German text-to-speech via the Web Speech API (offline voices on iOS).
// import { tts } from './tts.js'; tts.speak('der Tisch'); tts.setRate(0.9);
const PREFERRED = ['anna', 'helena', 'petra', 'markus', 'yannick', 'viktor', 'martin', 'katja', 'conrad', 'amala', 'seraphina', 'florian', 'google deutsch'];

const synth = () => (typeof window !== 'undefined' && window.speechSynthesis) || null;

function voiceScore(v) {
  const name = (v.name || '').toLowerCase();
  const uri = (v.voiceURI || '').toLowerCase();
  let s = 0;
  if (/^de[-_]de/i.test(v.lang)) s += 100; else if (/^de/i.test(v.lang)) s += 60; else return -1;
  if (/premium/.test(name + uri)) s += 40;
  if (/enhanced|erweitert|natural|neural/.test(name + uri)) s += 30;
  const i = PREFERRED.findIndex((p) => name.includes(p));
  if (i >= 0) s += 20 - i;
  if (v.localService) s += 5; // works offline
  if (/compact/.test(name + uri)) s -= 25;
  return s;
}

// Apple's Eloquence/novelty voices sound robotic and mispronounce German — never offer them.
const NOVELTY = /eloquence|grandma|grandpa|rocko|shelley|sandy|\bflo\b|\breed\b|\beddy\b|bahh|bells|boing|bubbles|jester|organ|superstar|trinoids|whisper|wobble|zarvox|cellos|albert|bad news|good news/;

/** All German voices, best first: [{voice, name, lang, uri, score, quality}] (quality: premium | enhanced | standard) */
export function germanVoices() {
  const s = synth();
  if (!s) return [];
  return s.getVoices()
    .filter((v) => !NOVELTY.test(`${v.name} ${v.voiceURI}`.toLowerCase()))
    .map((v) => {
      const id = `${v.name} ${v.voiceURI}`.toLowerCase();
      const quality = /premium/.test(id) ? 'premium' : /enhanced|erweitert|natural|neural/.test(id) ? 'enhanced' : 'standard';
      return { voice: v, name: v.name, lang: v.lang, uri: v.voiceURI, score: voiceScore(v), quality };
    })
    .filter((x) => x.score >= 0).sort((a, b) => b.score - a.score);
}

/** true when only basic voices exist — the UI should suggest downloading an Enhanced/Premium German voice. */
export function needsBetterVoice() {
  const list = germanVoices();
  return !list.length || list[0].quality === 'standard';
}

function createTTS() {
  let rate = 0.9;
  let voiceURI = null;
  let unlocked = false;
  let voicesReady = null;

  function waitVoices() {
    if (voicesReady) return voicesReady;
    voicesReady = new Promise((resolve) => {
      const s = synth();
      if (!s) return resolve([]);
      if (s.getVoices().length) return resolve(s.getVoices());
      const done = () => resolve(s.getVoices());
      s.addEventListener?.('voiceschanged', done, { once: true });
      setTimeout(done, 1500);
    });
    return voicesReady;
  }

  function pickVoice() {
    const list = germanVoices();
    if (voiceURI) { const m = list.find((x) => x.uri === voiceURI); if (m) return m.voice; }
    return list.length ? list[0].voice : null;
  }

  /** iOS only plays speech started inside a user gesture: call once from the first tap (done automatically below). */
  function unlock() {
    const s = synth();
    if (!s || unlocked) return;
    unlocked = true;
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; u.lang = 'de-DE'; s.speak(u); } catch { /* ignore */ }
  }
  if (typeof document !== 'undefined') {
    const once = () => { unlock(); document.removeEventListener('touchend', once, true); document.removeEventListener('click', once, true); };
    document.addEventListener('touchend', once, true);
    document.addEventListener('click', once, true);
  }

  // strip inline markup (**bold**, ==hl==, _it_) and gap markers before speaking
  const clean = (t) => String(t || '').replace(/_{3,}/g, ' … ').replace(/\*\*|==|(^|\s)_|_(\s|$)/g, '$1$2').replace(/\s+/g, ' ').trim();

  return {
    get supported() { return !!synth(); },
    get rate() { return rate; },
    setRate(r) { rate = Math.min(1.5, Math.max(0.5, Number(r) || 0.9)); },
    /** voiceURI from germanVoices(), or null for automatic choice */
    setVoice(uri) { voiceURI = uri || null; },
    voices: germanVoices,
    ready: waitVoices,
    unlock,
    /** Speak German text. Resolves when finished (or immediately if unsupported). opts: {rate, onstart} */
    async speak(text, opts = {}) {
      const s = synth();
      const t = clean(text);
      if (!s || !t) return false;
      await waitVoices();
      s.cancel();
      return new Promise((resolve) => {
        const u = new SpeechSynthesisUtterance(t);
        u.lang = 'de-DE';
        const v = pickVoice();
        if (v) u.voice = v;
        u.rate = opts.rate ?? rate;
        u.onstart = () => opts.onstart && opts.onstart();
        u.onend = () => resolve(true);
        u.onerror = () => resolve(false);
        s.speak(u);
        // iOS sometimes pauses the queue
        if (s.paused) s.resume();
      });
    },
    cancel() { const s = synth(); if (s) s.cancel(); },
    get speaking() { const s = synth(); return !!(s && s.speaking); },
  };
}

export const tts = createTTS();
