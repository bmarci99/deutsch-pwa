// Small built-in word set so every drill works even while content/vocab is missing or partial.
// Merged in only when the content pool for a drill is too small. All forms checked by hand.
const n = (de, g, pl, en, lvl = 'A1', extra = {}) => ({ de, pos: 'noun', g, pl, en, lvl, ...extra });
const a = (de, comp, sup, en, lvl = 'A1') => ({ de, pos: 'adj', comp, sup, en, lvl });

export const FALLBACK_WORDS = [
  n('Tisch', 'm', 'Tische', 'table'), n('Stuhl', 'm', 'Stühle', 'chair'), n('Lampe', 'f', 'Lampen', 'lamp'),
  n('Buch', 'n', 'Bücher', 'book'), n('Auto', 'n', 'Autos', 'car'), n('Hund', 'm', 'Hunde', 'dog'),
  n('Katze', 'f', 'Katzen', 'cat'), n('Haus', 'n', 'Häuser', 'house'), n('Wohnung', 'f', 'Wohnungen', 'flat'),
  n('Zimmer', 'n', 'Zimmer', 'room'), n('Freund', 'm', 'Freunde', 'friend'), n('Freundin', 'f', 'Freundinnen', 'friend (female)'),
  n('Kind', 'n', 'Kinder', 'child'), n('Stadt', 'f', 'Städte', 'city'), n('Zug', 'm', 'Züge', 'train'),
  n('Apfel', 'm', 'Äpfel', 'apple'), n('Fenster', 'n', 'Fenster', 'window'), n('Tür', 'f', 'Türen', 'door'),
  n('Computer', 'm', 'Computer', 'computer'), n('Handy', 'n', 'Handys', 'mobile phone'), n('Tasche', 'f', 'Taschen', 'bag'),
  n('Schlüssel', 'm', 'Schlüssel', 'key'), n('Zeitung', 'f', 'Zeitungen', 'newspaper'), n('Mädchen', 'n', 'Mädchen', 'girl'),
  n('Termin', 'm', 'Termine', 'appointment', 'A2'), n('Rechnung', 'f', 'Rechnungen', 'bill, invoice', 'A2'),
  n('Eltern', 'pl', '-', 'parents'),
  // mass nouns (strong singular: "guter Wein")
  n('Kaffee', 'm', '-', 'coffee', 'A1', { mass: true }), n('Wein', 'm', 'Weine', 'wine', 'A1', { mass: true }),
  n('Wasser', 'n', '-', 'water', 'A1', { mass: true }), n('Brot', 'n', 'Brote', 'bread', 'A1', { mass: true }),
  n('Milch', 'f', '-', 'milk', 'A1', { mass: true }), n('Musik', 'f', '-', 'music', 'A1', { mass: true }),
  // n-Deklination
  n('Kunde', 'm', 'Kunden', 'customer', 'A2', { weak: true, gen: 'Kunden' }), n('Kollege', 'm', 'Kollegen', 'colleague', 'A1', { weak: true, gen: 'Kollegen' }),
  n('Junge', 'm', 'Jungen', 'boy', 'A1', { weak: true, gen: 'Jungen' }), n('Mensch', 'm', 'Menschen', 'human being, person', 'A1', { weak: true, gen: 'Menschen' }),
  n('Student', 'm', 'Studenten', 'student', 'A1', { weak: true, gen: 'Studenten' }), n('Herr', 'm', 'Herren', 'gentleman, Mr', 'A1', { weak: true, gen: 'Herrn' }),
  n('Nachbar', 'm', 'Nachbarn', 'neighbour', 'A1', { weak: true, gen: 'Nachbarn' }), n('Name', 'm', 'Namen', 'name', 'A1', { weak: true, gen: 'Namens' }),
  n('Polizist', 'm', 'Polizisten', 'police officer', 'A2', { weak: true, gen: 'Polizisten' }), n('Patient', 'm', 'Patienten', 'patient', 'A2', { weak: true, gen: 'Patienten' }),
  n('Tourist', 'm', 'Touristen', 'tourist', 'A2', { weak: true, gen: 'Touristen' }), n('Praktikant', 'm', 'Praktikanten', 'intern', 'B1', { weak: true, gen: 'Praktikanten' }),
  n('Experte', 'm', 'Experten', 'expert', 'B1', { weak: true, gen: 'Experten' }), n('Zeuge', 'm', 'Zeugen', 'witness', 'B1', { weak: true, gen: 'Zeugen' }),
  n('Präsident', 'm', 'Präsidenten', 'president', 'B1', { weak: true, gen: 'Präsidenten' }), n('Löwe', 'm', 'Löwen', 'lion', 'A2', { weak: true, gen: 'Löwen' }),
  n('Bär', 'm', 'Bären', 'bear', 'A2', { weak: true, gen: 'Bären' }), n('Gedanke', 'm', 'Gedanken', 'thought', 'B1', { weak: true, gen: 'Gedankens' }),
  n('Franzose', 'm', 'Franzosen', 'Frenchman', 'A2', { weak: true, gen: 'Franzosen' }), n('Architekt', 'm', 'Architekten', 'architect', 'B1', { weak: true, gen: 'Architekten' }),

  a('groß', 'größer', 'am größten', 'big, tall'), a('klein', 'kleiner', 'am kleinsten', 'small'), a('alt', 'älter', 'am ältesten', 'old'),
  a('neu', 'neuer', 'am neuesten', 'new'), a('jung', 'jünger', 'am jüngsten', 'young'), a('gut', 'besser', 'am besten', 'good'),
  a('schön', 'schöner', 'am schönsten', 'beautiful, nice'), a('teuer', 'teurer', 'am teuersten', 'expensive'), a('billig', 'billiger', 'am billigsten', 'cheap'),
  a('hoch', 'höher', 'am höchsten', 'high'), a('lang', 'länger', 'am längsten', 'long'), a('kurz', 'kürzer', 'am kürzesten', 'short'),
  a('warm', 'wärmer', 'am wärmsten', 'warm'), a('kalt', 'kälter', 'am kältesten', 'cold'), a('schnell', 'schneller', 'am schnellsten', 'fast'),
  a('dunkel', 'dunkler', 'am dunkelsten', 'dark', 'A2'), a('nah', 'näher', 'am nächsten', 'near', 'A2'), a('stark', 'stärker', 'am stärksten', 'strong', 'A2'),
  a('heiß', 'heißer', 'am heißesten', 'hot'), a('interessant', 'interessanter', 'am interessantesten', 'interesting'),
  a('wichtig', 'wichtiger', 'am wichtigsten', 'important', 'A2'), a('einfach', 'einfacher', 'am einfachsten', 'easy, simple', 'A2'),
];

