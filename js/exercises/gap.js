// gap: type each ___ inline. Enter jumps to the next gap, or submits on the last one.
// A gap-only question like "table → ___" (vocab en→de) gets one large input under the prompt.
import { h, md, esc, answerInput } from '../ui.js';

export default function gap(ex, api) {
  const parts = String(ex.q || '').split(/_{3,}/);
  const n = parts.length - 1;
  const inputs = [];
  const longest = (i) => Math.max(...(ex.answers[i] || ['']).map((a) => a.length));
  // a prompt ending in a single gap with little after it → big input below
  const solo = n === 1 && parts[1].trim().length <= 2 && (parts[0].length > 0 && /[→:=]\s*$/.test(parts[0]) || ex.word);

  const mk = (i) => {
    const inp = answerInput({ cls: solo ? '' : 'gap-in', label: `Lücke ${i + 1}` });
    if (!solo) inp.style.width = `${Math.min(14, Math.max(3.2, longest(i) * 0.72 + 1.6))}em`;
    inp.addEventListener('input', () => api.changed());
    inp.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const next = inputs[i + 1];
      if (next && !next.value) next.focus(); else api.submit();
    });
    inputs.push(inp);
    return inp;
  };

  let sent;
  if (solo) {
    sent = h('div',
      h('div.ex-q', { html: md(parts[0].replace(/\s*[→:=]\s*$/, '')) + (parts[1].trim() ? ` ${md(parts[1])}` : '') }),
      ex.hint ? h('div.ex-hint', { html: md(ex.hint) }) : null,
      h('div.answer-wrap', mk(0)));
  } else {
    sent = h('div.gap-sent');
    parts.forEach((p, i) => {
      sent.appendChild(h('span', { html: md(p) }));
      if (i < n) sent.appendChild(mk(i));
    });
  }

  const el = h('div.ex.ex-gap',
    sent,
    !solo && ex.hint ? h('div.ex-hint', { html: md(ex.hint) }) : null,
    !solo && ex.en ? h('p.ex-en', { text: ex.en }) : null);

  return {
    el,
    focus: () => inputs[0]?.focus({ preventScroll: false }),
    canSubmit: () => inputs.some((i) => i.value.trim()),
    response: () => inputs.map((i) => i.value),
    reveal(res) {
      inputs.forEach((inp, i) => {
        const g = res.gaps?.[i];
        inp.readOnly = true;
        inp.classList.add(g?.result === 'correct' ? 'ok' : g?.result === 'almost' ? 'almost' : 'no');
        if (g && g.result !== 'correct') {
          const fix = h('span.gap-fix', { html: esc(ex.answers[i][0]) });
          if (solo) { fix.style.display = 'block'; fix.style.margin = '8px 2px 0'; fix.style.fontSize = '18px'; fix.style.verticalAlign = 'baseline'; }
          inp.after(fix);
        }
      });
      inputs.forEach((i) => i.blur());
    },
  };
}
