// Dunne schil om navigator.serial. Alles hier heeft een browser nodig; de
// beslissingen zitten in send.js, dat wel te testen is.
import { CR, parsePacket } from './kermit.js';

export const FILTER = { usbVendorId: 0x0451, usbProductId: 0xE018 };
export const BAUD = 115200;

export function serieelBeschikbaar() {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

/** Hoort deze poort bij een TI-84 Evo-T? */
export function isRekenmachine(poort) {
  if (!poort || typeof poort.getInfo !== 'function') return false;
  let info;
  try { info = poort.getInfo(); } catch (e) { return false; }
  return Boolean(info) && info.usbVendorId === FILTER.usbVendorId
    && info.usbProductId === FILTER.usbProductId;
}

/**
 * Vraagt de gebruiker een poort te kiezen. Moet uit een klik komen.
 *
 * alles:true laat het filter weg. Het filter is de goede eerste poging -- dan
 * staat er precies een apparaat in de lijst en valt er niets te kiezen -- maar
 * als Chrome de USB-nummers van een poort niet kent, is die lijst leeg en is
 * er zonder filter niets aan de hand. Het verschil tussen "hij staat er niet
 * in" en "hij bestaat niet" is met een filter niet te zien.
 */
export async function kiesPoort({ alles = false } = {}) {
  if (!serieelBeschikbaar()) {
    const fout = new Error('deze pagina heeft geen Web Serial');
    fout.name = 'GeenWebSerial';
    throw fout;
  }
  return navigator.serial.requestPort(alles ? {} : { filters: [FILTER] });
}

/**
 * Een eerder toegestane poort, of null. Een poort die aan het filter voldoet
 * gaat voor: wie ooit een andere seriele poort heeft toegestaan (een Arduino,
 * een bluetoothpoort) zou anders die poort opengetrokken krijgen en pas bij
 * het eerste pakket merken dat er geen rekenmachine aan hangt.
 */
export async function bestaandePoort() {
  if (!serieelBeschikbaar()) return null;
  const poorten = await navigator.serial.getPorts();
  return poorten.find(isRekenmachine) || poorten[0] || null;
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
