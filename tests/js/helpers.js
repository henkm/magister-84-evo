import { readFileSync } from 'node:fs';

export const GOUD = JSON.parse(
  readFileSync(new URL('../golden/protocol.json', import.meta.url), 'utf8'));

export function vanHex(h) {
  const uit = new Uint8Array(h.length / 2);
  for (let i = 0; i < uit.length; i++) {
    uit[i] = parseInt(h.slice(2 * i, 2 * i + 2), 16);
  }
  return uit;
}

export function naarHex(b) {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
