import test from 'node:test';
import assert from 'node:assert/strict';
import { BEGIN, FOUTEN, cijfersBijschrift, foutknop, gereedSlot, percentage,
  volgende } from '../../extension/src/stroom.js';

const na = (...gebeurtenissen) =>
  gebeurtenissen.reduce((t, g) => volgende(t, g), BEGIN);

const KINDEREN = [{ id: 1, naam: 'Fenna' }, { id: 2, naam: 'Sem' }];

test('zonder gekozen kind begint de extensie bij kind kiezen', () => {
  const t = na({ type: 'start', kinderen: KINDEREN, kind: null });
  assert.equal(t.scherm, 'kind-kiezen');
  assert.deepEqual(t.kinderen, KINDEREN);
});

test('met een onthouden kind begint hij bij klaar om te syncen', () => {
  const t = na({ type: 'start', kinderen: KINDEREN, kind: KINDEREN[0],
    laatsteSync: 'vandaag 07:41' });
  assert.equal(t.scherm, 'klaar');
  assert.equal(t.kind.naam, 'Fenna');
  assert.equal(t.laatsteSync, 'vandaag 07:41');
});

test('een kind kiezen leidt naar klaar, ander kind weer terug', () => {
  const gekozen = na({ type: 'start', kinderen: KINDEREN, kind: null },
    { type: 'kies', kind: KINDEREN[1] });
  assert.equal(gekozen.scherm, 'klaar');
  assert.equal(gekozen.kind.naam, 'Sem');
  assert.equal(volgende(gekozen, { type: 'anderKind' }).scherm, 'kind-kiezen');
});

test('zonder poort komt het koppelscherm, daarna weer klaar', () => {
  const t = na({ type: 'start', kinderen: KINDEREN, kind: KINDEREN[0] },
    { type: 'geenPoort' });
  assert.equal(t.scherm, 'koppelen');
  assert.equal(t.poortBekend, false);
  const na_keuze = volgende(t, { type: 'poort' });
  assert.equal(na_keuze.scherm, 'klaar');
  assert.equal(na_keuze.poortBekend, true);
});

test('een al bekende poort wordt bij de start meegegeven', () => {
  const t = na({ type: 'start', kinderen: KINDEREN, kind: KINDEREN[0],
    poortBekend: true });
  assert.equal(t.poortBekend, true);
});

test('een sync doorloopt drie fasen en houdt de feiten bij', () => {
  let t = na({ type: 'start', kinderen: KINDEREN, kind: KINDEREN[0] },
    { type: 'sync' });
  assert.equal(t.scherm, 'bezig');
  assert.equal(t.fase, 'ophalen');

  t = volgende(t, { type: 'fase', fase: 'genereren',
    feiten: { lessen: 42, cijfers: 41 } });
  assert.equal(t.fase, 'genereren');
  assert.equal(t.feiten.lessen, 42);

  t = volgende(t, { type: 'fase', fase: 'versturen', feiten: { bytes: 21400 } });
  t = volgende(t, { type: 'voortgang', gedaan: 10700, totaal: 21400 });
  assert.equal(percentage(t), 50);
});

test('alleen de derde fase heeft een echte voortgang', () => {
  let t = na({ type: 'start', kinderen: KINDEREN, kind: KINDEREN[0] },
    { type: 'sync' });
  assert.equal(percentage(t), null, 'ophalen is onbepaald, geen nepvoortgang');
  t = volgende(t, { type: 'fase', fase: 'genereren' });
  assert.equal(percentage(t), null);
  t = volgende(t, { type: 'fase', fase: 'versturen' });
  t = volgende(t, { type: 'voortgang', gedaan: 0, totaal: 100 });
  assert.equal(percentage(t), 0);
});

test('een voortgang die toch al gezet is, telt niet mee tijdens ophalen of genereren', () => {
  let t = na({ type: 'start', kinderen: KINDEREN, kind: KINDEREN[0] },
    { type: 'sync' });
  t = volgende(t, { type: 'voortgang', gedaan: 5, totaal: 10 });
  assert.equal(t.fase, 'ophalen');
  assert.equal(percentage(t), null, 'ophalen blijft onbepaald, ook met een gezette voortgang');

  t = volgende(t, { type: 'fase', fase: 'genereren' });
  t = volgende(t, { type: 'voortgang', gedaan: 7, totaal: 10 });
  assert.equal(t.fase, 'genereren');
  assert.equal(percentage(t), null, 'genereren blijft onbepaald, ook met een gezette voortgang');
});

