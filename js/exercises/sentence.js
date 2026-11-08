// transform + translate: type a whole sentence. Enter submits (Shift+Enter is ignored — sentences are one line).
import { h, md, speakBtn, answerInput } from '../ui.js';

export default function sentence(ex, api) {
  const inp = answerInput({ multiline: true, placeholder: 'Deine Antwort auf Deutsch …' });
  inp.addEventListener('input', () => api.changed());
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); api.submit(); } });

  const head = ex.type === 'transform'
    ? [h('div.ex-instr', { html: md(ex.instruction) }), h('div.ex-source', h('div.grow', { html: md(ex.source) }), speakBtn(ex.source))]
    : [h('div.ex-instr', { text: 'Übersetze ins Deutsche.' }), h('div.ex-q', { html: md(ex.en) })];

  const el = h('div.ex.ex-' + ex.type, ...head,
    ex.hint ? h('div.ex-hint', { html: md(ex.hint) }) : null,
    h('div.answer-wrap', inp));

  return {
    el,
    focus: () => inp.focus(),
    canSubmit: () => !!inp.value.trim(),
    response: () => inp.value,
    reveal(res) {
      inp.readOnly = true; inp.blur();
      inp.classList.add(res.result === 'correct' ? 'ok' : res.result === 'almost' ? 'almost' : 'no');
    },
  };
}
