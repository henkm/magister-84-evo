// Een browser die niet bestaat, maar wel genoeg doet om panel.js er echt in
// te laten draaien: een DOM, chrome.*, een Magister die antwoordt en een
// rekenmachine aan een seriele poort. Alleen zo is de naad tussen de modules
// te testen -- zonder Chrome, zonder Magister-sessie en zonder apparaat.
import { encodePacket } from '../../extension/src/kermit.js';

// --- DOM -------------------------------------------------------------------

class NepElement {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.attrs = {};
    this.handlers = {};
    this.hidden = false;
    this.className = '';
    this.disabled = false;
    this.ouder = null;
    this._tekst = '';
  }

  get textContent() { return this._tekst; }

  // textContent = '' is in panel.js de manier om kinderen te wissen
  set textContent(waarde) {
    this._tekst = String(waarde);
    this.children = [];
  }

  appendChild(kind) { kind.ouder = this; this.children.push(kind); return kind; }

  append(...kinderen) { for (const k of kinderen) this.appendChild(k); }

  addEventListener(soort, fn) {
    (this.handlers[soort] = this.handlers[soort] || []).push(fn);
  }

  setAttribute(naam, waarde) { this.attrs[naam] = String(waarde); }

  getAttribute(naam) { return this.attrs[naam]; }

  querySelector(kiezer) {
    const klasse = kiezer.replace('.', '');
    return this.children.find((k) => k.className === klasse) || null;
  }

  remove() {
    if (!this.ouder) return;
    const i = this.ouder.children.indexOf(this);
    if (i >= 0) this.ouder.children.splice(i, 1);
  }

  klik() { for (const fn of this.handlers.click || []) fn(); }
}

const SCHERMEN = ['kind-kiezen', 'klaar', 'koppelen', 'bezig', 'gereed', 'fout'];

export function nepDom() {
  const knopen = new Map();
  const doc = {
    getElementById(id) {
      if (!knopen.has(id)) knopen.set(id, new NepElement('div'));
      return knopen.get(id);
    },
    createElement: (tag) => new NepElement(tag),
    createElementNS: (ns, tag) => new NepElement(tag),
    addEventListener() { /* DOMContentLoaded komt in een test niet */ },
  };
  doc.el = (id) => doc.getElementById(id);
  doc.tekst = (id) => doc.getElementById(id).textContent;
  doc.knop = (id) => doc.getElementById(id);
  doc.scherm = () => SCHERMEN.find((n) => !doc.getElementById(`s-${n}`).hidden)
    || null;
  return doc;
}

/**
 * Laat de lopende beloftes hun werk doen. Bewust setImmediate en geen timer:
 * een van de tests zet de klok van node stil (t.mock.timers), en met een timer
 * staat deze lus dan ook stil.
 */
export const adem = () => new Promise((res) => { setImmediate(res); });

export async function totScherm(dom, naam, beurten = 5000) {
  for (let i = 0; i < beurten; i++) {
    if (dom.scherm() === naam) return;
    await adem();
  }
  throw new Error(`het scherm bleef op ${dom.scherm()} staan in plaats van `
    + `op ${naam}`);
}

// --- rekenmachine aan een seriele poort ------------------------------------

/**
 * Een poort die precies doet wat de TI doet: op elk pakket een ACK.
 * antwoordt:false is een rekenmachine die uit staat of in een menu hangt.
 * faalOpen is een poort die al door iets anders wordt vastgehouden.
 */
export function nepPoort({ antwoordt = true, faalOpen = null,
  opSchrijf = null, info = { usbVendorId: 0x0451, usbProductId: 0xE018 } } = {}) {
  const geschreven = [];
  const wachtrij = [];
  let wachtende = null;
  let seq = 0;
  const poort = { aantalOpen: 0, dicht: false, geschreven, getInfo: () => info };

  function lever(bytes) {
    if (wachtende) {
      const res = wachtende;
      wachtende = null;
      res({ value: bytes, done: false });
    } else {
      wachtrij.push(bytes);
    }
  }

  poort.open = async (opties) => {
    if (faalOpen) throw faalOpen;
    poort.aantalOpen += 1;
    poort.dicht = false;
    poort.opties = opties;
  };
  poort.close = async () => { poort.dicht = true; };
  poort.readable = {
    getReader: () => ({
      read: () => (wachtrij.length
        ? Promise.resolve({ value: wachtrij.shift(), done: false })
        : new Promise((res) => { wachtende = res; })),
      cancel: async () => {},
      releaseLock: () => {},
    }),
  };
  poort.writable = {
    getWriter: () => ({
      write: async (bytes) => {
        geschreven.push(bytes);
        if (opSchrijf) await opSchrijf(geschreven.length, bytes);
        if (antwoordt) lever(encodePacket((seq = (seq + 1) % 64), 'Y'));
      },
      close: async () => {},
      releaseLock: () => {},
    }),
  };
  return poort;
}

