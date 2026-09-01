import test from 'node:test';
import assert from 'node:assert/strict';
import { GOUD, vanHex, naarHex } from './helpers.js';
import {
  SEND_INIT, checksum, encodePacket, escape, chunkEnd, parsePacket,
} from '../../extension/src/kermit.js';

test('checksum komt overeen met de Python-kant', () => {
  for (const v of GOUD.checksum) {
    assert.equal(checksum(vanHex(v.data)), v.uit, v.data);
  }
});

test('pakketcodering is byte-identiek, kort en lang', () => {
  for (const v of GOUD.encode_packet) {
    assert.equal(naarHex(encodePacket(v.seq, v.type, vanHex(v.data))), v.uit,
      `seq=${v.seq} type=${v.type}`);
  }
});

test('het send-init-pakket is de vaste bytereeks', () => {
  assert.equal(naarHex(SEND_INIT), naarHex(encodePacket(0, 'S')));
  assert.equal(SEND_INIT.length, 19);
});

test('escaping is byte-identiek', () => {
  for (const v of GOUD.escape) {
    assert.equal(naarHex(escape(vanHex(v.in))), v.uit, v.in);
  }
});

test('chunkgrenzen liggen op dezelfde plek', () => {
  for (const v of GOUD.chunk_end) {
    assert.equal(chunkEnd(vanHex(v.buf), v.start, v.limit), v.uit,
      `start=${v.start} limit=${v.limit}`);
  }
});

test('chunkEnd knipt nooit een escape-paar doormidden', () => {
  // Alle geldige eindposities: loop de buffer eenheid voor eenheid af.
  // LET OP: een chunk mag wel degelijk eindigen op de byte 35 (het paar
  // "#","#" is de escaping van een echte '#'), dus toetsen op de laatste
  // byte is geen geldige controle. Alleen de grensverzameling telt.
  const grenzen = (buf) => {
    const g = new Set([0]);
    let n = 0;
    while (n < buf.length) {
      const b = buf[n];
      if (b === 35) n += 2;
      else if (b === 126) { n += 2; n += (n < buf.length && buf[n] === 35) ? 2 : 1; }
      else n += 1;
      g.add(Math.min(n, buf.length));
    }
    return g;
  };

  for (const rauw of [Uint8Array.from({ length: 256 }, (_, i) => i),
    new Uint8Array(50), new TextEncoder().encode('~#~#~#'), new Uint8Array(0)]) {
    const buf = escape(rauw);
    const g = grenzen(buf);
    for (let limit = 1; limit <= 40; limit++) {
      let pos = 0;
      let rondes = 0;
      while (pos < buf.length) {
        const eind = chunkEnd(buf, pos, limit);
        assert.ok(eind > pos, `geen voortgang bij limit=${limit}, pos=${pos}`);
        assert.ok(g.has(eind), `eind ${eind} ligt niet op een eenheidsgrens`);
        pos = eind;
        assert.ok(++rondes < 5000, 'oneindige lus');
      }
    }
  }
});

test('antwoordpakketten worden geparseerd, kort en lang', () => {
  const kort = encodePacket(3, 'Y', new Uint8Array(0));
  assert.deepEqual(parsePacket(kort), { type: 'Y', data: new Uint8Array(0) });

  const tekst = new TextEncoder().encode('fout: geen ruimte');
  const lang = encodePacket(4, 'E', tekst);
  const uit = parsePacket(lang);
  assert.equal(uit.type, 'E');
  assert.deepEqual(uit.data, tekst);
});

test('rommel voor de startbyte wordt overgeslagen', () => {
  const echt = encodePacket(1, 'Y', new Uint8Array(0));
  const rommel = new Uint8Array([0, 0, 10, ...echt]);
  assert.equal(parsePacket(rommel).type, 'Y');
  assert.throws(() => parsePacket(Uint8Array.of(9, 9, 9)), /startbyte/);
});
