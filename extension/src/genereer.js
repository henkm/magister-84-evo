// Model -> MAGDATA.py. Python's eigen parser is het dataformaat: geen eigen
// serialisatie, en de rekenmachine heeft geen json-module nodig.
import { bouwVakken } from './cijfers.js';
import { bouwDagen, lokaleTijd } from './rooster.js';

// De programmacontainer heeft een 16-bits lengteveld voor de broncode.
export const MAX_BRON = 65535;

// Het lesdetail op de rekenmachine wrapt op 307 px bij een letterbreedte van
// 10 px: dertig tekens per regel, zes regels tegelijk, scrollend. Rond de
// 240 tekens is acht regels; daarboven leest niemand het meer op een scherm
// van 209 px hoog, en elke extra letter gaat wel ten koste van MAX_BRON.
export const MAX_HUISWERK = 240;
const PUNTJES = '...';
const REGEL = 30;

// velden in een rij van DAGEN[i][3]; spiegelt L_SOORT..L_OMS in MAGISTER.py
const RIJ_SOORT = 0;
const RIJ_TEKST = 9;

// Het schermlettertype van de Evo is gemeten op ASCII plus het middenpunt.
// Alles daarbuiten wordt vervangen in plaats van als leeg vakje getekend.
const LOSSE = {
  'ß': 'ss', 'æ': 'ae', 'Æ': 'AE', 'œ': 'oe',
  'Œ': 'OE', 'ø': 'o', 'Ø': 'O', '€': 'EUR',
  '‘': "'", '’': "'", '‚': "'", '“': '"',
  '”': '"', '–': '-', '—': '-', '…': '...',
  ' ': ' ',
};
const MIDDENPUNT = 183;

export function veiligeTekst(s) {
  if (s === null || s === undefined) return '';
  let t = String(s);
  for (const [van, naar] of Object.entries(LOSSE)) t = t.split(van).join(naar);
  t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let uit = '';
  for (const ch of t) {
    const c = ch.codePointAt(0);
    if (c === MIDDENPUNT || (c >= 32 && c <= 126)) uit += ch;
    else if (c === 9 || c === 10 || c === 13) uit += ' ';
  }
  return uit.replace(/\s+/g, ' ').trim();
}

/** Kapt huiswerk af op wat het detailscherm kan tonen, met zichtbare puntjes. */
export function kortHuiswerk(s, max = MAX_HUISWERK) {
  const t = s === null || s === undefined ? '' : String(s);
  if (t.length <= max) return t;
  const ruimte = max - PUNTJES.length;
  const spatie = t.slice(0, ruimte + 1).lastIndexOf(' ');
  // Liever op een woordgrens, maar niet ten koste van een hele regel tekst.
  const kaal = spatie > ruimte - REGEL ? t.slice(0, spatie) : t.slice(0, ruimte);
  return kaal.replace(/[\s,.;:-]+$/, '') + PUNTJES;
}

function kapHuiswerkAf([datum, kop, bijschrift, rijen]) {
  return [datum, kop, bijschrift, rijen.map((rij) => {
    if (rij[RIJ_SOORT] !== 'les' || rij[RIJ_TEKST].length <= MAX_HUISWERK) {
      return rij;
    }
    const uit = rij.slice();
    uit[RIJ_TEKST] = kortHuiswerk(rij[RIJ_TEKST]);
    return uit;
  })];
}

export function pyStr(s) {
  return `"${veiligeTekst(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function pyRij(waarden) {
  return `(${waarden.map(pyStr).join(', ')})`;
}

export function bouwModel({ afspraken, cijferrijen, leerling, nu = new Date(),
  weken = 4 }) {
  const { vakken, periode } = bouwVakken(cijferrijen);
  return {
    tijd: lokaleTijd(nu),
    leerling,
    periode,
    dagen: bouwDagen(afspraken, { vandaag: nu, aantalDagen: weken * 7 })
      .map(kapHuiswerkAf),
    vakken,
  };
}

function schrijfMagdata(model) {
  const r = ['# Gegenereerd door de Magister-extensie. Niet met de hand aanpassen.', ''];
  r.push(`GESYNCT = ${pyStr('gesynct ' + model.tijd)}`);
  // Zonder klok op het apparaat kan deze teller niet oplopen; zie het plan.
  r.push('GESYNCT_UREN = 0');
  r.push(`LEERLING = ${pyStr(model.leerling)}`);
  r.push(`PERIODE = ${pyStr(model.periode || 'dit jaar')}`);
  r.push('', 'DAGEN = [');
  for (const [datum, kop, bijschrift, rijen] of model.dagen) {
    r.push(`(${pyStr(datum)}, ${pyStr(kop)}, ${pyStr(bijschrift)}, [`);
    for (const rij of rijen) r.push(`${pyRij(rij)},`);
    r.push(']),');
  }
  r.push(']', '', 'VAKKEN = [');
  for (const [naam, gemiddelde, cijfers] of model.vakken) {
    r.push(`(${pyStr(naam)}, ${pyStr(gemiddelde)}, [`);
    for (const c of cijfers) r.push(`${pyRij(c)},`);
    r.push(']),');
  }
  r.push(']', '');
  return r.join('\n');
}

const meet = (bron) => new TextEncoder().encode(bron).length;

const teGroot = (bytes) => new Error(`MAGDATA is ${bytes} bytes en past niet: `
  + `er gaan er maximaal ${MAX_BRON} in een programma`);

/** Het hele model als broncode. Gooit als dat niet in een programma past. */
export function genereerMagdata(model) {
  const bron = schrijfMagdata(model);
  const bytes = meet(bron);
  if (bytes > MAX_BRON) throw teGroot(bytes);
  return bron;
}

/**
 * Broncode die gegarandeerd past: past het niet, dan gaan er hele dagen van
 * achteren af. Vandaag is waar het om gaat, de vierde week niet -- een halve
 * sync is een slechter antwoord dan een korter rooster.
 * Geeft { bron, dagen }: dagen is hoeveel dagen het gehaald hebben.
 */
export function passendeMagdata(model) {
  let dagen = model.dagen;
  for (;;) {
    const bron = schrijfMagdata({ ...model, dagen });
    const bytes = meet(bron);
    if (bytes <= MAX_BRON) return { bron, dagen: dagen.length };
    // Onder een dag valt niets meer weg te laten; dan is het wel een fout.
    if (dagen.length <= 1) throw teGroot(bytes);
    dagen = dagen.slice(0, dagen.length - 1);
  }
}
