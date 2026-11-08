// choice: tap one option. Vocab de→en cards (no ___ in q) show the German word big; der/die/das are colour-coded.
import { h, md, esc, speakBtn } from '../ui.js';

const GENDER = { der: 'g-der', die: 'g-die', das: 'g-das' };

export default function choice(ex, api) {
  const hasGap = /_{3,}/.test(ex.q || '');
  const isGender = ex.options.length === 3 && ex.options.every((o) => o in GENDER);
  const short = ex.options.every((o) => o.length <= 14);
  let picked = null;

  const q = hasGap
    ? h('div.ex-q', { html: md(ex.q) })
    : h('div.ex-q.big', { html: md(ex.q) });
  const opts = h('div.opts', { class: (isGender || (short && ex.options.length === 4)) ? 'cols2' : '', role: 'group', 'aria-label': 'Antworten' });
  if (isGender) opts.style.gridTemplateColumns = 'repeat(3, 1fr)';
  ex.options.forEach((o, i) => {
    const b = h('button.opt', { type: 'button', class: isGender ? GENDER[o] : '', html: `<span class="key">${i + 1}</span><span>${md(o)}</span>`, dataset: { i } });
    b.addEventListener('click', () => { if (picked != null) return; picked = i; b.classList.add('sel'); api.submit(); });
    opts.appendChild(b);
  });

  const el = h('div.ex.ex-choice',
    !hasGap && ex.audio ? h('div', { style: { display: 'flex', justifyContent: 'center' } }, speakBtn(ex.audio, { size: 22 })) : null,
    q,
    ex.hint ? h('div.ex-hint', { html: md(ex.hint) }) : null,
    hasGap && ex.en ? h('p.ex-en', { text: ex.en }) : null,
    opts);

  // keyboard: 1-5 picks an option (desktop / hardware keyboards)
  const onKey = (e) => {
    if (picked != null || e.target.matches?.('input, textarea')) return;
    const n = Number(e.key);
    if (n >= 1 && n <= ex.options.length) opts.children[n - 1].click();
  };
  document.addEventListener('keydown', onKey);

  return {
    el, auto: true,
    canSubmit: () => picked != null,
    response: () => picked,
    destroy: () => document.removeEventListener('keydown', onKey),
    reveal(res) {
      document.removeEventListener('keydown', onKey);
      opts.classList.add('done');
      [...opts.children].forEach((b, i) => {
        if (i === ex.answer) b.classList.add('ok');
        else if (i === picked) b.classList.add('no');
        else b.classList.add('dim');
      });
      if (hasGap) {
        const blank = q.querySelector('.blank');
        // the blank always shows the correct answer, so it is styled as correct
        if (blank) { blank.classList.add('filled', 'ok'); blank.innerHTML = esc(ex.options[ex.answer]); }
      }
    },
  };
}
