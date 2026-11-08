// Answer checking per docs/CONTENT_SPEC.md.
// Results: 'correct' | 'almost' | 'wrong'. "almost" = right answer with a cosmetic slip
// (ae/oe/ue/ss instead of ä/ö/ü/ß). Capitalisation-only differences count as correct (with a notice). Every check returns {result, score, ...details}.

export const SCORE = { correct: 1, almost: 0.5, wrong: 0 };
const RANK = { correct: 2, almost: 1, wrong: 0 };

export const NOTICES = {
  umlaut: 'Right — but write ä, ö, ü, ß (you typed ae/oe/ue/ss).',
  case: 'Correct — just mind the capitalisation.',
  nounCase: 'Correct — but remember: nouns are always capitalised in German.',
};

// ---------------------------------------------------------------- normalisation
/** Trim, unify quotes/dashes/spaces, drop final .!?… and surrounding quotes. Case and umlauts are kept. */
export function normalize(s) {
  if (s == null) return '';
  let t = String(s).normalize('NFC')
    .replace(/[   \t\n\r]/g, ' ')
    .replace(/[„“”‟″«»]/g, '"')
    .replace(/[‚‘’‛′‹›`´]/g, "'")
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/ ([,;:])/g, '$1')
    .replace(/([,;:])(?=\S)/g, '$1 ')
    .trim();
  for (let i = 0; i < 3; i++) {
    const before = t;
    t = t.replace(/^["']+|["']+$/g, '').trim();
    t = t.replace(/(\s*[.!?…]+)+$/u, '').trim();
    if (t === before) break;
  }
  return t;
}

/** ä→ae, ö→oe, ü→ue, ß→ss (case-preserving). */
export function translit(s) {
  return s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss').replace(/ẞ/g, 'SS');
}
/** Comparison key that ignores case and umlaut spelling. */
export function fold(s) { return translit(normalize(s)).toLowerCase(); }

const stripPunct = (w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
const tokens = (s) => normalize(s).split(' ').filter(Boolean);

// ---------------------------------------------------------------- word diff
/**
 * Word-level alignment of a given answer against one expected answer.
 * Returns [{text, status, expected?}] in reading order. status:
 *  'ok' | 'case' (only capitalisation differs) | 'umlaut' (ae/oe/ue/ss spelling) | 'wrong' (substituted; expected given)
 *  | 'extra' (word not in the answer) | 'missing' (text = expected word the user left out).
 */
export function diffWords(given, expected) {
  const a = tokens(given), b = tokens(expected);
  const key = (w) => translit(stripPunct(w)).toLowerCase();
  const ka = a.map(key), kb = b.map(key);
  const n = a.length, m = b.length;
  const D = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) D[i][0] = i;
  for (let j = 0; j <= m; j++) D[0][j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (ka[i - 1] === kb[j - 1] ? 0 : 1));
  }
  const out = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + (ka[i - 1] === kb[j - 1] ? 0 : 1)) {
      const g = a[i - 1], e = b[j - 1];
      let status;
      if (ka[i - 1] !== kb[j - 1]) status = 'wrong';
      else if (stripPunct(g) === stripPunct(e)) status = 'ok';
      else if (stripPunct(g).toLowerCase() === stripPunct(e).toLowerCase()) status = 'case';
      else if (translit(stripPunct(g)) === translit(stripPunct(e))) status = 'umlaut';
      else status = 'case'; // umlaut + case
      out.push(status === 'ok' ? { text: g, status } : { text: g, status, expected: e });
      i--; j--;
    } else if (i > 0 && D[i][j] === D[i - 1][j] + 1) { out.push({ text: a[i - 1], status: 'extra' }); i--; }
    else { out.push({ text: b[j - 1], status: 'missing' }); j--; }
  }
  return out.reverse();
}

function editDistance(a, b) {
  const m = b.length; let prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= m; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[m];
}

// ---------------------------------------------------------------- text comparison
/**
 * Compare one typed answer against a single expected string.
 * opts.ignoreInitialCase: the answer starts a sentence → first letter's case is irrelevant.
 * Returns {result, notices:[...], flags:{umlaut, case, nounCase}}.
 */
export function compareOne(given, expected, opts = {}) {
  let g = normalize(given), e = normalize(expected);
  if (opts.ignoreInitialCase && g && e) { g = g[0].toLowerCase() + g.slice(1); e = e[0].toLowerCase() + e.slice(1); }
  const flags = { umlaut: false, case: false, nounCase: false };
  if (g === e) return { result: 'correct', notices: [], flags };
  if (!g) return { result: 'wrong', notices: [], flags };
  const tg = translit(g), te = translit(e);
  if (tg === te) { flags.umlaut = true; return { result: 'almost', notices: [NOTICES.umlaut], flags }; }
  if (tg.toLowerCase() === te.toLowerCase()) {
    flags.case = true;
    flags.umlaut = g.toLowerCase() !== e.toLowerCase();
    // noun capitalisation: an expected capitalised word (not sentence-initial) typed in lower case
    const gw = g.split(' '), ew = e.split(' ');
    ew.forEach((w, i) => {
      const gi = gw[i] || '';
      const isInitial = i === 0 && (opts.ignoreInitialCase || opts.sentence);
      if (!isInitial && /^\p{Lu}/u.test(w) && /^\p{Ll}/u.test(gi) && w !== 'Sie' && w !== 'Ihr' && w !== 'Ihnen' && w !== 'Ihre') flags.nounCase = true;
    });
    // Capitalisation alone never costs points (the drills test endings, cases and word order): all-caps input
    // (caps lock) is simply accepted; other case slips are accepted with a gentle notice.
    const allCaps = /\p{L}{2,}/u.test(g) && g === g.toUpperCase();
    const notices = allCaps ? [] : [flags.nounCase ? NOTICES.nounCase : NOTICES.case];
    if (flags.umlaut) notices.push(NOTICES.umlaut);
    return { result: flags.umlaut ? 'almost' : 'correct', notices, flags };
  }
  return { result: 'wrong', notices: [], flags };
}

/**
 * Check typed text against a list of accepted variants.
 * Returns {result, score, matched (best variant), notices, flags, diff}.
 * diff is present when result !== 'correct' (against the closest variant).
 */
export function checkText(given, accepted, opts = {}) {
  const list = (Array.isArray(accepted) ? accepted : [accepted]).filter((x) => x != null);
  let best = null;
  for (const a of list) {
    const r = compareOne(given, a, opts);
    if (!best || RANK[r.result] > RANK[best.result]) best = { ...r, matched: a };
    if (r.result === 'correct') break;
  }
  if (!best) best = { result: 'wrong', notices: [], flags: {}, matched: '' };
  if (best.result === 'wrong' && list.length > 1) {
    const fg = fold(given);
    let bd = Infinity;
    for (const a of list) { const d = editDistance(fg, fold(a)); if (d < bd) { bd = d; best.matched = a; } }
  }
  const out = { result: best.result, score: SCORE[best.result], matched: best.matched, notices: best.notices, flags: best.flags };
  if (best.result !== 'correct') out.diff = diffWords(given, best.matched);
  return out;
}

const worst = (results) => results.some((r) => r === 'wrong') ? 'wrong' : results.some((r) => r === 'almost') ? 'almost' : 'correct';
const uniq = (a) => [...new Set(a)];

// ---------------------------------------------------------------- per exercise type
export function checkChoice(ex, index) {
  const result = index === ex.answer ? 'correct' : 'wrong';
  return { result, score: SCORE[result], correctIndex: ex.answer, correct: ex.options[ex.answer] };
}

/** Is gap number i (0-based) at the start of a sentence in q? */
export function gapAtSentenceStart(q, i) {
  const parts = String(q).split('___');
  const before = parts.slice(0, i + 1).join('___').replace(/["'„“‚‘(\s]+$/u, '');
  return before === '' || /[.!?:]$/.test(before);
}

/** given: array of strings (one per ___). */
export function checkGap(ex, given) {
  const arr = Array.isArray(given) ? given : [given];
  const gaps = ex.answers.map((acc, i) => checkText(arr[i] ?? '', acc, { ignoreInitialCase: gapAtSentenceStart(ex.q, i) }));
  const result = worst(gaps.map((g) => g.result));
  return {
    result, score: gaps.reduce((s, g) => s + g.score, 0) / (gaps.length || 1), gaps,
    notices: uniq(gaps.flatMap((g) => g.notices || [])), expected: ex.answers.map((a) => a[0]),
  };
}

/** given: array of tile strings in the user's order. */
export function checkOrder(ex, given) {
  const variants = [ex.words, ...(ex.alts || [])];
  const g = given.map((t) => normalize(t));
  let best = null;
  for (const v of variants) {
    const pos = v.map((w, i) => normalize(w) === g[i]);
    const hits = pos.filter(Boolean).length;
    if (!best || hits > best.hits) best = { v, pos, hits };
  }
  const ok = best.hits === best.v.length && g.length === best.v.length;
  // also accept a typed/joined equivalent that differs only in tile grouping
  const joined = checkText(given.join(' '), variants.map((v) => v.join(' ')), { ignoreInitialCase: true });
  const result = ok ? 'correct' : joined.result === 'correct' ? 'correct' : 'wrong';
  return { result, score: SCORE[result], positions: best.pos, expected: best.v, sentence: best.v.join(' ') + (ex.punct || '') };
}

/** Typed full sentence (transform / translate). */
export function checkSentence(ex, given) {
  return checkText(given, ex.answers, { ignoreInitialCase: true, sentence: true });
}

/** response: {index, fix?}. Tapping the right token is required; a typed fix (if any) is checked too. */
export function checkError(ex, response) {
  const index = typeof response === 'number' ? response : response?.index;
  const found = index === ex.wrong;
  let fixRes = null;
  if (found && response && typeof response === 'object' && response.fix != null) fixRes = checkText(response.fix, [ex.fix]);
  const result = !found ? 'wrong' : fixRes ? fixRes.result : 'correct';
  return { result, score: SCORE[result], wrongIndex: ex.wrong, fix: ex.fix, fixCheck: fixRes };
}

/** given: array of [left, right] pairs or an object {left: right}. */
export function checkMatch(ex, given) {
  const map = Array.isArray(given) ? Object.fromEntries(given) : given || {};
  const pairs = ex.pairs.map(([l, r]) => ({ left: l, expected: r, given: map[l] ?? null, ok: map[l] === r }));
  const nOk = pairs.filter((p) => p.ok).length;
  const result = nOk === pairs.length ? 'correct' : 'wrong';
  return { result, score: nOk / pairs.length, pairs };
}

// ---------------------------------------------------------------- table
const BLANK_RE = /\[\[([^\]]+)\]\]/g;
/**
 * Parse a table exercise. Returns {head, rows:[[{parts:[{text}|{blank:key}]}]], blanks:[{key,r,c,k,answers}]}.
 * key = `${r}.${c}.${k}` (row, column, k-th blank inside the cell).
 */
export function parseTable(ex) {
  const blanks = [];
  const rows = ex.rows.map((row, r) => row.map((cell, c) => {
    const parts = []; let last = 0, k = 0, m;
    BLANK_RE.lastIndex = 0;
    while ((m = BLANK_RE.exec(cell))) {
      if (m.index > last) parts.push({ text: cell.slice(last, m.index) });
      const key = `${r}.${c}.${k++}`;
      blanks.push({ key, r, c, k: k - 1, answers: m[1].split('|').map((s) => s.trim()) });
      parts.push({ blank: key });
      last = m.index + m[0].length;
    }
    if (last < cell.length) parts.push({ text: cell.slice(last) });
    return { parts };
  }));
  return { head: ex.head, rows, blanks };
}

/** given: {key: string}. */
export function checkTable(ex, given) {
  const { blanks } = parseTable(ex);
  const cells = {};
  for (const b of blanks) cells[b.key] = { ...checkText(given?.[b.key] ?? '', b.answers), expected: b.answers[0] };
  const results = Object.values(cells);
  const result = worst(results.map((x) => x.result));
  return { result, score: results.reduce((s, x) => s + x.score, 0) / (results.length || 1), cells, notices: uniq(results.flatMap((x) => x.notices || [])) };
}

/**
 * Dispatcher. response shape by type:
 *  choice: index · gap: [str] · order: [tile] · transform/translate: str · error: {index, fix?} | index
 *  match: [[l,r]] | {l:r} · table: {key: str}
 */
export function check(ex, response) {
  switch (ex.type) {
    case 'choice': return checkChoice(ex, response);
    case 'gap': return checkGap(ex, response);
    case 'order': return checkOrder(ex, response);
    case 'transform': case 'translate': return checkSentence(ex, response);
    case 'error': return checkError(ex, response);
    case 'match': return checkMatch(ex, response);
    case 'table': return checkTable(ex, response);
    default: throw new Error(`unknown exercise type ${ex.type}`);
  }
}