test('feiten uit een eerdere fase blijven staan als een latere fase nieuwe feiten meegeeft', () => {
  let t = na({ type: 'start', kinderen: KINDEREN, kind: KINDEREN[0] },
    { type: 'sync' },
    { type: 'fase', fase: 'genereren', feiten: { lessen: 42, cijfers: 41 } });
  t = volgende(t, { type: 'fase', fase: 'versturen', feiten: { bytes: 21400 } });
  assert.equal(t.fase, 'versturen');
  assert.equal(t.feiten.lessen, 42, 'lessen uit genereren moet blijven staan');
  assert.equal(t.feiten.cijfers, 41, 'cijfers uit genereren moet blijven staan');
  assert.equal(t.feiten.bytes, 21400, 'nieuwe feiten uit versturen komen erbij');
});

test('een geslaagde sync eindigt op gereed met de cijfers erbij', () => {
  const t = na({ type: 'start', kinderen: KINDEREN, kind: KINDEREN[0] },
    { type: 'sync' },
    { type: 'gereed', resultaat: { tijd: '09:12', seconden: 3.4,
      lessen: 42, cijfers: 41, tot: 'vr 11-09', periode: 'P1 · P2' } });
  assert.equal(t.scherm, 'gereed');
  assert.equal(t.resultaat.lessen, 42);
  assert.equal(t.kind.naam, 'Fenna', 'het kind blijft zichtbaar');
});

// Elke body moet zeggen wat er met de data op de rekenmachine is gebeurd:
// niets verstuurd, wel opgehaald maar niet verstuurd, of deels/mogelijk oude
// data. Dit zijn de vaste formuleringen die dat afdekken.
const DATA_SITUATIE_FRASES = [
  'niets naar de rekenmachine gestuurd',
  'rekenmachine staat',
  'staat klaar',
];

test('elke fout die de andere modules kunnen geven heeft een scherm', () => {
  // deze soorten komen uit magister.js, transport.js en send.js
  for (const soort of ['niet-ingelogd', 'sessie-verlopen', 'geen-toegang',
    'geen-aanmelding', 'magister-fout', 'netwerkfout', 'geen-rekenmachine',
    'verbinding-afgebroken', 'te-groot', 'onbekend']) {
    assert.ok(FOUTEN[soort], `geen tekst voor "${soort}"`);
    const f = FOUTEN[soort];
    for (const veld of ['titel', 'kop', 'body', 'stap', 'knop']) {
      assert.ok(f[veld] && f[veld].length > 0, `${soort} mist ${veld}`);
    }
    assert.ok(
      DATA_SITUATIE_FRASES.some((frase) => f.body.includes(frase)),
      `${soort}: body zegt niet wat er met de data op de rekenmachine is`,
    );
  }
});

test('een onbekende foutsoort valt terug op het algemene scherm', () => {
  const t = volgende(BEGIN, { type: 'fout', soort: 'iets-nieuws' });
  assert.equal(t.scherm, 'fout');
  assert.equal(t.fout.soort, 'onbekend');
});

test('een afgebroken verbinding bewaart hoever hij kwam', () => {
  let t = na({ type: 'start', kinderen: KINDEREN, kind: KINDEREN[0] },
    { type: 'sync' }, { type: 'fase', fase: 'versturen' },
    { type: 'voortgang', gedaan: 11800, totaal: 21400 });
  t = volgende(t, { type: 'fout', soort: 'verbinding-afgebroken' });
  assert.equal(t.scherm, 'fout');
  assert.equal(t.voortgang.gedaan, 11800);
  assert.equal(percentage(t), 55);
});

test('opnieuw proberen gaat terug naar klaar en wist de fout', () => {
  const t = volgende(volgende(BEGIN, { type: 'fout', soort: 'sessie-verlopen' }),
    { type: 'opnieuw' });
  assert.equal(t.scherm, 'klaar');
  assert.equal(t.fout, null);
});

test('de toestand wordt nooit ter plekke aangepast', () => {
  const begin = na({ type: 'start', kinderen: KINDEREN, kind: KINDEREN[0] });
  const kopie = JSON.parse(JSON.stringify(begin));
  volgende(begin, { type: 'sync' });
  assert.deepEqual(JSON.parse(JSON.stringify(begin)), kopie);
});

