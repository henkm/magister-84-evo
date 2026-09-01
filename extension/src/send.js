// Transfervolgorde: bouwt een payload en stuurt hem via Kermit-framing.
// Spiegelt tools/evosend/send.py. Het transport komt van buiten, zodat deze
// laag zonder browser en zonder apparaat te testen is.
import { aaneen } from './cbor.js';
import { chunkEnd, encodePacket, escape } from './kermit.js';
import { bouwPayload, transferUrl, valideerNaam } from './payload.js';

export const CHUNK = 2000;

const TEKST = new TextEncoder();
// latin1, niet UTF-8: tools/evosend/port.py leest de fouttekst van de
// rekenmachine met .decode("latin1"), byte voor byte. Met de standaard
// UTF-8-decoder wordt elke niet-ASCII byte een vervangingsteken.
const LEES = new TextDecoder('latin1');

async function verwachtAck(transport, timeoutMs = 8000) {
  const { type, data } = await transport.leesPakket(timeoutMs);
  if (type === 'E') {
    throw new Error('de rekenmachine meldt een fout: ' + LEES.decode(data));
  }
  if (type !== 'Y') {
    throw new Error(`verwachtte een ACK (Y) van de rekenmachine, kreeg "${type}"`);
  }
}

export function bereidVoor(naam, bron) {
  const n = valideerNaam(naam);
  const bytes = typeof bron === 'string' ? TEKST.encode(bron) : bron;
  const blob = bouwPayload(n, bytes);
  return { naam: n, url: transferUrl(n), blob, esc: escape(blob) };
}

export async function stuurVoorbereid(transport, v, opVoortgang) {
  await transport.schrijf(encodePacket(0, 'S'));
  await verwachtAck(transport);
  await transport.schrijf(encodePacket(1, 'F', TEKST.encode(v.url)));
  await verwachtAck(transport);

  const maat = String(v.blob.length);
  const attrs = aaneen(TEKST.encode('""B81'),
    Uint8Array.of((maat.length + 32) & 255), TEKST.encode(maat + '@ '));
  await transport.schrijf(encodePacket(2, 'A', attrs));
  await verwachtAck(transport);

  let seq = 3;
  let pos = 0;
  while (pos < v.esc.length) {
    const eind = chunkEnd(v.esc, pos, CHUNK);
    await transport.schrijf(encodePacket(seq % 64, 'D', v.esc.subarray(pos, eind)));
    await verwachtAck(transport, 15000);
    seq += 1;
    pos = eind;
    if (opVoortgang) opVoortgang(pos, v.esc.length, v.naam);
  }

  await transport.schrijf(encodePacket(seq % 64, 'Z'));
  await verwachtAck(transport);
  await transport.schrijf(encodePacket((seq + 1) % 64, 'B'));
  await verwachtAck(transport);
  return v.blob.length;
}

export async function stuurPython(transport, naam, bron, opVoortgang) {
  return stuurVoorbereid(transport, bereidVoor(naam, bron), opVoortgang);
}

export async function stuurAlles(transport, programmas, opVoortgang) {
  const klaar = programmas.map((p) => bereidVoor(p.naam, p.bron));
  const totaal = klaar.reduce((s, v) => s + v.esc.length, 0);
  let gedaan = 0;
  for (const v of klaar) {
    await stuurVoorbereid(transport, v, (n) => {
      if (opVoortgang) opVoortgang(gedaan + n, totaal, v.naam);
    });
    gedaan += v.esc.length;
  }
  return totaal;
}