/** Verbs with fixed prepositions; ex sentences are chosen so that only `prep` fits the gap. */
export const FALLBACK_VERB_PREPS = [
  ['warten', 'auf + Akk', 'Ich warte auf den Bus.', 'I am waiting for the bus.', 'A2'],
  ['denken', 'an + Akk', 'Ich denke oft an meine Familie.', 'I often think of my family.', 'A2'],
  ['sich freuen', 'auf + Akk', 'Wir freuen uns schon auf das Wochenende.', 'We are already looking forward to the weekend.', 'A2', ['über']],
  ['sich interessieren', 'für + Akk', 'Er interessiert sich für Politik.', 'He is interested in politics.', 'A2'],
  ['sich ärgern', 'über + Akk', 'Sie ärgert sich über den Lärm.', 'She is annoyed about the noise.', 'B1'],
  ['teilnehmen', 'an + Dat', 'Ich nehme an einem Deutschkurs teil.', 'I am taking part in a German course.', 'B1'],
  ['träumen', 'von + Dat', 'Ich träume von einem Haus am Meer.', 'I dream of a house by the sea.', 'B1'],
  ['sich kümmern', 'um + Akk', 'Wer kümmert sich um die Kinder?', 'Who is looking after the children?', 'B1'],
  ['bitten', 'um + Akk', 'Darf ich Sie um einen Gefallen bitten?', 'May I ask you for a favour?', 'B1'],
  ['sich erinnern', 'an + Akk', 'Erinnerst du dich an unseren Urlaub?', 'Do you remember our holiday?', 'B1'],
  ['sich gewöhnen', 'an + Akk', 'Ich habe mich an das Wetter gewöhnt.', 'I have got used to the weather.', 'B1'],
  ['achten', 'auf + Akk', 'Bitte achten Sie auf Ihr Gepäck.', 'Please pay attention to your luggage.', 'B1'],
  ['antworten', 'auf + Akk', 'Er antwortet nicht auf meine E-Mail.', 'He does not answer my e-mail.', 'B1'],
  ['gehören', 'zu + Dat', 'Frankfurt gehört zu Hessen.', 'Frankfurt belongs to Hesse.', 'B1'],
  ['fragen', 'nach + Dat', 'Der Tourist fragt nach dem Weg.', 'The tourist asks for the way.', 'A2'],
  ['sich verabschieden', 'von + Dat', 'Wir verabschieden uns von unseren Gästen.', 'We say goodbye to our guests.', 'B1'],
  ['sich verlassen', 'auf + Akk', 'Auf meine Kollegin kann ich mich verlassen.', 'I can rely on my colleague.', 'B1'],
  ['sich konzentrieren', 'auf + Akk', 'Ich muss mich auf die Prüfung konzentrieren.', 'I have to concentrate on the exam.', 'B1'],
  ['sich beschäftigen', 'mit + Dat', 'Ich beschäftige mich gern mit Geschichte.', 'I like to occupy myself with history.', 'B1'],
  ['aufhören', 'mit + Dat', 'Er hat mit dem Rauchen aufgehört.', 'He has stopped smoking.', 'B1'],
  ['sich fürchten', 'vor + Dat', 'Das Kind fürchtet sich vor dem Hund.', 'The child is afraid of the dog.', 'B1'],
  ['gratulieren', 'zu + Dat', 'Ich gratuliere dir zu deinem Erfolg.', 'I congratulate you on your success.', 'B1'],
  ['riechen', 'nach + Dat', 'Hier riecht es nach frischem Kaffee.', 'It smells of fresh coffee here.', 'B1'],
  ['sich verlieben', 'in + Akk', 'Er hat sich in seine Nachbarin verliebt.', 'He has fallen in love with his neighbour.', 'B1'],
  ['verzichten', 'auf + Akk', 'Ich verzichte heute auf Zucker.', 'I am doing without sugar today.', 'B2'],
  ['sorgen', 'für + Akk', 'Die Eltern sorgen für ihre Kinder.', 'The parents take care of their children.', 'B1'],
  ['zweifeln', 'an + Dat', 'Ich zweifle an seiner Ehrlichkeit.', 'I doubt his honesty.', 'B2'],
  ['abhängen', 'von + Dat', 'Das hängt von deiner Antwort ab.', 'That depends on your answer.', 'B1'],
  ['einladen', 'zu + Dat', 'Wir laden euch zu unserer Hochzeit ein.', 'We are inviting you to our wedding.', 'A2'],
  ['lachen', 'über + Akk', 'Alle lachen über seinen Witz.', 'Everyone laughs at his joke.', 'B1'],
  ['reagieren', 'auf + Akk', 'Wie hat sie auf die Nachricht reagiert?', 'How did she react to the news?', 'B1'],
].map(([de, prep, ex, exEn, lvl, notDistractor]) => ({ de, pos: 'verb', prep, ex, exEn, lvl, en: '', notDistractor: notDistractor || [] }));

