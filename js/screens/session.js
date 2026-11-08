// Session runner: one item at a time, instant feedback, SRS grading, re-queue of wrong items, summary.
// Routes: #/practice/<topic>?m=20|all|fehler|endlos|diktat · #/drill/<id>?lvl=&t= · #/session/<daily|mix|weak|mistakes|custom>
import { buildSource } from '../sources.js';
import { mountExercise, checkExercise, audioText, solutionText, promptText, expectedText, givenText, TYPE_LABEL } from '../exercises/index.js';
import { displayWord, wordInfo } from '../drills/index.js';
import { XP } from '../store.js';
import { h, md, esc, icon, t, bar, ring, speakBtn, speak, toast, xpBurst, haptic, isDetektiv, MOTIF, levelBadge, genderClass, reducedMotion, confirmSheet } from '../ui.js';
import { stripMd } from '../ui.js';
import { cast } from '../cast.js';

const SOURCE_LABEL = { due: 'Wiederholung', new: 'Neues Wort', weak: 'Schwachstelle', next: 'Neues Thema', mistake: 'Fehler', drill: 'Drill', dictation: 'Diktat', endless: null, mix: null };

export async function render(root, ctx) {
  const { content, store, nav } = ctx;
  root.innerHTML = `<div class="sess"><div class="sess-top"><button class="icon-btn sess-close" aria-label="Beenden">${icon('close')}</button>${bar(0)}</div><div class="empty"><p>${esc(isDetektiv() ? 'Akten werden gesichtet …' : 'Übung wird vorbereitet …')}</p></div></div>`;
  root.querySelector('.sess-close').onclick = () => ctx.back();
  let src;
  try { src = await buildSource(ctx); } catch (e) { console.error(e); src = { title: 'Übung', items: [], empty: `Fehler beim Laden: ${e.message}` }; }
  if (!ctx.token()) return;
  return run(root, ctx, src);
}

