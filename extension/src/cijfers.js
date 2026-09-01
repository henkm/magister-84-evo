// Cijferoverzicht van Magister -> het VAKKEN-model van de rekenmachine.
// Magister rekent gemiddeldes zelf uit (de berekende kolommen); die nemen we
// over in plaats van de weging van de school te raden.
import { veld } from './magister.js';

const ZONE = 'Europe/Amsterdam';
const fDagMaand = new Intl.DateTimeFormat('nl-NL',
  { timeZone: ZONE, day: '2-digit', month: '2-digit' });

export function getal(s) {
  if (s === null || s === undefined || String(s).trim() === '') return null;
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function soortVoor(rij) {
  if (getal(rij.cijfer) === null) return 'tekst';
  if (rij.voldoende === false) return 'onvoldoende';
  if (rij.voldoende === true) return 'normaal';
  return getal(rij.cijfer) < 5.5 ? 'onvoldoende' : 'normaal';
}

export function metaVoor(rij) {
  const delen = [];
  const d = new Date(rij.datum);
  if (!Number.isNaN(d.getTime())) delen.push(fDagMaand.format(d));
  if (rij.periode) delen.push(rij.periode);
  if (rij.vrijstelling) delen.push('vrijstelling');
  else if (rij.inhalen) delen.push('inhalen');
  else delen.push(rij.teltMee === false ? 'telt niet mee' : 'telt mee');
  return delen.join(' · ');
}

function normaliseer(c) {
  const kolom = veld(c, 'cijferKolom') || {};
  const vak = veld(c, 'vak') || {};
  const periode = veld(c, 'cijferPeriode') || {};
  return {
    cijfer: String(veld(c, 'cijferStr') ?? '').trim(),
    voldoende: veld(c, 'isVoldoende') ?? undefined,
    datum: veld(c, 'datumIngevoerd') || '',
    vak: veld(vak, 'omschrijving') || veld(vak, 'afkorting') || '',
    periode: veld(periode, 'naam') || '',
    kop: veld(kolom, 'kolomKop') || '',
    kolomsoort: Number(veld(kolom, 'kolomSoort') ?? 1),
    teltMee: veld(c, 'teltMee'),
    vrijstelling: Boolean(veld(c, 'vrijstelling')),
    inhalen: Boolean(veld(c, 'inhalen')),
  };
}

export function bouwVakken(rauw) {
  const alle = (rauw || []).map(normaliseer).filter((c) => {
    if (c.vak) return true;
    // Zonder Vak is er geen plek in het VAKKEN-model voor dit cijfer. We slaan
    // de rij over, maar niet stilletjes: anders lijkt een kapotte rij op een
    // vak zonder dat cijfer.
    console.warn('cijfers: cijferrij overgeslagen, geen Vak',
      { kop: c.kop, cijfer: c.cijfer, datum: c.datum });
    return false;
  });
  const gewoon = alle.filter((c) => c.kolomsoort === 1);
  const berekend = alle.filter((c) => c.kolomsoort !== 1);

  const perVak = new Map();
  for (const c of gewoon) {
    if (!perVak.has(c.vak)) perVak.set(c.vak, []);
    perVak.get(c.vak).push(c);
  }

  const gemiddeldes = new Map();
  for (const c of berekend) {
    const huidig = gemiddeldes.get(c.vak);
    // de expliciete GEM-periode wint van elke andere berekende kolom
    if (!huidig || String(c.periode).toUpperCase() === 'GEM') {
      gemiddeldes.set(c.vak, c.cijfer);
    }
  }

  const namen = [...perVak.keys()].sort((a, b) => a.localeCompare(b, 'nl'));
  const vakken = namen.map((naam) => {
    const rijen = perVak.get(naam)
      .slice()
      .sort((a, b) => String(a.datum).localeCompare(String(b.datum)))
      .map((c) => [c.kop, c.cijfer, metaVoor(c), soortVoor(c)]);
    return [naam, gemiddeldes.get(naam) || '', rijen];
  });

  const periodes = [];
  for (const c of gewoon) {
    if (c.periode && !periodes.includes(c.periode)) periodes.push(c.periode);
  }
  periodes.sort();

  return { vakken, periode: periodes.join(' · ') };
}
