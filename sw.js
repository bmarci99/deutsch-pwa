// Service worker (generated into dist/sw.js by tools/build.mjs — do not edit dist/sw.js).
// Cache-first, versioned. A new version installs in the background and waits; the page asks it to
// take over with postMessage({type: 'SKIP_WAITING'}) (or the string 'skipWaiting').
const VERSION = "f0b73fce05";
const CACHE = `dd-${VERSION}`;
const PRECACHE = [
 "./",
 "./content/bundle.bin",
 "./content/lock.json",
 "./content/topics/a1-accusative-prepositions.bin",
 "./content/topics/a1-accusative.bin",
 "./content/topics/a1-articles-gender.bin",
 "./content/topics/a1-imperative.bin",
 "./content/topics/a1-modal-verbs.bin",
 "./content/topics/a1-negation.bin",
 "./content/topics/a1-plural.bin",
 "./content/topics/a1-possessives.bin",
 "./content/topics/a1-present-regular.bin",
 "./content/topics/a1-present-stem-change.bin",
 "./content/topics/a1-pronouns-accusative.bin",
 "./content/topics/a1-pronouns-sein-haben.bin",
 "./content/topics/a1-questions.bin",
 "./content/topics/a1-separable-verbs.bin",
 "./content/topics/a1-time-expressions.bin",
 "./content/topics/a1-word-order-v2.bin",
 "./content/topics/a2-adjective-endings-definite.bin",
 "./content/topics/a2-adjective-endings-indefinite.bin",
 "./content/topics/a2-comparison.bin",
 "./content/topics/a2-coordinating-conjunctions.bin",
 "./content/topics/a2-dative-prepositions.bin",
 "./content/topics/a2-dative-verbs-pronouns.bin",
 "./content/topics/a2-dative.bin",
 "./content/topics/a2-futur-i.bin",
 "./content/topics/a2-indefinite-pronouns.bin",
 "./content/topics/a2-konjunktiv-ii-polite.bin",
 "./content/topics/a2-object-order.bin",
 "./content/topics/a2-partizip-ii.bin",
 "./content/topics/a2-perfekt.bin",
 "./content/topics/a2-positional-verbs.bin",
 "./content/topics/a2-praeteritum-basic.bin",
 "./content/topics/a2-reflexive-verbs.bin",
 "./content/topics/a2-subordinate-clauses.bin",
 "./content/topics/a2-two-way-prepositions.bin",
 "./content/topics/b1-adjectival-nouns.bin",
 "./content/topics/b1-adjective-endings-zero.bin",
 "./content/topics/b1-da-wo-compounds.bin",
 "./content/topics/b1-genitive.bin",
 "./content/topics/b1-indirect-questions.bin",
 "./content/topics/b1-infinitive-zu.bin",
 "./content/topics/b1-konjunktiv-ii-past.bin",
 "./content/topics/b1-konjunktiv-ii.bin",
 "./content/topics/b1-lassen.bin",
 "./content/topics/b1-middle-field-order.bin",
 "./content/topics/b1-n-declension.bin",
 "./content/topics/b1-passive-perfect-modal.bin",
 "./content/topics/b1-passive.bin",
 "./content/topics/b1-plusquamperfekt.bin",
 "./content/topics/b1-praeteritum.bin",
 "./content/topics/b1-relative-clauses-prep-genitive.bin",
 "./content/topics/b1-relative-clauses.bin",
 "./content/topics/b1-temporal-clauses.bin",
 "./content/topics/b1-two-part-conjunctions.bin",
 "./content/topics/b1-verbs-with-prepositions.bin",
 "./content/topics/b2-adjectives-with-prepositions.bin",
 "./content/topics/b2-als-ob.bin",
 "./content/topics/b2-concessive-consecutive.bin",
 "./content/topics/b2-es-correlate.bin",
 "./content/topics/b2-extended-attributes.bin",
 "./content/topics/b2-futur-ii.bin",
 "./content/topics/b2-genitive-prepositions-advanced.bin",
 "./content/topics/b2-konjunktiv-i.bin",
 "./content/topics/b2-modal-instrumental-clauses.bin",
 "./content/topics/b2-modal-perfect-double-infinitive.bin",
 "./content/topics/b2-nomen-verb-verbindungen.bin",
 "./content/topics/b2-nominalisation.bin",
 "./content/topics/b2-participles-attributive.bin",
 "./content/topics/b2-particles.bin",
 "./content/topics/b2-passive-alternatives.bin",
 "./content/topics/b2-relative-advanced.bin",
 "./content/topics/b2-subjective-modals.bin",
 "./content/topics/b2-word-formation.bin",
 "./content/topics/b2-zustandspassiv.bin",
 "./css/app.css",
 "./icons/apple-touch-icon.png",
 "./icons/favicon-32.png",
 "./icons/icon-180.png",
 "./icons/icon-192.png",
 "./icons/icon-512.png",
 "./icons/maskable-512.png",
 "./index.html",
 "./js/cast.js",
 "./js/checker.js",
 "./js/content.js",
 "./js/drills/adj-endings.js",
 "./js/drills/case-articles.js",
 "./js/drills/comparison.js",
 "./js/drills/conjugation.js",
 "./js/drills/fallback.js",
 "./js/drills/gender.js",
 "./js/drills/index.js",
 "./js/drills/perfekt.js",
 "./js/drills/plural.js",
 "./js/drills/prep-case.js",
 "./js/drills/util.js",
 "./js/drills/verb-prep.js",
 "./js/drills/verbforms.js",
 "./js/drills/vocab.js",
 "./js/drills/weak-nouns.js",
 "./js/exercises/choice.js",
 "./js/exercises/dictation.js",
 "./js/exercises/error.js",
 "./js/exercises/gap.js",
 "./js/exercises/index.js",
 "./js/exercises/match.js",
 "./js/exercises/order.js",
 "./js/exercises/sentence.js",
 "./js/exercises/table.js",
 "./js/exercises/transform.js",
 "./js/exercises/translate.js",
 "./js/german.js",
 "./js/lock.js",
 "./js/main.js",
 "./js/progress.js",
 "./js/router.js",
 "./js/screens/_stub.js",
 "./js/screens/exam.js",
 "./js/screens/home.js",
 "./js/screens/more.js",
 "./js/screens/path.js",
 "./js/screens/practice.js",
 "./js/screens/reference.js",
 "./js/screens/review.js",
 "./js/screens/session.js",
 "./js/screens/settings.js",
 "./js/screens/stats.js",
 "./js/screens/topic.js",
 "./js/screens/vocab.js",
 "./js/sources.js",
 "./js/srs.js",
 "./js/store.js",
 "./js/tts.js",
 "./js/ui.js",
 "./manifest.webmanifest"
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE.map((p) => new Request(p, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('dd-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const d = event.data;
  if (d === 'skipWaiting' || (d && d.type === 'SKIP_WAITING')) self.skipWaiting();
  if (d && d.type === 'GET_VERSION' && event.source) event.source.postMessage({ type: 'VERSION', version: VERSION });
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const shell = await cache.match('./index.html') || await cache.match('./');
      if (shell) return shell;
    }
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch (e) {
      if (req.mode === 'navigate') { const shell = await cache.match('./index.html'); if (shell) return shell; }
      throw e;
    }
  })());
});
