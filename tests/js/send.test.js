import test from 'node:test';
import assert from 'node:assert/strict';
import { encodePacket, parsePacket } from '../../extension/src/kermit.js';
import { bouwPayload } from '../../extension/src/payload.js';
import { CHUNK, bereidVoor, stuurPython, stuurAlles } from '../../extension/src/send.js';

const TEKST = new TextDecoder();

class NepTransport {
  /** antwoord(i, pakket) geeft het antwoordpakket op het i-de geschreven pakket. */
  constructor(antwoord) {
    this.geschreven = [];
    this.antwoord = antwoord || (() => encodePacket(0, 'Y'));
    this.gesloten = false;
  }
  async schrijf(bytes) {
    this.geschreven.push(parsePacket(bytes));
    this.laatsteRuwe = bytes;
  }
  async leesPakket() {
    return parsePacket(this.antwoord(this.geschreven.length - 1,
      this.geschreven[this.geschreven.length - 1]));
  }
  async sluit() { this.gesloten = true; }
  get soorten() { return this.geschreven.map((p) => p.type); }
}

test('de volgorde is S F A D Z B', async () => {
  const t = new NepTransport();
  await stuurPython(t, 'MAGDATA', 'x = 1\n');
  assert.deepEqual(t.soorten, ['S', 'F', 'A', 'D', 'Z', 'B']);
});

test('het F-pakket draagt de transfer-url en het A-pakket de payloadlengte', async () => {
  const t = new NepTransport();
  const bron = 'x = 1\n';
  await stuurPython(t, 'MAGDATA', bron);
  const f = TEKST.decode(t.geschreven[1].data);
  assert.match(f, /^hh01\/xfr\/var\?name=%EE%A0%8C/);   // M in de private use area
  assert.match(f, /&type=15&memtarget=0&policy=1$/);
  const lengte = bouwPayload('MAGDATA', new TextEncoder().encode(bron)).length;
  assert.match(TEKST.decode(t.geschreven[2].data), new RegExp(String(lengte)));
});

test('send.js sluit het transport niet: de aanroeper is eigenaar', async () => {
  const t = new NepTransport();
  await stuurPython(t, 'MAGDATA', 'x = 1\n');
  assert.equal(t.gesloten, false);
});

test('grote broncode wordt over meerdere D-pakketten verdeeld', async () => {
  const t = new NepTransport();
  const bron = 'a'.repeat(9000);
  await stuurPython(t, 'MAGDATA', bron);
  const d = t.geschreven.filter((p) => p.type === 'D');
  assert.ok(d.length > 4, `verwachtte meerdere D-pakketten, kreeg ${d.length}`);
  for (const p of d) assert.ok(p.data.length <= CHUNK, `chunk van ${p.data.length}`);
  // alle chunks samen zijn precies de ge-escapete payload
  const samen = d.reduce((n, p) => n + p.data.length, 0);
  assert.equal(samen, bereidVoor('MAGDATA', bron).esc.length);
});

test('het volgnummer loopt om op 64 en blijft geldig', async () => {
  const t = new NepTransport();
  // nulbytes worden allemaal ge-escaped, dus dit levert ruim 64 pakketten op
  const bron = new Uint8Array(65000);
  await stuurPython(t, 'MAGDATA', bron);
  const d = t.geschreven.filter((p) => p.type === 'D');
  assert.ok(d.length > 64, `verwachtte meer dan 64 D-pakketten, kreeg ${d.length}`);
});

test('voortgang loopt van 0 naar het totaal en gaat nooit terug', async () => {
  const t = new NepTransport();
  const stappen = [];
  const bron = 'a'.repeat(9000);
  await stuurPython(t, 'MAGDATA', bron, (gedaan, totaal) => stappen.push([gedaan, totaal]));
  const totaal = bereidVoor('MAGDATA', bron).esc.length;
  assert.ok(stappen.length > 1);
  assert.deepEqual(stappen[stappen.length - 1], [totaal, totaal]);
  for (let i = 1; i < stappen.length; i++) {
    assert.ok(stappen[i][0] > stappen[i - 1][0], 'voortgang liep terug');
  }
});

test('een E-pakket van de rekenmachine wordt een leesbare fout', async () => {
  const t = new NepTransport((i) => i === 0
    ? encodePacket(0, 'E', new TextEncoder().encode('geen ruimte'))
    : encodePacket(0, 'Y'));
  await assert.rejects(() => stuurPython(t, 'MAGDATA', 'x = 1\n'),
    /geen ruimte/);
});

test('een onverwacht antwoordtype is een fout, geen stilte', async () => {
  const t = new NepTransport(() => encodePacket(0, 'N'));
  await assert.rejects(() => stuurPython(t, 'MAGDATA', 'x = 1\n'), /ACK/);
});

test('een kabel die er halverwege uitgaat komt naar boven', async () => {
  let n = 0;
  const t = new NepTransport();
  const echt = t.schrijf.bind(t);
  t.schrijf = async (b) => {
    if (++n === 5) throw new Error('The device has been lost');
    return echt(b);
  };
  await assert.rejects(() => stuurPython(t, 'MAGDATA', 'a'.repeat(9000)),
    /device has been lost/);
});

test('stuurAlles stuurt MAGISTER voor MAGDATA en telt de voortgang door', async () => {
  const t = new NepTransport();
  const namen = [];
  const stappen = [];
  const totaal = await stuurAlles(t, [
    { naam: 'MAGISTER', bron: 'a'.repeat(4000) },
    { naam: 'MAGDATA', bron: 'b'.repeat(4000) },
  ], (gedaan, alles, naam) => { stappen.push(gedaan); namen.push(naam); });

  const urls = t.geschreven.filter((p) => p.type === 'F').map((p) => TEKST.decode(p.data));
  assert.equal(urls.length, 2);
  assert.equal(namen[0], 'MAGISTER');
  assert.equal(namen[namen.length - 1], 'MAGDATA');
  assert.equal(stappen[stappen.length - 1], totaal);
  for (let i = 1; i < stappen.length; i++) {
    assert.ok(stappen[i] > stappen[i - 1], 'voortgang liep terug tussen twee programmas');
  }
});
