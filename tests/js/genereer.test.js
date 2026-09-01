import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MAX_BRON, MAX_HUISWERK, bouwModel, genereerMagdata, kortHuiswerk,
  passendeMagdata, pyRij, pyStr, veiligeTekst,
} from '../../extension/src/genereer.js';

const fixture = (naam) => JSON.parse(
  readFileSync(new URL(`../fixtures/${naam}.json`, import.meta.url), 'utf8')).Items;

const model = () => bouwModel({
  afspraken: fixture('afspraken'),
  cijferrijen: fixture('cijfers'),
  leerling: 'Fenna',
  nu: new Date('2026-09-01T07:12:00Z'),
});

test('tekens die het schermlettertype niet kent worden vervangen', () => {
  assert.equal(veiligeTekst('café'), 'cafe');
  assert.equal(veiligeTekst('Müller'), 'Muller');
  assert.equal(veiligeTekst('groß'), 'gross');
  assert.equal(veiligeTekst('a’b'), "a'b");
  assert.equal(veiligeTekst('a–b'), 'a-b');
  assert.equal(veiligeTekst('wisB · 118'), 'wisB · 118');   // het middenpunt blijft
  assert.equal(veiligeTekst('emoji \u{1F600} weg'), 'emoji weg');
  assert.equal(veiligeTekst('regel1\nregel2'), 'regel1 regel2');
  assert.equal(veiligeTekst(null), '');
});

test('python-strings worden veilig aangehaald', () => {
  assert.equal(pyStr('gewoon'), '"gewoon"');
  assert.equal(pyStr('met "quote"'), '"met \\"quote\\""');
  assert.equal(pyStr('back\\slash'), '"back\\\\slash"');
  assert.equal(pyStr(''), '""');
});

test('een rij wordt een python-tuple', () => {
  assert.equal(pyRij(['les', '09:00']), '("les", "09:00")');
});

test('de gegenereerde tekst bevat alle namen uit het datacontract', () => {
  const bron = genereerMagdata(model());
  for (const naam of ['GESYNCT', 'GESYNCT_UREN', 'LEERLING', 'PERIODE',
    'DAGEN', 'VAKKEN']) {
    assert.match(bron, new RegExp(`^${naam} = |^${naam} = \\[`, 'm'), naam);
  }
  assert.match(bron, /GESYNCT = "gesynct 09:12"/);
  assert.match(bron, /GESYNCT_UREN = 0/);
  assert.match(bron, /LEERLING = "Fenna"/);
});

test('een te groot bestand wordt geweigerd, niet afgekapt', () => {
  const groot = model();
  groot.dagen = Array.from({ length: 4000 }, () => (
    ['2026-09-01', 'di 01-09', 'vandaag',
      [['les', '09:00', '09:45', '1', 'wiskunde B', '118', 'Alting (ALT)',
        'normaal', '', '', '']]]));
  assert.throws(() => genereerMagdata(groot), /65535/);
});

test('vier weken rooster en alle cijfers passen ruim', () => {
  const bron = genereerMagdata(model());
  assert.ok(new TextEncoder().encode(bron).length < MAX_BRON / 2,
    'de echte last moet ver onder de helft van het maximum blijven');
});

test('bouwModel zet vier weken klaar en begint vandaag', () => {
  const m = model();
  assert.equal(m.dagen.length, 28);
  assert.equal(m.dagen[0][0], '2026-09-01');
  assert.equal(m.tijd, '09:12');
  assert.equal(m.periode, 'P1 · P2');
});

// --- huiswerk dat het detailscherm kan tonen -------------------------------
//
// Het lesdetail wrapt op 307 px met een letterbreedte van 10 px: dertig tekens
// per regel. Meer dan acht regels is op een scherm van 209 px geen tekst meer
// maar een archief, en elk teken kost ruimte in MAGDATA.

test('lang huiswerk wordt afgekapt met zichtbare puntjes', () => {
  const lang = ('woord '.repeat(90)).trim();
  const kort = kortHuiswerk(lang);
  assert.ok(kort.length <= MAX_HUISWERK, `${kort.length} tekens`);
  assert.ok(kort.endsWith('...'), 'de gebruiker moet zien dat er meer was');
  assert.ok(kort.startsWith('woord woord'), 'het begin blijft staan');
  assert.equal(kortHuiswerk('kort huiswerk'), 'kort huiswerk');
  assert.equal(kortHuiswerk(''), '');
});

