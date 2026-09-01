import test from 'node:test';
import assert from 'node:assert/strict';
import { GOUD, vanHex, naarHex } from './helpers.js';
import { cbor } from '../../extension/src/cbor.js';
import {
  naamNaarUri, naamNaarTokbytes, bouwContainer, payloadChecksum,
  bouwPayload, transferUrl, valideerNaam,
} from '../../extension/src/payload.js';

test('cbor voor gehele getallen komt overeen met de Python-kant', () => {
  for (const v of GOUD.cbor_int) {
    assert.equal(naarHex(cbor(v.waarde)), v.uit, `int ${v.waarde}`);
  }
});

test('cbor voor tekst komt overeen met de Python-kant', () => {
  for (const v of GOUD.cbor_str) {
    assert.equal(naarHex(cbor(v.waarde)), v.uit, `str "${v.waarde}"`);
  }
});

test('naamcodering naar de private use area', () => {
  for (const v of GOUD.name_to_uri) {
    assert.equal(naamNaarUri(v.naam), v.uit, v.naam);
  }
  for (const v of GOUD.name_to_tokbytes) {
    assert.equal(naarHex(naamNaarTokbytes(v.naam)), v.uit, v.naam);
  }
});

test('de programmacontainer is byte-identiek', () => {
  for (const v of GOUD.build_container) {
    assert.equal(naarHex(bouwContainer(v.naam, vanHex(v.bron))), v.uit,
      `${v.naam} / ${v.bron.length / 2} bytes`);
  }
});

test('de payload-checksum is byte-identiek', () => {
  for (const v of GOUD.payload_checksum) {
    assert.equal(naarHex(payloadChecksum(vanHex(v.data))), v.uit, v.data);
  }
});

test('de volledige payload is byte-identiek', () => {
  for (const v of GOUD.build_payload) {
    assert.equal(naarHex(bouwPayload(v.naam, vanHex(v.bron))), v.uit,
      `${v.naam} / ${v.bron.length / 2} bytes`);
  }
});

test('de transfer-url is gelijk', () => {
  for (const v of GOUD.transfer_url) {
    assert.equal(transferUrl(v.naam), v.uit, v.naam);
  }
});

test('een te grote broncode wordt geweigerd, niet stilletjes afgekapt', () => {
  assert.throws(() => bouwContainer('TEST', new Uint8Array(65536)),
    /65535/);
  assert.doesNotThrow(() => bouwContainer('TEST', new Uint8Array(65535)));
});

test('namen worden gevalideerd', () => {
  assert.equal(valideerNaam('magdata'), 'MAGDATA');
  assert.throws(() => valideerNaam(''), /1 tot 8/);
  assert.throws(() => valideerNaam('TELANGENAAM'), /1 tot 8/);
  assert.throws(() => valideerNaam('1ABC'), /letter/);
  assert.throws(() => valideerNaam('AB-CD'), /teken/);
});