/** Run a session from a source object (see sources.js). Exported so other screens can embed it. */
export function run(root, ctx, src) {
  const { store, nav } = ctx;
  const backTo = () => (src.back ? nav(src.back) : ctx.back());
  const queue = [...(src.items || [])];
  let pos = 0;                 // index of the current item in queue
  let answered = 0, firstCorrect = 0, firstSeen = 0, xpTotal = 0, streak = 0, bestStreak = 0;
  const mistakes = [];         // {item, given, expected, prompt}
  const requeued = new Map();  // item → times re-queued
  const seenOnce = new Set();  // items answered at least once
  let ctl = null, startedAt = 0, current = null, fb = null, fbKey = null, done = false, loadingMore = false;
  const t0 = Date.now();
  let cleanupNext = null;   // cleanup of a restarted run ("Fehler nochmal üben")

  // ---------- chrome
  const closeBtn = h('button.icon-btn.sess-close', { 'aria-label': 'Beenden', html: icon('close') });
  const pbarWrap = h('div', { style: { flex: 1 }, html: bar(0) });
  const streakEl = h('div.sess-streak.zero', { html: `${icon('flame', { size: 18, fill: true })}<span>0</span>`, title: 'Serie' });
  const countEl = h('div.sess-count');
  const top = h('div.sess-top', closeBtn, pbarWrap, streakEl, countEl);
  const titleEl = h('div.sess-title');
  const body = h('div.sess-body');
  const foot = h('div.sess-foot');
  const wrap = h('div.sess', top, titleEl, body);
  root.replaceChildren(wrap);
  document.body.appendChild(foot); // outside .screen: its enter-animation transform would break position:fixed

  closeBtn.onclick = async () => {
    if (done) return backTo();
    if (answered === 0) return backTo();
    if (src.endless) return finish();
    const left = queue.length - pos;
    const ok = await confirmSheet({ title: 'Übung beenden?', text: `Noch ${left} Aufgaben offen. Dein Fortschritt bis hier ist gespeichert.`, ok: 'Beenden', cancel: 'Weitermachen' });
    if (ok) finish();
  };

  if (!queue.length) {
    titleEl.textContent = src.title || '';
    body.replaceChildren(h('div.empty', { html: `${icon('sparkles', { size: 36 })}<p>${md(src.empty || 'Nichts zu üben.')}</p>` }, h('button.btn.btn-secondary', { text: 'Zurück', onclick: backTo })));
    return cleanup;
  }

  function progress() {
    if (src.endless) { pbarWrap.innerHTML = bar(((answered % 10) || (answered ? 10 : 0)) / 10, {}); countEl.innerHTML = `${icon('infinity', { size: 16 })} ${answered}`; }
    else { const total = queue.length; pbarWrap.innerHTML = bar(pos / total); countEl.textContent = `${Math.min(pos + 1, total)}/${total}`; }
    streakEl.classList.toggle('zero', streak === 0);
    streakEl.querySelector('span').textContent = streak;
    streakEl.hidden = !(src.streak || src.endless) && streak < 3;
  }

  function setTitle(item) {
    const ex = item.exercise;
    const parts = [];
    const tm = item.topicId ? ctx.content.topicMeta(item.topicId) : null;
    const name = isDetektiv() && src.detektivTitle ? src.detektivTitle : src.title;
    parts.push(`<span>${esc(name || '')}</span>`);
    const lab = SOURCE_LABEL[item.source];
    if (lab && item.source !== src.kind) parts.push(`<span class="badge ${item.source === 'due' ? '' : item.source === 'new' ? 'good' : 'warn'}">${esc(lab)}</span>`);
    if (tm && tm.title !== src.title) parts.push(`<span class="badge">${esc(tm.title.length > 28 ? tm.title.slice(0, 26) + '…' : tm.title)}</span>`);
    if (ex.level || tm?.level) parts.push(levelBadge(ex.level || tm.level));
    titleEl.innerHTML = parts.join('');
  }

  // ---------- item display
  async function next() {
    hideFeedback();
    if (src.endless && src.more && queue.length - pos < 3 && !loadingMore) {
      loadingMore = true;
      try { const more = await src.more(); queue.push(...more); } catch (e) { console.error(e); }
      loadingMore = false;
    }
    if (pos >= queue.length) return finish();
    current = queue[pos];
    if (window.__dd) window.__dd.sessionItem = current; // debug / smoke tests
    progress();
    setTitle(current);
    if (current.intro && !current._introShown) return showIntro(current);
    showExercise(current);
  }

  function showIntro(item) {
    const w = item.word;
    const dw = displayWord(w);
    const card = h('div.card.flash.sess-card',
      h('div.new-badge', { html: `${icon('sparkles', { size: 14 })} Neues Wort · ${esc(w.lvl || '')}` }),
      h('div.w-big', { class: genderClass(w.pos === 'noun' ? w.g : ''), text: dw }),
      h('div', { style: { display: 'flex', justifyContent: 'center', margin: '6px 0' } }, speakBtn(dw.replace(/ \(Pl\.\)$/, ''), { size: 22 })),
      wordInfo(w) ? h('div.w-info', { text: wordInfo(w) }) : null,
      h('div.w-en', { text: w.en }),
      w.ex ? h('div.w-ex', h('div', h('div', { text: w.ex }), w.exEn ? h('div.muted.small', { text: w.exEn }) : null), speakBtn(w.ex, { size: 18 })) : null);
    body.replaceChildren(card);
    const go = h('button.btn.btn-primary.btn-lg', { text: 'Verstanden — weiter', onclick: () => { item._introShown = true; showExercise(item); } });
    foot.replaceChildren(go);
    if (store.settings.autoplayAudio !== false) setTimeout(() => speak(dw.replace(/ \(Pl\.\)$/, '')), 300);
    bindEnter(() => go.click());
  }

  function showExercise(item) {
    const ex = item.exercise;
    try { ctl?.destroy?.(); } catch { /* ignore */ }
    try {
      ctl = mountExercise(ex, { submit: () => submit(false), changed: updateFoot });
    } catch (e) {
      console.error(e);
      pos++; return next();
    }
    const kind = h('div.ex-kind', { html: `${esc(TYPE_LABEL[ex.type] || '')}${ex.d ? ` · ${'●'.repeat(ex.d)}${'○'.repeat(Math.max(0, 3 - ex.d))}` : ''}` });
    const card = h('div.sess-card', kind, ctl.el);
    body.replaceChildren(card);
    startedAt = Date.now();
    const checkBtn = h('button.btn.btn-primary.btn-lg', { text: t('check'), onclick: () => submit(false) });
    const skip = h('button.btn.btn-ghost', { text: t('dontKnow'), onclick: () => submit(true), style: { flex: 'none', paddingInline: '12px' } });
    foot.replaceChildren(...[skip, ctl.auto ? null : checkBtn].filter(Boolean));
    if (ctl.auto) skip.style.flex = '1';
    updateFoot();
    unbindEnter();
    // autoplay German audio of vocab cards (de→en)
    if (ex.word && ex.type === 'choice' && !/_{3,}/.test(ex.q) && ex.audio && store.settings.autoplayAudio !== false) setTimeout(() => speak(ex.audio), 250);
    if (!('ontouchstart' in window) || ex.type === 'dictation') { const mine = ctl; setTimeout(() => { if (ctl === mine && !fb) ctl.focus?.(); }, reducedMotion() ? 0 : 340); }
    window.scrollTo({ top: 0 });
  }

  function updateFoot() {
    const b = foot.querySelector('.btn-primary');
    if (b && ctl) b.disabled = !ctl.canSubmit();
  }

  // ---------- answer
  function submit(dontKnow) {
    if (!ctl || fb || !current) return;
    if (!dontKnow && !ctl.canSubmit()) return;
    const ex = current.exercise;
    const response = ctl.response();
    let res;
    try { res = checkExercise(ex, response); } catch (e) { console.error(e); res = { result: 'wrong', score: 0 }; }
    if (dontKnow) res = { ...res, result: 'wrong', score: 0, dontKnow: true };
    const ms = Date.now() - startedAt;
    ctl.reveal(res);
    haptic(res.result === 'correct' ? 'success' : res.result === 'wrong' ? 'error' : 'light');
    showFeedback(current, res, response, ms);
  }

  function showFeedback(item, res, response, ms) {
    const ex = item.exercise;
    let result = res.result;
    let overridden = false;
    const okIc = { correct: 'check', almost: 'alert', wrong: 'x' };
    const sol = solutionText(ex);
    const audio = audioText(ex);
    const title = result === 'correct' ? t('correct') : result === 'almost' ? t('almost') : t('wrong');
    const head = h('div.fb-head', h('div.fb-ic', { html: icon(okIc[result], { size: 20 }) }), h('div.fb-title', { text: title }), h('div.fb-xp', { text: `+${XP[result]} XP` }));
    const parts = [head];
    if (isDetektiv()) parts.push(cast.bubble(result, { size: 36 }));

    if (result !== 'correct' || ex.type === 'dictation' || ex.type === 'transform' || ex.type === 'translate') {
      if (res.diff && result !== 'correct' && !res.dontKnow && ['transform', 'translate', 'dictation'].includes(ex.type)) {
        parts.push(h('div.fb-label', { text: 'Deine Antwort' }), h('div.diff', { html: diffHtml(res.diff) }));
      }
      if (sol && ex.type !== 'match' && ex.type !== 'table') {
        parts.push(h('div.fb-label', { text: result === 'correct' ? 'Lösung' : 'Richtig' }), h('div.fb-answer', h('div.grow', { html: solutionHtml(ex) }), audio ? speakBtn(audio) : null));
      } else if (!sol && audio) parts.push(h('div.fb-answer', h('div.grow', { html: md(audio) }), speakBtn(audio)));
      if (res.matched && ex.answers && res.matched !== ex.answers[0] && result !== 'wrong') parts.push(h('p.fb-en', { html: `Akzeptiert: ${esc(res.matched)}` }));
    } else if (audio && sol) {
      parts.push(h('div.fb-answer', h('div.grow', { html: solutionHtml(ex) }), speakBtn(audio)));
    } else if (audio) parts.push(h('div.fb-answer', h('div.grow', { html: md(audio) }), speakBtn(audio)));
    const notices = res.notices || res.gaps?.flatMap((g) => g.notices || []) || [];
    for (const n of [...new Set(notices)]) parts.push(h('div.fb-notice', { html: `${icon('info', { size: 16 })}<span>${esc(n)}</span>` }));
    if (ex.en && ex.type !== 'translate' && !(ex.word && ex.type === 'choice')) parts.push(h('p.fb-en', { text: `„${ex.en}“` }));
    if (ex.why) parts.push(h('div.fb-why', { html: md(ex.why) }));

    const nextBtn = h('button.btn.btn-primary.btn-lg', { text: t('next') });
    const actions = h('div.fb-actions');
    if (result !== 'correct' && !res.dontKnow && ex.type !== 'choice') {
      const ovr = h('button.btn.btn-secondary.fb-override', {
        html: `${icon('check', { size: 16 })} Ich hatte recht`,
        onclick: () => {
          overridden = true; result = 'correct';
          fbEl.className = 'fb in correct';
          head.querySelector('.fb-title').textContent = 'Als richtig gewertet';
          head.querySelector('.fb-ic').innerHTML = icon('check', { size: 20 });
          head.querySelector('.fb-xp').textContent = `+${XP.correct} XP`;
          ovr.remove();
        },
      });
      actions.appendChild(ovr);
    }
    actions.appendChild(nextBtn);
    parts.push(actions);

    const fbEl = h('div.fb', { class: result, role: 'dialog', 'aria-label': title }, h('div.fb-inner', parts));
    document.body.appendChild(fbEl);
    fb = fbEl;
    requestAnimationFrame(() => requestAnimationFrame(() => fbEl.classList.add('in')));
    foot.style.visibility = 'hidden';
    body.style.paddingBottom = '60dvh';
    if ((item.kind === 'word' || ex.drill === 'gender' || ex.drill === 'plural') && audio && store.settings.autoplayAudio !== false && result !== 'correct') setTimeout(() => speak(audio), 200);

    const proceed = () => {
      if (!fb) return;
      record(item, ex, res, response, result, overridden, ms);
      pos++;
      next();
    };
    nextBtn.onclick = proceed;
    setTimeout(() => nextBtn.focus({ preventScroll: true }), 60);
    bindEnter(proceed, 200);
  }

  function record(item, ex, res, response, result, overridden, ms) {
    const first = !seenOnce.has(item);
    seenOnce.add(item);
    const given = res.dontKnow ? '(weiß nicht)' : givenText(ex, response);
    const expected = stripMd(expectedText(ex));
    const prompt = promptText(ex);
    const id = item.cardId || `${item.kind}:${item.topicId || ''}:${ex.id}`;
    let out = { xp: 0 };
    try {
      out = store.recordAttempt({
        id, card: item.cardId || undefined, topic: item.topicId || undefined, exId: item.kind === 'exercise' ? ex.id : undefined,
        drill: ex.drill || item.drillId || undefined, kind: item.kind, result, score: overridden ? 1 : res.score,
        given, expected, prompt, why: ex.why, ms, grade: overridden ? 3 : undefined,
      });
    } catch (e) { console.error(e); }
    xpTotal += out.xp || 0;
    xpBurst(out.xp, streakEl);
    answered++;
    if (first) { firstSeen++; if (result === 'correct') firstCorrect++; }
    if (result === 'correct') { streak++; bestStreak = Math.max(bestStreak, streak); streakEl.classList.add('bump'); setTimeout(() => streakEl.classList.remove('bump'), 250); if (streak > 0 && streak % 10 === 0) toast(`${streak} richtig in Folge!`, { icon: 'flame', type: 'good' }); }
    else streak = 0;
    if (result !== 'correct') {
      if (first) mistakes.push({ item, given, expected, prompt });
      const n = requeued.get(item) || 0;
      if (n < 2) {
        requeued.set(item, n + 1);
        if (src.endless) queue.splice(Math.min(queue.length, pos + 4), 0, item);
        else queue.push(item);
      }
    }
  }

  function hideFeedback() {
    unbindEnter();
    foot.style.visibility = '';
    body.style.paddingBottom = '';
    if (!fb) return;
    const el = fb; fb = null;
    el.classList.remove('in');
    setTimeout(() => el.remove(), 320);
  }

  function bindEnter(fn, delay = 0) {
    unbindEnter();
    const k = (e) => { if (e.key === 'Enter' && !e.isComposing && !e.repeat) { e.preventDefault(); fn(); } };
    const timer = setTimeout(() => { fbKey = k; document.addEventListener('keydown', k); }, delay);
    fbKey = { timer };
  }
  function unbindEnter() {
    if (!fbKey) return;
    if (typeof fbKey === 'function') document.removeEventListener('keydown', fbKey);
    else clearTimeout(fbKey.timer);
    fbKey = null;
  }

  // ---------- summary
  function finish() {
    if (done) return;
    done = true;
    hideFeedback();
    try { ctl?.destroy?.(); } catch { /* ignore */ }
    const acc = firstSeen ? firstCorrect / firstSeen : 0;
    const ms = Date.now() - t0;
    if (answered) store.finishSession({ topic: src.topicId, score: acc, ms });
    const perfect = firstSeen >= 3 && firstCorrect === firstSeen;
    const headline = perfect ? t('perfect') : acc >= 0.8 ? (isDetektiv() ? t('done') : 'Sehr gut gemacht!') : acc >= 0.5 ? (isDetektiv() ? t('done') : 'Gut geübt!') : (isDetektiv() ? 'Die Ermittlungen gehen weiter' : 'Dranbleiben!');
    const mins = Math.max(1, Math.round(ms / 60000));
    top.querySelector('.pbar')?.remove();
    pbarWrap.innerHTML = bar(1);
    countEl.textContent = '';
    titleEl.innerHTML = '';
    foot.replaceChildren();

    const sum = h('div.summary.sess-card',
      frag(MOTIF.magnifier),
      h('div', { html: ring(acc, { size: 132, stroke: 12, label: `${Math.round(acc * 100)}%`, sub: 'richtig', color: acc >= 0.8 ? 'var(--good)' : acc >= 0.5 ? 'var(--accent)' : 'var(--warn)' }) }),
      h('h1', { text: headline }),
      isDetektiv() ? cast.bubble(perfect ? 'perfect' : 'sessionEnd') : null,
      h('p.muted', { text: `${src.title || ''}${src.kicker ? ' · ' + src.kicker : ''}` }),
      h('div.sum-stats',
        h('div.sum-stat', h('b', { text: `+${xpTotal}` }), h('span', { text: 'XP' })),
        h('div.sum-stat', h('b', { text: `${firstCorrect}/${firstSeen}` }), h('span', { text: 'beim 1. Versuch' })),
        h('div.sum-stat', h('b', { text: bestStreak ? `${bestStreak}` : `${mins}′` }), h('span', { text: bestStreak ? 'beste Serie' : 'Minuten' }))));

    if (mistakes.length) {
      sum.appendChild(h('div.sec-head', h('h2', { text: `Fehler (${mistakes.length})` })));
      const list = h('div.list.sum-mistakes');
      for (const m of mistakes.slice(0, 30)) {
        list.appendChild(h('div.mistake',
          h('div.m-prompt', { html: md(m.prompt) }),
          m.given ? h('div.m-given', { text: m.given }) : null,
          h('div.m-exp', { text: `✓ ${m.expected}` })));
      }
      sum.appendChild(list);
    }
    const actions = h('div.sum-actions');
    if (mistakes.length) actions.appendChild(h('button.btn.btn-primary.btn-lg', { html: `${icon('repeat', { size: 18 })} Fehler nochmal üben`, onclick: () => restartWith(mistakes.map((m) => ({ ...m.item, _introShown: true }))) }));
    actions.appendChild(h('button.btn.btn-lg', { class: mistakes.length ? 'btn-secondary' : 'btn-primary', html: `${icon('play', { size: 18 })} ${src.endless ? 'Weiter üben' : 'Nochmal'}`, onclick: () => ctx.nav(location.hash, null, {}) }));
    actions.appendChild(h('button.btn.btn-ghost', { text: 'Fertig', onclick: backTo }));
    sum.appendChild(actions);
    body.replaceChildren(sum);
    window.scrollTo({ top: 0 });
    if (perfect && !reducedMotion()) confetti();
  }

  function restartWith(items) {
    cleanup();
    const again = run(root, ctx, { ...src, items, endless: false, more: null, kicker: 'Fehler wiederholen' });
    // the router still holds this run's cleanup → forward it to the new run
    cleanupNext = again;
  }

  function cleanup() {
    if (cleanupNext) { const c = cleanupNext; cleanupNext = null; c(); }
    unbindEnter();
    try { ctl?.destroy?.(); } catch { /* ignore */ }
    if (fb) { fb.remove(); fb = null; }
    foot.remove();
  }

  next();
  return cleanup;
}

