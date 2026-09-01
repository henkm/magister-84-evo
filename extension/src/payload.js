// Programmacontainer en payload voor de TI-84 Evo.
// Spiegelt tools/evosend/payload.py; de gouden vectoren bewaken dat.
import { aaneen, cbor, cborKop } from './cbor.js';

export const TYPE_PYTHON = 15;
export const TYPE_BASIC = 2;

const TEKST = new TextEncoder();

function kv(k, v) {
  return aaneen(cbor(k), cbor(v));
}

function u32le(n) {
  return Uint8Array.of(n & 255, (n >>> 8) & 255, (n >>> 16) & 255,
    (n >>> 24) & 255);
}

export function naamNaarTiTekens(naam) {
  let uit = '';
  for (const ch of naam) {
    if (ch >= 'A' && ch <= 'Z') {
      // 0xE800: private use area voor de letters A-Z
      uit += String.fromCharCode(ch.charCodeAt(0) - 65 + 59392);
    } else if (ch >= '0' && ch <= '9') {
      // 0xE401: private use area voor de cijfers 0-9
      uit += String.fromCharCode(ch.charCodeAt(0) - 48 + 58369);
    } else {
      throw new Error(`naam "${naam}" bevat een teken dat niet kan: "${ch}"`);
    }
  }
  return uit;
}

export function naamNaarUri(naam) {
  return encodeURIComponent(naamNaarTiTekens(naam));
}

export function naamNaarTokbytes(naam) {
  const tekens = naamNaarTiTekens(naam);
  const uit = new Uint8Array(tekens.length * 2 + 2);
  for (let i = 0; i < tekens.length; i++) {
    const c = tekens.charCodeAt(i);
    uit[2 * i] = c & 255;
    uit[2 * i + 1] = (c >>> 8) & 255;
  }
  return uit;
}

export function bouwContainer(naam, bron) {
  if (bron.length > 0xFFFF) {
    throw new Error(`broncode is ${bron.length} bytes, maar er passen er `
      + 'maximaal 65535 in een programma');
  }
  const nb = TEKST.encode(naam);
  // 18 = 17 vaste bytes plus de ene byte opvulling die hieronder bijkomt
  const totaal = bron.length + nb.length + 18;
  const uit = aaneen(
    Uint8Array.of(19, 1, 0, 0), u32le(totaal), u32le(nb.length), nb,
    Uint8Array.of(0),
    Uint8Array.of(bron.length & 255, (bron.length >>> 8) & 255),
    Uint8Array.of(0, 2), bron);
  if (uit.length < totaal) return aaneen(uit, new Uint8Array(totaal - uit.length));
  return uit;
}

export function payloadChecksum(data) {
  // Laat 3 woorden (even lengte) of 1 woord (oneven) buiten de som; bij de
  // even lengte slaat dat onder meer de checksum zelf over.
  const woorden = Math.max(0, (data.length >> 1) - (data.length % 2 === 0 ? 3 : 1));
  let n = 0;
  for (let i = 0; i < woorden; i++) n ^= data[2 * i] | (data[2 * i + 1] << 8);
  return Uint8Array.of((n >>> 8) & 255, n & 255);
}

export function bouwPayload(naam, bron, vartype = TYPE_PYTHON) {
  const container = bouwContainer(naam, bron);
  const nm = naamNaarTokbytes(naam);
  const meta = aaneen(Uint8Array.of(0xBF), kv('type', vartype), kv('version', 1),
    kv('flags', 0), cbor('name'), cborKop(2, nm.length), nm,
    Uint8Array.of(0xFF));
  const buiten = aaneen(Uint8Array.of(0xBF), cbor('metaData'), meta,
    kv('version', 1), kv('size', container.length), cbor('data'),
    cborKop(2, container.length), container, Uint8Array.of(0xFF));
  return aaneen(buiten, payloadChecksum(buiten));
}

export function transferUrl(naam, vartype = TYPE_PYTHON) {
  return `hh01/xfr/var?name=${naamNaarUri(naam)}&type=${vartype}`
    + '&memtarget=0&policy=1';
}

export function valideerNaam(naam) {
  const n = String(naam).toUpperCase();
  if (n.length < 1 || n.length > 8) {
    throw new Error(`programmanaam moet 1 tot 8 tekens zijn: "${naam}"`);
  }
  if (!(n[0] >= 'A' && n[0] <= 'Z')) {
    throw new Error(`programmanaam moet met een letter beginnen: "${naam}"`);
  }
  naamNaarTiTekens(n);
  return n;
}
