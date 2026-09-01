// Dunne schil om navigator.serial. Alles hier heeft een browser nodig; de
// beslissingen zitten in send.js, dat wel te testen is.
import { CR, parsePacket } from './kermit.js';

export const FILTER = { usbVendorId: 0x0451, usbProductId: 0xE018 };
export const BAUD = 115200;

export function serieelBeschikbaar() {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

/** Vraagt de gebruiker een poort te kiezen. Moet uit een klik komen. */
export async function kiesPoort() {
  if (!serieelBeschikbaar()) {
    throw new Error('deze browser kent Web Serial niet');
  }
  return navigator.serial.requestPort({ filters: [FILTER] });
}

/** Een eerder toegestane poort, of null. */
export async function bestaandePoort() {
  if (!serieelBeschikbaar()) return null;
  const poorten = await navigator.serial.getPorts();
  return poorten.length ? poorten[0] : null;
}

export class SerieelTransport {
  constructor(poort, lezer, schrijver) {
    this.poort = poort;
    this.lezer = lezer;
    this.schrijver = schrijver;
    this.rest = [];
    this.lopend = null;
  }

  static async open(poort) {
    await poort.open({ baudRate: BAUD });
    return new SerieelTransport(poort, poort.readable.getReader(),
      poort.writable.getWriter());
  }

  async schrijf(bytes) {
    await this.schrijver.write(bytes);
  }

  // Een read() die op een timeout loopt mag niet weggegooid worden: de bytes
  // komen later alsnog. De lopende belofte blijft daarom bewaard.
  async _leesStuk(ms) {
    if (!this.lopend) this.lopend = this.lezer.read();
    let timer;
    const klok = new Promise((res) => { timer = setTimeout(() => res('timeout'), ms); });
    const uitkomst = await Promise.race([this.lopend, klok]);
    clearTimeout(timer);
    if (uitkomst === 'timeout') return null;
    this.lopend = null;
    if (uitkomst.done) {
      throw new Error('de verbinding met de rekenmachine is verbroken');
    }
    return uitkomst.value;
  }

  async leesPakket(timeoutMs = 8000) {
    const eind = Date.now() + timeoutMs;
    const acc = [];
    for (;;) {
      while (this.rest.length === 0) {
        const over = eind - Date.now();
        if (over <= 0) {
          throw new Error('geen antwoord van de rekenmachine; '
            + 'staat hij aan en op het beginscherm?');
        }
        const stuk = await this._leesStuk(over);
        if (stuk) for (const b of stuk) this.rest.push(b);
      }
      const b = this.rest.shift();
      acc.push(b);
      if (b === CR) return parsePacket(Uint8Array.from(acc));
    }
  }

  async sluit() {
    try { await this.lezer.cancel(); } catch (e) { /* al dicht */ }
    try { this.lezer.releaseLock(); } catch (e) { /* al vrij */ }
    try { await this.schrijver.close(); } catch (e) { /* al dicht */ }
    try { this.schrijver.releaseLock(); } catch (e) { /* al vrij */ }
    try { await this.poort.close(); } catch (e) { /* al dicht */ }
  }
}