test('huiswerk zonder spaties wordt hard afgekapt', () => {
  const kort = kortHuiswerk('x'.repeat(600));
  assert.ok(kort.length <= MAX_HUISWERK);
  assert.ok(kort.endsWith('...'));
});

test('bouwModel kapt het huiswerk van een les af', () => {
  const m = bouwModel({
    afspraken: [{ Id: 1, Start: '2026-09-01T07:00:00Z',
      Einde: '2026-09-01T07:45:00Z', LesuurVan: 1, LesuurTotMet: 1,
      Vakken: [{ Naam: 'natuurkunde' }], InfoType: 1,
      Inhoud: '<p>' + ('woord '.repeat(90)).trim() + '</p>' }],
    cijferrijen: [], leerling: 'Fenna', nu: new Date('2026-09-01T07:12:00Z'),
  });
  const tekst = m.dagen[0][3][0][9];
  assert.ok(tekst.length <= MAX_HUISWERK, `${tekst.length} tekens`);
  assert.ok(tekst.endsWith('...'));
});

// --- MAGDATA dat past ------------------------------------------------------

// Een drukke leerling: acht lesuren per schooldag, vier weken, en overal
// huiswerk zoals Magister het echt geeft. Ongekapt is dat 80465 bytes.
function drukkeAfspraken({ lessen = 8, tekens = 400, dagen = 28 } = {}) {
  const uit = [];
  for (let d = 0; d < dagen; d++) {
    const dag = new Date(Date.UTC(2026, 8, 1 + d, 12));
    if (dag.getUTCDay() === 0 || dag.getUTCDay() === 6) continue;
    const iso = dag.toISOString().slice(0, 10);
    for (let u = 1; u <= lessen; u++) {
      uit.push({
        Id: d * 100 + u,
        Start: `${iso}T${String(6 + u).padStart(2, '0')}:00:00Z`,
        Einde: `${iso}T${String(6 + u).padStart(2, '0')}:45:00Z`,
        LesuurVan: u, LesuurTotMet: u,
        Vakken: [{ Naam: 'natuurkunde' }],
        Lokalen: [{ Naam: '118' }],
        Docenten: [{ Naam: 'Alting', Docentcode: 'ALT' }],
        InfoType: 1,
        Inhoud: '<p>' + ('opgave '.repeat(Math.ceil(tekens / 7)))
          .slice(0, tekens).trim() + '</p>',
      });
    }
  }
  return uit;
}

const drukModel = (opties) => bouwModel({
  afspraken: drukkeAfspraken(opties), cijferrijen: fixture('cijfers'),
  leerling: 'Fenna', nu: new Date('2026-09-01T07:12:00Z'),
});

test('acht lesuren per dag met lang huiswerk passen alsnog', () => {
  const { bron, dagen } = passendeMagdata(drukModel());
  assert.equal(dagen, 28, 'er hoeft geen dag af als het huiswerk gekapt is');
  assert.ok(new TextEncoder().encode(bron).length <= MAX_BRON);
});

test('past het niet, dan gaan er hele dagen van achteren af', () => {
  const m = drukModel({ lessen: 14 });
  const { bron, dagen } = passendeMagdata(m);
  assert.ok(dagen < 28, 'er had ingekort moeten worden');
  assert.ok(dagen > 0);
  assert.ok(new TextEncoder().encode(bron).length <= MAX_BRON);
  // vandaag is wat telt: de laatste week sneuvelt, niet de eerste dag
  assert.match(bron, /"2026-09-01", "di 01-09", "vandaag"/);
  assert.equal(bron.includes(m.dagen[dagen][0]), false,
    'de weggelaten dag hoort er echt niet meer in te staan');
});

test('past zelfs een enkele dag niet, dan is het alsnog een fout', () => {
  const m = drukModel({ lessen: 8 });
  m.dagen = [[m.dagen[0][0], m.dagen[0][1], 'vandaag',
    Array.from({ length: 400 }, () => (
      ['les', '09:00', '09:45', '1', 'natuurkunde', '118', 'Alting (ALT)',
        'normaal', 'HW', 'x'.repeat(200), '']))]];
  assert.throws(() => passendeMagdata(m), /65535/);
});
