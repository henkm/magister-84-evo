import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bouwVakken, getal, soortVoor } from '../../extension/src/cijfers.js';

const RIJEN = JSON.parse(
  readFileSync(new URL('../fixtures/cijfers.json', import.meta.url), 'utf8')).Items;

const vak = (naam) => bouwVakken(RIJEN).vakken.find((v) => v[0] === naam);

test('een cijfer met komma wordt een getal, tekst niet', () => {
  assert.equal(getal('6,8'), 6.8);
  assert.equal(getal('5'), 5);
  assert.equal(getal('10,0'), 10);
  assert.equal(getal('vr'), null);
  assert.equal(getal('g'), null);
  assert.equal(getal(''), null);
  assert.equal(getal(null), null);
});

test('tien is niet onvoldoende: er wordt numeriek vergeleken, niet als tekst', () => {
  assert.equal(soortVoor({ cijfer: '10,0', voldoende: true }), 'normaal');
  assert.equal(soortVoor({ cijfer: '5,4', voldoende: false }), 'onvoldoende');
  assert.equal(soortVoor({ cijfer: 'vr', voldoende: true }), 'tekst');
  assert.equal(soortVoor({ cijfer: '', voldoende: null }), 'tekst');
});

test('het oordeel van Magister zelf gaat voor de eigen grens van 5,5', () => {
  // 5,4 dat Magister voldoende noemt (andere schoolnorm) blijft normaal
  assert.equal(soortVoor({ cijfer: '5,4', voldoende: true }), 'normaal');
  // en zonder oordeel valt hij terug op de grens
  assert.equal(soortVoor({ cijfer: '5,4', voldoende: undefined }), 'onvoldoende');
});

test('berekende kolommen worden het gemiddelde, niet een cijferrij', () => {
  const w = vak('wiskunde B');
  assert.equal(w[1], '7,2');
  assert.deepEqual(w[2].map((r) => r[0]), ['SO hoofdstuk 1', 'Proefwerk H1-H2']);
});

test('een vak zonder berekende kolom heeft een leeg gemiddelde', () => {
  assert.equal(vak('lichamelijke opvoeding')[1], '');
});

test('de metaregel noemt datum, periode en of het meetelt', () => {
  assert.equal(vak('wiskunde B')[2][0][2], '12-06 · P1 · telt mee');
  assert.equal(vak('lichamelijke opvoeding')[2][0][2], '01-06 · P1 · vrijstelling');
  assert.equal(vak('lichamelijke opvoeding')[2][1][2], '02-06 · P1 · inhalen');
});

test('cijfers staan op chronologische volgorde, oudste eerst', () => {
  assert.deepEqual(vak('wiskunde B')[2].map((r) => r[1]), ['6,8', '7,6']);
});

test('vakken staan op alfabetische volgorde', () => {
  assert.deepEqual(bouwVakken(RIJEN).vakken.map((v) => v[0]),
    ['geschiedenis', 'lichamelijke opvoeding', 'natuurkunde', 'wiskunde B']);
});

test('camelCase-rijen worden net zo verwerkt', () => {
  const g = vak('geschiedenis');
  assert.equal(g[2][0][1], '10,0');
  assert.equal(g[2][0][3], 'normaal');
});

test('de periode is de verzameling periodes van de gewone cijfers', () => {
  assert.equal(bouwVakken(RIJEN).periode, 'P1 · P2');
});

test('geen cijfers is een geldige uitkomst, geen fout', () => {
  assert.deepEqual(bouwVakken([]), { vakken: [], periode: '' });
});

test('elke cijferrij heeft vier velden, allemaal strings', () => {
  for (const [, , rijen] of bouwVakken(RIJEN).vakken) {
    for (const r of rijen) {
      assert.equal(r.length, 4);
      for (const v of r) assert.equal(typeof v, 'string');
    }
  }
});
