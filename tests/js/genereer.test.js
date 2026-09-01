import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MAX_BRON, bouwModel, genereerMagdata, pyRij, pyStr, veiligeTekst,
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
