// CBOR-codering, precies zoveel als de payload van de Evo nodig heeft.
// Spiegelt tools/evosend/payload.py; de gouden vectoren bewaken dat.

const TEKST = new TextEncoder();

export function aaneen(...delen) {
  let n = 0;
  for (const d of delen) n += d.length;
  const uit = new Uint8Array(n);
  let p = 0;
  for (const d of delen) {
    uit.set(d, p);
    p += d.length;
  }
  return uit;
}

export function cborKop(major, n) {
  const r = major << 5;
  if (n < 24) return Uint8Array.of(r | n);
  if (n <= 255) return Uint8Array.of(24 | r, n);
  if (n <= 65535) return Uint8Array.of(25 | r, (n >>> 8) & 255, n & 255);
  return Uint8Array.of(26 | r, (n >>> 24) & 255, (n >>> 16) & 255,
    (n >>> 8) & 255, n & 255);
}

export function cbor(waarde) {
  if (typeof waarde === 'number') {
    if (!Number.isInteger(waarde) || waarde < 0) {
      throw new TypeError('alleen niet-negatieve gehele getallen: ' + waarde);
    }
    return cborKop(0, waarde);
  }
  if (waarde instanceof Uint8Array) return aaneen(cborKop(2, waarde.length), waarde);
  if (typeof waarde === 'string') {
    const b = TEKST.encode(waarde);
    return aaneen(cborKop(3, b.length), b);
  }
  throw new TypeError('kan dit niet als CBOR coderen: ' + typeof waarde);
}