/** Minimal verb tables (used only when verbs.json is missing). */
export const FALLBACK_VERBS = [
  { inf: 'machen', en: 'to do, to make', pres: ['mache', 'machst', 'macht', 'machen', 'macht', 'machen'], prt: ['machte', 'machtest', 'machte', 'machten', 'machtet', 'machten'], pp: 'gemacht', aux: 'haben', k2: ['machte', 'machtest', 'machte', 'machten', 'machtet', 'machten'], k1: ['mache', 'machest', 'mache', 'machen', 'machet', 'machen'], imp: ['mach', 'macht', 'machen Sie'], sep: null, refl: null, type: 'weak' },
  { inf: 'fahren', en: 'to drive, to go', pres: ['fahre', 'fährst', 'fährt', 'fahren', 'fahrt', 'fahren'], prt: ['fuhr', 'fuhrst', 'fuhr', 'fuhren', 'fuhrt', 'fuhren'], pp: 'gefahren', aux: 'sein', k2: ['führe', 'führest', 'führe', 'führen', 'führet', 'führen'], k1: ['fahre', 'fahrest', 'fahre', 'fahren', 'fahret', 'fahren'], imp: ['fahr', 'fahrt', 'fahren Sie'], sep: null, refl: null, type: 'strong' },
  { inf: 'gehen', en: 'to go', pres: ['gehe', 'gehst', 'geht', 'gehen', 'geht', 'gehen'], prt: ['ging', 'gingst', 'ging', 'gingen', 'gingt', 'gingen'], pp: 'gegangen', aux: 'sein', k2: ['ginge', 'gingest', 'ginge', 'gingen', 'ginget', 'gingen'], k1: ['gehe', 'gehest', 'gehe', 'gehen', 'gehet', 'gehen'], imp: ['geh', 'geht', 'gehen Sie'], sep: null, refl: null, type: 'strong' },
  { inf: 'sein', en: 'to be', pres: ['bin', 'bist', 'ist', 'sind', 'seid', 'sind'], prt: ['war', 'warst', 'war', 'waren', 'wart', 'waren'], pp: 'gewesen', aux: 'sein', k2: ['wäre', 'wärst', 'wäre', 'wären', 'wärt', 'wären'], k1: ['sei', 'seist', 'sei', 'seien', 'seiet', 'seien'], imp: ['sei', 'seid', 'seien Sie'], sep: null, refl: null, type: 'aux' },
  { inf: 'haben', en: 'to have', pres: ['habe', 'hast', 'hat', 'haben', 'habt', 'haben'], prt: ['hatte', 'hattest', 'hatte', 'hatten', 'hattet', 'hatten'], pp: 'gehabt', aux: 'haben', k2: ['hätte', 'hättest', 'hätte', 'hätten', 'hättet', 'hätten'], k1: ['habe', 'habest', 'habe', 'haben', 'habet', 'haben'], imp: ['hab', 'habt', 'haben Sie'], sep: null, refl: null, type: 'aux' },
  { inf: 'ankommen', en: 'to arrive', pres: ['komme an', 'kommst an', 'kommt an', 'kommen an', 'kommt an', 'kommen an'], prt: ['kam an', 'kamst an', 'kam an', 'kamen an', 'kamt an', 'kamen an'], pp: 'angekommen', aux: 'sein', k2: ['käme an', 'kämest an', 'käme an', 'kämen an', 'kämet an', 'kämen an'], k1: ['komme an', 'kommest an', 'komme an', 'kommen an', 'kommet an', 'kommen an'], imp: ['komm an', 'kommt an', 'kommen Sie an'], sep: 'an', refl: null, type: 'strong' },
];
