// Password lock for the published site. tools/build.mjs encrypts every content file (bundle + topics) with
// AES-256-GCM using a key derived from the owner's password (PBKDF2-SHA256), and writes content/lock.json
// {v, salt, iter, check}. The public site therefore contains only ciphertext. After a successful unlock the
// derived key is kept on this device (IndexedDB, as a non-extractable CryptoKey), so the password is asked once.
// Dev (web/ served directly) has no lock.json → no lock.
//
//   const fetchFn = await unlockIfNeeded();   // undefined when unlocked content isn't needed
//   const content = await loadContent({ fetch: fetchFn });

const DB = 'dd-lock', STORE = 'keys', KEY_ID = 'content';
const CHECK_TEXT = 'deutsch-detektiv';
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function idb(mode, fn) {
  return new Promise((res) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onerror = () => res(null);
      r.onsuccess = () => {
        try {
          const tx = r.result.transaction(STORE, mode);
          const req = fn(tx.objectStore(STORE));
          tx.oncomplete = () => res(req && req.result);
          tx.onerror = tx.onabort = () => res(null);
        } catch { res(null); }
      };
    } catch { res(null); }
  });
}

async function deriveKey(password, lock) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: b64(lock.salt), iterations: lock.iter },
    base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}

/** bytes = 12-byte IV ‖ ciphertext+tag */
async function decrypt(key, bytes) {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12)));
}

async function keyWorks(key, lock) {
  try { return (await decrypt(key, b64(lock.check))) === CHECK_TEXT; } catch { return false; }
}

/** fetch() replacement: content/*.json is served from the matching encrypted .bin, decrypted with key. */
function decryptingFetch(key) {
  return async (url) => {
    const u = String(url);
    if (!/content\/.*\.json(\?|$)/.test(u)) return fetch(u);
    const res = await fetch(u.replace(/\.json(\?|$)/, '.bin$1'));
    if (!res.ok) return res;
    const text = await decrypt(key, await res.arrayBuffer());
    return new Response(text, { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
}

function lockScreen(lock) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'lock-screen';
    wrap.innerHTML = `
      <form class="lock-card" autocomplete="off">
        <div class="lock-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg></div>
        <h1>Deutsch Detektiv</h1>
        <p>Bitte Passwort eingeben.</p>
        <input type="password" name="pw" class="answer" placeholder="Passwort" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="Passwort">
        <button type="submit" class="btn btn-primary btn-lg">Entsperren</button>
        <p class="lock-err" role="alert" hidden>Falsches Passwort.</p>
      </form>`;
    const style = document.createElement('style');
    style.textContent = `
.lock-screen{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:24px;background:var(--bg,#f2f2f7)}
.lock-card{width:100%;max-width:360px;display:flex;flex-direction:column;gap:12px;text-align:center}
.lock-card h1{margin:4px 0 0;font-size:26px}
.lock-card p{margin:0;color:var(--muted,#6b7280)}
.lock-icon{margin:0 auto;width:64px;height:64px;border-radius:18px;display:grid;place-items:center;background:var(--accent,#2f5bea);color:#fff}
.lock-err{color:var(--bad,#c62828)!important;font-weight:600}
.lock-card.shake{animation:lock-shake .35s}
@keyframes lock-shake{25%{transform:translateX(-8px)}50%{transform:translateX(8px)}75%{transform:translateX(-4px)}}`;
    document.head.append(style);
    document.body.append(wrap);
    const form = wrap.querySelector('form'), input = form.pw, err = wrap.querySelector('.lock-err'), btn = form.querySelector('button');
    setTimeout(() => input.focus(), 50);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!input.value) return;
      btn.disabled = true; btn.textContent = 'Prüfe …'; err.hidden = true;
      const key = await deriveKey(input.value, lock);
      if (await keyWorks(key, lock)) {
        await idb('readwrite', (s) => s.put({ key, salt: lock.salt }, KEY_ID));
        wrap.remove(); style.remove();
        resolve(key);
      } else {
        btn.disabled = false; btn.textContent = 'Entsperren'; err.hidden = false;
        input.select();
        form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
      }
    });
  });
}

/** Returns a decrypting fetch when the site is locked (asks for the password once per device), else undefined. */
export async function unlockIfNeeded() {
  let lock = null;
  try {
    const res = await fetch('content/lock.json');
    if (res.ok) lock = await res.json();
  } catch { lock = null; }
  if (!lock || !lock.salt) return undefined;
  const saved = await idb('readonly', (s) => s.get(KEY_ID));
  let key = saved && saved.salt === lock.salt && saved.key;
  if (!key || !(await keyWorks(key, lock))) key = await lockScreen(lock);
  return decryptingFetch(key);
}

/** Forget the saved key (next start asks for the password again). */
export function forgetKey() { return idb('readwrite', (s) => s.delete(KEY_ID)); }