// --- Magister --------------------------------------------------------------

export const AFSPRAAK = {
  Id: 1, Start: '2026-09-01T07:00:00Z', Einde: '2026-09-01T07:45:00Z',
  LesuurVan: 1, LesuurTotMet: 1, Vakken: [{ Naam: 'wiskunde B' }],
  Lokalen: [{ Naam: '118' }], Docenten: [{ Naam: 'Alting', Docentcode: 'ALT' }],
  InfoType: 1, Inhoud: '<p>maak opgave 12 tot en met 18</p>', Status: 1,
};

export const CIJFER = {
  CijferStr: '7,4', IsVoldoende: true, DatumIngevoerd: '2026-06-01T10:00:00Z',
  Vak: { Omschrijving: 'wiskunde B' }, CijferPeriode: { Naam: 'P4' },
  CijferKolom: { KolomKop: 'SO1', KolomSoort: 1 }, TeltMee: true,
};

// --- alles bij elkaar ------------------------------------------------------

let teller = 0;

export function nepOmgeving({
  opgeslagen = { kindId: 7, kindNaam: 'Fenna' },
  tabs = [{ id: 3, url: 'https://school.magister.net/leerling' }],
  token = 'geheim',
  status = {},
  aanmeldingen = [{ Id: 900, Begin: '2025-08-01', Einde: '2099-07-31',
    Studie: { Omschrijving: 'vwo 5' } }],
  afspraken = [AFSPRAAK],
  cijfers = [CIJFER],
  poort = nepPoort(),
  poorten = null,
  keuzeFout = null,
} = {}) {
  const dom = nepDom();
  const opgevraagd = [];
  const geopendeTabs = [];
  // keuzes houdt bij waarmee requestPort is aangeroepen: met of zonder filter.
  const keuzes = [];
  const geslotenTabs = [];
  const omgeving = { dom, opgevraagd, geopendeTabs, geslotenTabs, opgeslagen,
    poort, poorten, status, keuzes, keuzeFout };

  const antwoord = (json, code = 200) => ({
    status: code, ok: code < 400, json: async () => json,
  });

  omgeving.chrome = {
    tabs: {
      query: async () => tabs,
      create: async ({ url }) => { geopendeTabs.push(url); },
      // Het paneel draait in een eigen tabblad en sluit dat zelf.
      getCurrent: async () => ({ id: 99, url: 'chrome-extension://nep/panel.html' }),
      remove: async (id) => { omgeving.geslotenTabs.push(id); },
    },
    scripting: {
      executeScript: async () => [{ result: token ? { token } : null }],
    },
    storage: {
      local: {
        get: async () => ({ ...omgeving.opgeslagen }),
        set: async (waarden) => { Object.assign(omgeving.opgeslagen, waarden); },
      },
    },
    runtime: { getURL: (pad) => `chrome-extension://nep/${pad}` },
  };

  omgeving.fetch = async (url) => {
    opgevraagd.push(url);
    if (url.endsWith('.py')) return { ok: true, text: async () => '# app\n' };
    for (const [stuk, code] of Object.entries(omgeving.status)) {
      if (url.includes(stuk)) return antwoord({}, code);
    }
    if (url.includes('/api/account')) {
      return antwoord({ Persoon: { Id: 42 }, Groep: [{ Naam: 'Ouder' }] });
    }
    if (url.includes('/kinderen')) {
      return antwoord({ Items: [{ Id: 7, Roepnaam: 'Fenna',
        Achternaam: 'de Vries' }] });
    }
    if (url.includes('/aanmeldingen?') || url.endsWith('/aanmeldingen')) {
      return antwoord({ Items: aanmeldingen });
    }
    if (url.includes('/afspraken')) return antwoord({ Items: afspraken });
    if (url.includes('cijferoverzicht')) return antwoord({ Items: cijfers });
    throw new Error(`de nepomgeving kent ${url} niet`);
  };

  return omgeving;
}

/** Zet de globals klaar en laadt een verse kopie van panel.js. */
export async function laadPaneel(omgeving) {
  globalThis.document = omgeving.dom;
  globalThis.chrome = omgeving.chrome;
  globalThis.fetch = omgeving.fetch;
  globalThis.window = { close() { omgeving.gesloten = true; } };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      serial: {
        getPorts: async () => (Array.isArray(omgeving.poorten)
          ? omgeving.poorten
          : (omgeving.poort ? [omgeving.poort] : [])),
        requestPort: async (opties) => {
          omgeving.keuzes.push(opties);
          const fout = omgeving.keuzeFout
            && omgeving.keuzeFout(omgeving.keuzes.length - 1, opties);
          if (fout) throw fout;
          if (!omgeving.poort) {
            const leeg = new Error('No port selected by the user.');
            leeg.name = 'NotFoundError';
            throw leeg;
          }
          return omgeving.poort;
        },
      },
    },
  });
  teller += 1;
  return import(`../../extension/panel.js?n=${teller}`);
}
