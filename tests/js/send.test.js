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
    // De rauwe bytes moeten mee: parsePacket gooit de volgnummerbyte weg,
    // en juist die byte is wat het apparaat te zien krijgt.
    this.geschreven.push({ ...parsePacket(bytes), rauw: bytes });
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

  // Het Kermit-volgnummerveld staat altijd op rauw[2], bij een korte en een
  // lange kop, en is tochar(seq) = (seq + 32) & 255. Boven de 63 levert dat
  // bytes vanaf 96 op: buiten het bereik dat het apparaat verwacht.
  const nrs = d.map((p) => p.rauw[2]);
  for (const b of nrs) {
    assert.ok(b >= 32 && b <= 95, `volgnummerbyte ${b} valt buiten 32..95`);
  }
  // 3, 4, ... 63, 0, 1, ... : het eerste D-pakket draagt volgnummer 3
  assert.deepEqual(nrs, d.map((_, i) => 32 + ((i + 3) % 64)));
  // en de reeks loopt echt om, hij klimt niet door
  const top = nrs.indexOf(95);
  assert.ok(top >= 0 && top < nrs.length - 1, 'volgnummer 63 moet voorkomen');
  assert.equal(nrs[top + 1], 32, 'na 63 hoort 0 te komen');
  assert.ok(new Set(nrs).size < nrs.length, 'volgnummers moeten hergebruikt worden');
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

test('een fouttekst met niet-ASCII bytes blijft leesbaar', async () => {
  // 0xe9 is 'e' met accent in latin1; een UTF-8-decoder maakt er U+FFFD van.
  const fout = Uint8Array.of(0x67, 0x65, 0xeb, 0x69, 0x6e, 0x64, 0x69, 0x67, 0x64);
  const t = new NepTransport((i) => i === 0
    ? encodePacket(0, 'E', fout)
    : encodePacket(0, 'Y'));
  await assert.rejects(() => stuurPython(t, 'MAGDATA', 'x = 1\n'), (e) => {
    assert.match(e.message, /ge\u00ebindigd/);
    assert.ok(!e.message.includes('\ufffd'), 'geen vervangingstekens in de fouttekst');
    return true;
  });
});

test('elke byte in een fouttekst wordt zijn eigen codepunt', async () => {
  // Het contract met tools/evosend/port.py is byte n -> codepunt n, voor alle
  // 256 bytes. Deze test legt dat vast; hij zou in Node ook slagen met
  // TextDecoder('latin1'), maar in Chrome niet, en daar draait de extensie.
  const alle = Uint8Array.from({ length: 224 }, (_, i) => i + 32);
  const t = new NepTransport((i) => i === 0
    ? encodePacket(0, 'E', alle)
    : encodePacket(0, 'Y'));
  await assert.rejects(() => stuurPython(t, 'MAGDATA', 'x = 1\n'), (e) => {
    const staart = e.message.slice(-alle.length);
    assert.equal(staart.length, alle.length);
    for (let i = 0; i < alle.length; i++) {
      assert.equal(staart.charCodeAt(i), alle[i], `byte ${alle[i]}`);
    }
    return true;
  });
});

test('een E-pakket op het A-pakket wordt ook opgemerkt', async () => {
  // Het derde schrijven (index 2) is het A-pakket met de payloadlengte.
  // Zonder de ack daarna zou deze fout pas bij het volgende pakket opvallen,
  // of helemaal niet.
  const t = new NepTransport((i) => i === 2
    ? encodePacket(0, 'E', new TextEncoder().encode('bestand te groot'))
    : encodePacket(0, 'Y'));
  await assert.rejects(() => stuurPython(t, 'MAGDATA', 'x = 1\n'),
    /bestand te groot/);
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
  const transporten = [];
  const maak = async () => {
    const t = new NepTransport();
    transporten.push(t);
    return t;
  };
  const namen = [];
  const stappen = [];
  const totaal = await stuurAlles(maak, [
    { naam: 'MAGISTER', bron: 'a'.repeat(4000) },
    { naam: 'MAGDATA', bron: 'b'.repeat(4000) },
  ], (gedaan, alles, naam) => { stappen.push(gedaan); namen.push(naam); });

  const urls = transporten.flatMap((t) => t.geschreven
    .filter((p) => p.type === 'F').map((p) => TEKST.decode(p.data)));
  assert.equal(urls.length, 2);
  assert.equal(namen[0], 'MAGISTER');
  assert.equal(namen[namen.length - 1], 'MAGDATA');
  assert.equal(stappen[stappen.length - 1], totaal);
  for (let i = 1; i < stappen.length; i++) {
    assert.ok(stappen[i] > stappen[i - 1], 'voortgang liep terug tussen twee programmas');
  }
});

test('elk programma gaat over een eigen verbinding, die daarna dichtgaat', async () => {
  // Gemeten op een TI-84 Evo-T: na het B-pakket doet het apparaat niets meer
  // met die verbinding. Twee programma's over een open poort liep vast op
  // precies de grens tussen de twee (62%).
  const transporten = [];
  const maak = async () => {
    const t = new NepTransport();
    transporten.push(t);
    return t;
  };
  await stuurAlles(maak, [
    { naam: 'MAGISTER', bron: 'x = 1\n' },
    { naam: 'MAGDATA', bron: 'y = 2\n' },
  ]);
  assert.equal(transporten.length, 2, 'elk programma hoort een eigen verbinding');
  for (const t of transporten) {
    assert.deepEqual(t.soorten, ['S', 'F', 'A', 'D', 'Z', 'B'],
      'elke verbinding begint zelf met een S en eindigt met een B');
    assert.equal(t.gesloten, true, 'stuurAlles sluit wat het zelf opent');
  }
});

test('een mislukt tweede programma laat geen open verbinding achter', async () => {
  const transporten = [];
  const maak = async () => {
    // de tweede verbinding antwoordt met een NAK op het eerste pakket
    const t = new NepTransport(transporten.length === 1
      ? () => encodePacket(0, 'N') : undefined);
    transporten.push(t);
    return t;
  };
  await assert.rejects(() => stuurAlles(maak, [
    { naam: 'MAGISTER', bron: 'x = 1\n' },
    { naam: 'MAGDATA', bron: 'y = 2\n' },
  ]), /ACK/);
  assert.equal(transporten.length, 2);
  assert.equal(transporten[1].gesloten, true, 'de kapotte verbinding bleef open');
});
