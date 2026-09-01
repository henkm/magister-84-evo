import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  bouwDagen, chipVoor, kopDatum, lokaleTijd, platteTekst,
} from '../../extension/src/rooster.js';

const AFSPRAKEN = JSON.parse(
  readFileSync(new URL('../fixtures/afspraken.json', import.meta.url), 'utf8')).Items;

const dagen = (opties = {}) => bouwDagen(AFSPRAKEN,
  { vandaag: '2026-09-01', aantalDagen: 28, ...opties });

test('UTC wordt omgerekend naar Amsterdamse kloktijd', () => {
  // 07:00Z in september is 09:00 in Amsterdam (zomertijd)
  assert.equal(lokaleTijd(new Date('2026-09-01T07:00:00Z')), '09:00');
  // en in januari 07:00Z is 08:00 (wintertijd) — dezelfde code, andere uitkomst
  assert.equal(lokaleTijd(new Date('2026-01-15T07:00:00Z')), '08:00');
});

test('de eerste les van de dag begint om 09:00, niet om 07:00', () => {
  const rijen = dagen()[0][3];
  assert.equal(rijen[0][1], '09:00');
  assert.equal(rijen[0][2], '09:45');
});

test('een dubbeluur wordt een regel met 3-4', () => {
  const les = dagen()[0][3].find((r) => r[4] === 'natuurkunde');
  assert.equal(les[3], '3-4');
  assert.equal(les[1], '10:30');
  assert.equal(les[2], '12:00');
});

test('het gat tussen lesuur 1 en lesuur 3 wordt een tussenuur', () => {
  const rijen = dagen()[0][3];
  assert.equal(rijen[1][0], 'gat');
  assert.equal(rijen[1][1], '09:45');   // eind van de vorige les
  assert.equal(rijen[1][2], '10:30');   // begin van de volgende
  assert.equal(rijen[1][3], '');
});

test('opeenvolgende lesuren geven geen tussenuur', () => {
  const rijen = dagen()[0][3];
  const gaten = rijen.filter((r) => r[0] === 'gat');
  assert.equal(gaten.length, 1, 'alleen tussen uur 1 en uur 3');
});

test('status en chip volgen uit Status en InfoType', () => {
  const rijen = dagen()[0][3];
  const nl = rijen.find((r) => r[4] === 'nederlands');
  assert.equal(nl[7], 'vervallen');
  assert.equal(nl[8], 'VERVALT');
  const en = rijen.find((r) => r[4] === 'engels');
  assert.equal(en[7], 'gewijzigd');
  assert.equal(en[8], 'GEWIJZIGD');   // status wint van huiswerk
  const nat = rijen.find((r) => r[4] === 'natuurkunde');
  assert.equal(nat[8], 'TOETS');
});

test('de chipvolgorde is vast', () => {
  assert.equal(chipVoor('vervallen', 4), 'VERVALT');
  assert.equal(chipVoor('gewijzigd', 4), 'GEWIJZIGD');
  assert.equal(chipVoor('normaal', 4), 'TOETS');
  assert.equal(chipVoor('normaal', 1), 'HW');
  assert.equal(chipVoor('normaal', 0), '');
  assert.equal(chipVoor('normaal', 6), '');
});

test('HTML uit Inhoud wordt platte tekst', () => {
  assert.equal(platteTekst('<p>hoofdstuk 1 tot en met 3 <b>leren</b></p>'),
    'hoofdstuk 1 tot en met 3 leren');
  assert.equal(platteTekst('regel1<br>regel2'), 'regel1 regel2');
  assert.equal(platteTekst('opdracht 3 &amp; 4 maken'), 'opdracht 3 & 4 maken');
  assert.equal(platteTekst(null), '');
  assert.equal(platteTekst('  veel    ruimte  '), 'veel ruimte');
});

test('de docent staat als naam met code', () => {
  assert.equal(dagen()[0][3][0][6], 'Alting (ALT)');
});

test('camelCase-afspraken worden net zo verwerkt als PascalCase', () => {
  const morgen = dagen()[1][3];
  assert.equal(morgen[0][4], 'aardrijkskunde');
  assert.equal(morgen[0][6], 'Smit (SMT)');
});

test('er komen precies zoveel dagen als gevraagd, ook lege', () => {
  const d = dagen();
  assert.equal(d.length, 28);
  assert.equal(d[0][0], '2026-09-01');
  assert.equal(d[27][0], '2026-09-28');
});

test('de dagkop is een Nederlandse weekdag met dag en maand', () => {
  assert.equal(kopDatum(new Date('2026-09-01T12:00:00Z')), 'di 01-09');
  assert.equal(dagen()[0][1], 'di 01-09');
});

test('bijschriften: vandaag, morgen, weekend, vakantie en een telling', () => {
  const d = dagen();
  assert.equal(d[0][2], 'vandaag');
  assert.equal(d[1][2], 'morgen');
  // 5 en 6 september 2026 zijn zaterdag en zondag
  assert.equal(d[4][2], 'weekend');
  assert.equal(d[5][2], 'weekend');
  // 3 september is een donderdag zonder afspraken
  assert.equal(d[2][2], 'vakantie');
});

test('een dag zonder lessen heeft een lege rijenlijst', () => {
  assert.deepEqual(dagen()[4][3], []);
});

test('elke rij heeft precies elf velden en alle velden zijn strings', () => {
  for (const [, , , rijen] of dagen()) {
    for (const r of rijen) {
      assert.equal(r.length, 11);
      for (const v of r) assert.equal(typeof v, 'string');
    }
  }
});

test('de zomer-wintertijdgrens verschuift geen dag', () => {
  // 25 oktober 2026 is de nacht waarin de klok teruggaat
  const d = bouwDagen([], { vandaag: '2026-10-23', aantalDagen: 5 });
  assert.deepEqual(d.map((x) => x[0]),
    ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']);
});