// ---------- helpers
const frag = (html) => { const t = document.createElement('template'); t.innerHTML = html; return t.content.firstElementChild; };

function diffHtml(diff) {
  return diff.map((d) => {
    if (d.status === 'wrong') return `<span class="dw wrong">${esc(d.text)}</span><span class="dw exp">${esc(d.expected || '')}</span>`;
    return `<span class="dw ${d.status}">${esc(d.text)}</span>`;
  }).join(' ');
}

/** Solution with the answer parts highlighted. */
function solutionHtml(ex) {
  if (ex.type === 'gap') {
    let i = 0;
    return md(String(ex.q).replace(/_{3,}/g, () => `\u0001${i++}\u0001`)).replace(/\u0001(\d+)\u0001/g, (_, k) => `<mark>${esc(ex.answers[k]?.[0] ?? '')}</mark>`);
  }
  if (ex.type === 'choice' && /_{3,}/.test(ex.q)) return md(ex.q).replace(/<span class="blank"[^>]*>&nbsp;<\/span>/, `<mark>${esc(ex.options[ex.answer])}</mark>`);
  if (ex.type === 'choice') return `${md(ex.q)} = <mark>${md(ex.options[ex.answer])}</mark>`;
  if (ex.type === 'error') return ex.tokens.map((tk, i) => (i === ex.wrong ? `<mark>${esc(ex.fix)}</mark>${esc((/[.,!?;:]+$/.exec(tk) || [''])[0])}` : esc(tk))).join(' ');
  return md(solutionText(ex) || '');
}

function confetti() {
  const c = document.createElement('div');
  c.className = 'confetti';
  const colors = isDetektiv() ? ['#c8102e', '#f4b81c', '#1f3a73', '#fbf8f0'] : ['#2e62f0', '#1f9e57', '#ff7a1a', '#e0393e', '#8b5cf6'];
  for (let i = 0; i < 60; i++) {
    const p = document.createElement('i');
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = `${Math.random() * 0.6}s`;
    p.style.animationDuration = `${1.4 + Math.random() * 1.2}s`;
    c.appendChild(p);
  }
  document.body.appendChild(c);
  setTimeout(() => c.remove(), 3200);
}
