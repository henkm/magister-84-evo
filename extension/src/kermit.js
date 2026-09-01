// Kermit-framing voor de TI-84 Evo.
// Spiegelt tools/evosend/kermit.py; de gouden vectoren bewaken dat.
import { aaneen } from './cbor.js';

export const SOH = 1;
export const CR = 13;
export const SEND_INIT = Uint8Array.of(
  0x01, 0x30, 0x20, 0x53, 0x7e, 0x30, 0x20, 0x40, 0x2d, 0x23,
  0x59, 0x31, 0x7e, 0x2e, 0x22, 0x35, 0x4d, 0x3e, 0x0d);

export function tochar(n) {
  return (n + 32) & 255;
}

export function checksum(data) {
  let s = 0;
  for (const b of data) s += b;
  return (32 + ((s + ((192 & s) >> 6)) & 63)) & 255;
}

export function encodePacket(seq, type, data = new Uint8Array(0)) {
  if (type === 'S') return SEND_INIT;
  const t = type.charCodeAt(0);
  const n = 2 + data.length + 1;
  if (n <= 80 && type !== 'F') {
    const body = aaneen(Uint8Array.of(tochar(n), tochar(seq), t), data);
    return aaneen(Uint8Array.of(SOH), body, Uint8Array.of(checksum(body), CR));
  }
  const totaal = data.length + 1;
  const kop = Uint8Array.of(32, tochar(seq), t,
    tochar(Math.floor(totaal / 95)), tochar(totaal % 95));
  const body = aaneen(kop, Uint8Array.of(checksum(kop)), data);
  return aaneen(Uint8Array.of(SOH), body, Uint8Array.of(checksum(body), CR));
}

export function escape(data) {
  const uit = [];
  for (const b of data) {
    if (b < 32 || b === 127 || b === 255) {
      uit.push(35, 64 ^ b);
    } else if (b === 35 || b === 126) {
      uit.push(35, b);
    } else {
      uit.push(b);
    }
  }
  return Uint8Array.from(uit);
}

export function chunkEnd(buf, start, limit) {
  // Wijkt bewust af van evo-send.min.js: die kan de limiet met twee bytes
  // overschrijden, deze stelt een escape-eenheid die niet past uit. Mag,
  // want lange Kermit-pakketten dragen hun eigen lengte.
  const eind = buf.length;
  let n = start;
  while (n < eind) {
    const b = buf[n];
    let volgend;
    if (b === 35) {
      volgend = n + 2;
    } else if (b === 126) {
      volgend = n + 2;
      volgend += (volgend < eind && buf[volgend] === 35) ? 2 : 1;
    } else {
      volgend = n + 1;
    }
    if (volgend - start > limit) {
      // past niet meer, maar er moet voortgang zijn
      if (n === start) n = Math.min(volgend, eind);
      break;
    }
    n = volgend;
  }
  return Math.min(n, eind);
}

export function parsePacket(rauw) {
  let start = rauw[0] === SOH ? 0 : rauw.indexOf(SOH);
  if (start < 0) throw new Error('geen startbyte in het antwoord');
  const p = rauw.subarray(start);
  const data = p[1] === 32 ? p.subarray(7, p.length - 2)
    : p.subarray(4, p.length - 2);
  return { type: String.fromCharCode(p[3]), data: new Uint8Array(data) };
}
