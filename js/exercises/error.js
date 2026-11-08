// error: find the one wrong word. Tap it, optionally type the correction, then "Prüfen".
// Tapping a word selects it (tap again to deselect). If a correction is typed it is checked too.
import { h, esc, answerInput } from '../ui.js';

export default function error(ex, api) {
  let sel = null;
  const fixInp = answerInput({ placeholder: 'Korrektur (optional)', label: 'Korrektur' });
  fixInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); api.submit(); } });
  fixInp.addEventListener('input', () => api.changed());
  const fixWrap = h('div.answer-wrap', { hidden: true }, h('div.answer-label', { text: 'Richtig wäre …' }), fixInp);

  const sent = h('div.err-sent', { role: 'group', 'aria-label': 'Satz' });
  const toks = ex.tokens.map((t, i) => {
    const b = h('button.tok', { type: 'button', text: t });
    b.addEventListener('click', () => {
      if (sent.classList.contains('err-done')) return;
      sel = sel === i ? null : i;
      toks.forEach((x, j) => x.classList.toggle('sel', j === sel));
      fixWrap.hidden = sel == null;
      if (sel != null) { fixInp.value = ''; fixInp.placeholder = `statt „${t.replace(/[.,!?;:]+$/, '')}“ …`; }
      api.changed();
    });
    sent.appendChild(b);
    return b;
  });

  const el = h('div.ex.ex-error',
    h('div.ex-instr', { text: 'Ein Wort ist falsch. Tippe es an.' }),
    sent,
    ex.en ? h('p.ex-en', { text: ex.en }) : null,
    fixWrap);

  return {
    el,
    canSubmit: () => sel != null,
    response: () => ({ index: sel, fix: fixInp.value.trim() ? fixInp.value : undefined }),
    reveal(res) {
      sent.classList.add('err-done');
      fixInp.readOnly = true; fixInp.blur();
      toks.forEach((b, i) => {
        if (i === ex.wrong) { b.classList.add(sel === i ? 'ok' : 'no'); b.innerHTML = `${esc(ex.tokens[i])}<span class="fix">→ ${esc(ex.fix)}</span>`; b.classList.remove('sel'); }
        else if (i === sel) b.classList.add('no');
      });
      if (res.fixCheck) fixInp.classList.add(res.fixCheck.result === 'correct' ? 'ok' : res.fixCheck.result === 'almost' ? 'almost' : 'no');
    },
  };
}
