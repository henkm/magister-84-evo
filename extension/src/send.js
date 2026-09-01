// Transfervolgorde: bouwt een payload en stuurt hem via Kermit-framing.
// Spiegelt tools/evosend/send.py. Het transport komt van buiten, zodat deze
// laag zonder browser en zonder apparaat te testen is.
import { aaneen } from './cbor.js';
import { chunkEnd, encodePacket, escape } from './kermit.js';
import { bouwPayload, transferUrl, valideerNaam } from './payload.js';

export const CHUNK = 2000;

const TEKST = new TextEncoder();

// tools/evosend/port.py leest de fouttekst van de rekenmachine met
// .decode("latin1"): byte n wordt codepunt n, alle 256 bytes.
//
// Bewust GEEN TextDecoder: de labelnaam "latin1" is per WHATWG een alias voor
// windows-1252, niet voor ISO 8859-1. Gemeten: Node 22 beeldt daarmee toevallig
// alle 256 bytes een-op-een af, maar Chrome 152 wijkt af voor 27 bytes in
// 0x80-0x9F (0x80 wordt het euroteken, 0x92 een aanhalingsteken). De extensie
// draait in Chrome en de tests in Node, dus die afwijking zou geen enkele test
// ooit te zien krijgen. Deze regel doet wat er staat, overal hetzelfde.
function lees_latin1(bytes) {
  let uit = '';
  for (const b of bytes) uit += String.fromCharCode(b);
  return uit;
}

async function verwachtAck(transport, timeoutMs = 8000) {
  const { type, data } = await transport.leesPakket(timeoutMs);
  if (type === 'E') {
    throw new Error('de rekenmachine meldt een fout: ' + lees_latin1(data));
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

/**
 * Stuurt meerdere programma's, elk over een eigen verbinding.
 *
 * Gemeten op een TI-84 Evo-T op 2026-09-01: na het B-pakket doet het apparaat
 * niets meer met die verbinding. Een tweede S-pakket over dezelfde open poort
 * blijft onbeantwoord, en de transfer liep vast op exact de grens tussen de
 * twee programma's (28,8 van 46,6 kB, 62%). tools/evosend doet het al goed --
 * open, een bestand, dicht -- alleen deed deze functie dat niet.
 *
 * maakTransport levert per programma een verse verbinding; stuurAlles sluit
 * hem zelf weer, ook als de transfer onderweg afbreekt.
 */
export async function stuurAlles(maakTransport, programmas, opVoortgang) {
  const klaar = programmas.map((p) => bereidVoor(p.naam, p.bron));
  const totaal = klaar.reduce((s, v) => s + v.esc.length, 0);
  let gedaan = 0;
  // Geen kunstmatige pauze tussen twee programma's: transport.sluit() wacht
  // zelf tot de poort echt dicht is, en dat is het moment waarop het apparaat
  // klaar is voor de volgende. Blijkt op het apparaat dat er toch rust nodig
  // is, dan hoort die hier -- gemeten, niet voor de zekerheid.
  for (const v of klaar) {
    const transport = await maakTransport();
    try {
      await stuurVoorbereid(transport, v, (n) => {
        if (opVoortgang) opVoortgang(gedaan + n, totaal, v.naam);
      });
    } finally {
      await transport.sluit();
    }
    gedaan += v.esc.length;
  }
  return totaal;
}
