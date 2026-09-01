import test from 'node:test';
import assert from 'node:assert/strict';
import { GOUD, vanHex, naarHex } from './helpers.js';

test('hex heen en weer', () => {
  assert.equal(naarHex(vanHex('00ff10')), '00ff10');
  assert.equal(naarHex(vanHex('')), '');
});

test('de gouden vectoren zijn leesbaar en compleet', () => {
  const verwacht = ['build_container', 'build_payload', 'cbor_int', 'cbor_str',
    'checksum', 'chunk_end', 'encode_packet', 'escape', 'name_to_tokbytes',
    'name_to_uri', 'payload_checksum', 'transfer_url'];
  assert.deepEqual(Object.keys(GOUD).sort(), verwacht);
  for (const [naam, rijen] of Object.entries(GOUD)) {
    assert.ok(rijen.length >= 4, naam);
  }
});