test('geen enkele fouttekst noemt een token of een sleutel', () => {
  for (const f of Object.values(FOUTEN)) {
    const alles = [f.titel, f.kop, f.body, f.stap, f.knop].join(' ').toLowerCase();
    for (const woord of ['token', 'bearer', 'access_token', 'oidc']) {
      assert.ok(!alles.includes(woord), `"${woord}" hoort niet in een fouttekst`);
    }
  }
});

// --- de knop op het foutscherm ---------------------------------------------
//
// Een foutscherm zonder werkende knop is een doodlopende weg: het paneel leeft
// in een eigen venster, en op het pictogram klikken zet dat venster alleen maar
// op de voorgrond. De knop moet dus opnieuw doen wat er misging.

test('een fout tijdens de start laat de knop de start opnieuw doen', () => {
  for (const soort of ['sessie-verlopen', 'netwerkfout', 'geen-toegang',
    'magister-fout', 'onbekend']) {
    const t = volgende(BEGIN, { type: 'fout', soort, bron: 'start' });
    assert.equal(foutknop(t).actie, 'herstart', soort);
    assert.equal(foutknop(t).tekst, FOUTEN[soort].knop, soort);
  }
});

test('dezelfde fout tijdens een sync laat de knop de sync opnieuw doen', () => {
  for (const soort of ['sessie-verlopen', 'netwerkfout', 'magister-fout',
    'verbinding-afgebroken', 'onbekend']) {
    const t = volgende(BEGIN, { type: 'fout', soort, bron: 'sync' });
    assert.equal(foutknop(t).actie, 'sync', soort);
  }
});

test('niet-ingelogd opent Magister en biedt daarna een weg terug', () => {
  const t = volgende(BEGIN, { type: 'fout', soort: 'niet-ingelogd',
    bron: 'start' });
  assert.equal(foutknop(t).actie, 'magister');
  assert.equal(foutknop(t).tekst, 'Magister openen');
  // na het openen van de tab moet de gebruiker terug kunnen komen
  const na_tab = volgende(t, { type: 'fout', soort: 'niet-ingelogd',
    bron: 'start', geopend: true });
  assert.equal(foutknop(na_tab).actie, 'herstart');
  assert.match(foutknop(na_tab).tekst, /opnieuw/i);
});

test('een fout met een eigen uitweg houdt die uitweg', () => {
  const acties = { 'geen-rekenmachine': 'poort', 'geen-aanmelding': 'anderKind',
    'te-groot': 'sluiten' };
  for (const [soort, actie] of Object.entries(acties)) {
    const t = volgende(BEGIN, { type: 'fout', soort, bron: 'sync' });
    assert.equal(foutknop(t).actie, actie, soort);
    assert.equal(foutknop(t).tekst, FOUTEN[soort].knop, soort);
  }
});

test('de rekenmachinefout vertelt ook over het beginscherm', () => {
  // dit is de enige aanwijzing die een niet-antwoordend apparaat oplost
  assert.match(FOUTEN['geen-rekenmachine'].stap, /beginscherm/);
});

// --- de tekst op het gereedscherm ------------------------------------------

test('nul cijfers levert geen bungelend scheidingsteken op', () => {
  const bij = cijfersBijschrift({ cijfers: 0, periode: '' });
  assert.equal(bij.endsWith('·'), false, `"${bij}" eindigt op een scheiding`);
  assert.match(bij, /cijfers/);
  assert.equal(cijfersBijschrift({ cijfers: 41, periode: 'P1 · P2' }),
    'cijfers · P1 · P2');
  assert.equal(cijfersBijschrift({ cijfers: 3, periode: '' }).endsWith('·'),
    false);
});

test('een ingekort rooster staat op het gereedscherm', () => {
  const heel = gereedSlot({ tijd: '09:12', dagen: 28, gevraagd: 28 });
  assert.equal(/ingekort/.test(heel), false);
  assert.match(heel, /gesynct 09:12/);
  const kort = gereedSlot({ tijd: '09:12', dagen: 19, gevraagd: 28 });
  assert.match(kort, /19 dagen/);
  assert.match(kort, /ingekort|past/);
});
