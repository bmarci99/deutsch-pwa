// Comparative and superlative: groß – größer – am größten.
import { umlautLast } from '../german.js';
import { wordPool, choiceOptions } from './util.js';

function why(w) {
  const base = w.de, comp = w.comp, sup = w.sup;
  let s = `**${base} – ${comp} – ${sup}**.`;
  if (comp !== base + 'er' && comp.startsWith(umlautLast(base).slice(0, -1)) && /[äöü]/.test(comp) && !/[äöü]/.test(base)) s += ' Many short adjectives with a, o, u take an **umlaut** (alt → älter, groß → größer).';
  if (/esten$/.test(sup)) s += ' After -d, -t, -s, -ß, -z, -sch the superlative adds **-esten** (am ältesten, am kürzesten).';
  if (/^(gut|viel|hoch|nah|gern)$/.test(base)) s += ' Irregular — learn by heart.';
  if (/^(dunkel|teuer|sauer|edel)$/.test(base)) s += ' Adjectives in -el/-euer drop the **e** in the comparative (dunkler, teurer).';
  return s;
}

export default {
  id: 'comparison', title: 'Komparativ & Superlativ', en: 'Comparison of adjectives', detektiv: 'Fall: Größer, schneller, verdächtiger', level: 'A2',
  topics: ['a2-comparison'],
  items(ctx) {
    const out = [];
    for (const w of wordPool(ctx, 'adj', (w) => w.comp && w.sup && /^am /.test(w.sup))) {
      const level = w.lvl < 'A2' ? 'A2' : w.lvl;
      out.push({ key: `${w.de}|comp`, level, w, form: 'comp' }, { key: `${w.de}|sup`, level, w, form: 'sup' });
    }
    return out;
  },
  make({ w, form }, ctx, rng) {
    const u = umlautLast(w.de);
    const supStem = w.sup.replace(/^am /, '');
    const en = w.en.split(',')[0].trim();
    if (form === 'comp') {
      if (rng.chance(0.4)) {
        const d = [w.de + 'er', u + 'er', `mehr ${w.de}`, w.de.replace(/e([lr])$/, '$1') + 'er'];
        return { type: 'choice', q: `${w.de} → ___ (Komparativ)`, ...choiceOptions(w.comp, d, rng, 4), en: `${en} → comparative`, why: why(w), d: 1 };
      }
      return { type: 'gap', q: `${w.de} – ___ – ${w.sup}`, answers: [[w.comp]], hint: '(Komparativ)', en: `${en} – comparative – superlative`, why: why(w), d: 2 };
    }
    if (rng.chance(0.4)) {
      const d = [`am ${w.de}sten`, `am ${w.de}esten`, `am ${u}sten`, `am ${u}esten`];
      return { type: 'choice', q: `${w.de} → ___ (Superlativ)`, ...choiceOptions(w.sup, d, rng, 4), en: `${en} → superlative`, why: why(w), d: 2 };
    }
    return { type: 'gap', q: `${w.de} – ${w.comp} – am ___`, answers: [[supStem]], hint: '(Superlativ)', en: `${en} – comparative – superlative`, why: why(w), d: 2 };
  },
};
