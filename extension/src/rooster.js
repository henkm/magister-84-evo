// Magister-afspraken -> het DAGEN-model van de rekenmachine.
// De rekenmachine heeft geen tijdzones en rekent niets uit; alles gebeurt hier.
import { veld } from './magister.js';

const ZONE = 'Europe/Amsterdam';
const fDatum = new Intl.DateTimeFormat('en-CA',
  { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const fTijd = new Intl.DateTimeFormat('nl-NL',
  { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hour12: false });
const fDag = new Intl.DateTimeFormat('nl-NL', { timeZone: ZONE, weekday: 'short' });
const fDagMaand = new Intl.DateTimeFormat('nl-NL',
  { timeZone: ZONE, day: '2-digit', month: '2-digit' });

export function lokaleDatum(d) { return fDatum.format(d); }
export function lokaleTijd(d) { return fTijd.format(d); }
export function weekdag(d) { return fDag.format(d).replace('.', ''); }
export function isWeekend(d) { return weekdag(d) === 'za' || weekdag(d) === 'zo'; }
export function kopDatum(d) { return `${weekdag(d)} ${fDagMaand.format(d)}`; }

export function platteTekst(html) {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|tr|h\d)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function chipVoor(status, infotype) {
  if (status === 'vervallen') return 'VERVALT';
  if (status === 'gewijzigd') return 'GEWIJZIGD';
  if (infotype >= 2 && infotype <= 5) return 'TOETS';
  if (infotype === 1) return 'HW';
  return '';
}

const STATUS = { 2: 'gewijzigd', 3: 'vervallen' };

export function normaliseer(a) {
  const vakken = veld(a, 'vakken') || [];
  const docenten = veld(a, 'docenten') || [];
  const lokalen = veld(a, 'lokalen') || [];
  const docent = docenten[0] || {};
  const code = veld(docent, 'docentcode');
  const naam = veld(docent, 'naam') || '';
  const oms = veld(a, 'omschrijving') || '';
  const vak = veld(vakken[0] || {}, 'naam') || oms;
  return {
    start: new Date(veld(a, 'start')),
    eind: new Date(veld(a, 'einde')),
    van: Number(veld(a, 'lesuurVan') || 0),
    tot: Number(veld(a, 'lesuurTotMet') || veld(a, 'lesuurVan') || 0),
    vak,
    lokaal: veld(lokalen[0] || {}, 'naam') || veld(a, 'lokatie') || '',
    docent: naam && code ? `${naam} (${code})` : naam,
    status: STATUS[Number(veld(a, 'status'))] || 'normaal',
    infotype: Number(veld(a, 'infoType') || 0),
    tekst: platteTekst(veld(a, 'inhoud')),
    oms: oms === vak ? '' : oms,
  };
}

function uurLabel(van, tot) {
  if (!van) return '';
  return tot > van ? `${van}-${tot}` : String(van);
}

function rijenVoorDag(lessen) {
  const uit = [];
  for (let i = 0; i < lessen.length; i++) {
    const l = lessen[i];
    const vorige = lessen[i - 1];
    if (vorige && l.van && vorige.tot && l.van > vorige.tot + 1) {
      uit.push(['gat', lokaleTijd(vorige.eind), lokaleTijd(l.start), '',
        '', '', '', 'normaal', '', '', '']);
    }
    uit.push(['les', lokaleTijd(l.start), lokaleTijd(l.eind),
      uurLabel(l.van, l.tot), l.vak, l.lokaal, l.docent, l.status,
      chipVoor(l.status, l.infotype), l.tekst, l.oms]);
  }
  return uit;
}

function bijschriftVoor(i, weekend, aantal) {
  if (i === 0) return 'vandaag';
  if (aantal === 0) return weekend ? 'weekend' : 'vakantie';
  if (i === 1) return 'morgen';
  return aantal === 1 ? '1 les' : `${aantal} lessen`;
}

/**
 * Bouwt de dagenlijst. `vandaag` mag een Date of "YYYY-MM-DD" zijn.
 * De reeks loopt via 12:00 UTC, zodat een zomer-wintertijdovergang nooit een
 * kalenderdag overslaat of verdubbelt.
 */
export function bouwDagen(afspraken, { vandaag, aantalDagen = 28 } = {}) {
  const start = typeof vandaag === 'string' ? vandaag : lokaleDatum(vandaag);
  const [jaar, maand, dag] = start.split('-').map(Number);

  const perDatum = new Map();
  for (const a of afspraken) {
    const n = normaliseer(a);
    if (Number.isNaN(n.start.getTime())) continue;
    const sleutel = lokaleDatum(n.start);
    if (!perDatum.has(sleutel)) perDatum.set(sleutel, []);
    perDatum.get(sleutel).push(n);
  }
  for (const lijst of perDatum.values()) lijst.sort((a, b) => a.start - b.start);

  const uit = [];
  for (let i = 0; i < aantalDagen; i++) {
    const t = new Date(Date.UTC(jaar, maand - 1, dag + i, 12));
    const iso = lokaleDatum(t);
    const lessen = perDatum.get(iso) || [];
    uit.push([iso, kopDatum(t), bijschriftVoor(i, isWeekend(t), lessen.length),
      rijenVoorDag(lessen)]);
  }
  return uit;
}
