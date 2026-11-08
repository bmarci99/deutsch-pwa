// dictation: the sentence is spoken (TTS) → type it. Exercise shape (UI-made, not in content files):
// {id, type:'dictation', answers:[sentence, …], en?, why?, d, source?:{topic, exId}}
import { h, speakBtn, speak, answerInput, stripMd } from '../ui.js';
import { store } from '../store.js';
import { tts } from '../tts.js';

export default function dictation(ex, api) {
  const text = ex.answers[0];
  const inp = answerInput({ multiline: true, placeholder: 'Schreib, was du hörst …' });
  inp.addEventListener('input', () => api.changed());
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); api.submit(); } });
  const play = speakBtn(text, { size: 34, cls: 'big', label: 'Satz abspielen' });
  const slow = speakBtn(text, { size: 22, slow: true });

  const el = h('div.ex.ex-dictation',
    h('div.ex-instr', { text: tts.supported ? 'Hör zu und schreib den Satz.' : 'Sprachausgabe nicht verfügbar — tippe den Satz ab.' }),
    h('div.dict-play', play, slow),
    !tts.supported ? h('div.ex-source', { text }) : null,
    h('div.answer-wrap', inp));

  let played = false;
  return {
    el,
    focus() {
      inp.focus();
      if (!played && store.settings.autoplayAudio !== false) { played = true; setTimeout(() => speak(text, { btn: play }), 250); }
    },
    canSubmit: () => !!inp.value.trim(),
    response: () => inp.value,
    reveal(res) {
      inp.readOnly = true; inp.blur();
      inp.classList.add(res.result === 'correct' ? 'ok' : res.result === 'almost' ? 'almost' : 'no');
    },
  };
}

const words = (s) => s.split(/\s+/).filter(Boolean).length;
const okLen = (s) => { const n = words(s); return n >= 3 && n <= 14; };

/** Make a dictation from a content exercise with a full German sentence (or null). */
export function dictationFrom(ex, topicId = null) {
  let s = null;
  if (ex.type === 'order') s = ex.words.join(' ') + (ex.punct || '.');
  else if ((ex.type === 'transform' || ex.type === 'translate') && ex.answers?.length) s = ex.answers[0];
  else if (ex.type === 'gap' && /_{3,}/.test(ex.q) && /[.!?]$/.test(ex.q.trim())) { let i = 0; s = ex.q.replace(/_{3,}/g, () => ex.answers[i++]?.[0] ?? ''); }
  else if (ex.type === 'choice' && /_{3,}/.test(ex.q) && /[.!?]$/.test(ex.q.trim())) s = ex.q.replace(/_{3,}/, ex.options[ex.answer]);
  if (!s) return null;
  s = stripMd(s).replace(/\s+/g, ' ').trim();
  if (!okLen(s)) return null;
  return { id: `dict-${ex.id}`, type: 'dictation', answers: [s], en: ex.en, why: ex.why || 'Listen carefully to endings and word order.', d: ex.d || 2, source: { topic: topicId, exId: ex.id } };
}

/** All dictation candidates of a topic: lesson example sentences + exercise sentences. */
export function dictationsFromTopic(topic) {
  const out = [];
  const seen = new Set();
  const add = (d) => { if (d && !seen.has(d.answers[0])) { seen.add(d.answers[0]); out.push(d); } };
  (topic.lesson || []).forEach((b, bi) => {
    if (b.type !== 'examples') return;
    (b.items || []).forEach((it, ii) => {
      const s = stripMd(it.de).replace(/\s+/g, ' ').trim();
      if (okLen(s) && !/[✗✓→/]/.test(s)) add({ id: `dict-l${bi}-${ii}`, type: 'dictation', answers: [s], en: it.en, why: it.note || 'Example sentence from the lesson.', d: 1, source: { topic: topic.id } });
    });
  });
  for (const ex of topic.exercises || []) add(dictationFrom(ex, topic.id));
  return out;
}
