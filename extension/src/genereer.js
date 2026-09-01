// Model -> MAGDATA.py. Python's eigen parser is het dataformaat: geen eigen
// serialisatie, en de rekenmachine heeft geen json-module nodig.
import { bouwVakken } from './cijfers.js';
import { bouwDagen, lokaleTijd } from './rooster.js';

// De programmacontainer heeft een 16-bits lengteveld voor de broncode.
export const MAX_BRON = 65535;

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
    dagen: bouwDagen(afspraken, { vandaag: nu, aantalDagen: weken * 7 }),
    vakken,
  };
}

export function genereerMagdata(model) {
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

  const bron = r.join('\n');
  const bytes = new TextEncoder().encode(bron).length;
  if (bytes > MAX_BRON) {
    throw new Error(`MAGDATA is ${bytes} bytes en past niet: er gaan er `
      + `maximaal ${MAX_BRON} in een programma`);
  }
  return bron;
}
