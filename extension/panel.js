// Dunne schil: leest het token uit de Magister-tab, roept de pure modules aan
// en rendert de toestand. Neemt zelf geen beslissingen.
import { bouwModel, passendeMagdata } from './src/genereer.js';
import { MagisterFout, maakClient } from './src/magister.js';
import { lokaleDatum } from './src/rooster.js';
import { stuurAlles } from './src/send.js';
import { BEGIN, FOUTEN, cijfersBijschrift, foutknop, gereedSlot, percentage,
  volgende } from './src/stroom.js';
import { SerieelTransport, bestaandePoort, kiesPoort } from './src/transport.js';

// Demostand: panel.html rechtstreeks in een tab geopend heeft geen chrome.*
// en geen Web Serial. Alles wat die nodig heeft, kijkt hier eerst.
const inExtensie = typeof chrome !== 'undefined' && Boolean(chrome.tabs);

const MAGISTER_URL = 'https://magister.net/';
const SVG_NS = 'http://www.w3.org/2000/svg';

let toestand = BEGIN;
// De kaart die op het keuzescherm is aangeklikt maar nog niet bevestigd.
let keuze = null;
// Of er een sync loopt is een feit van deze pagina, geen schermtoestand: na
// afbreken staat het scherm alweer op klaar terwijl de transfer nog loopt.
let bezig = false;
let afbreken = false;

class Afgebroken extends Error {}

function zet(gebeurtenis) {
  toestand = volgende(toestand, gebeurtenis);
}

function ga(gebeurtenis) {
  zet(gebeurtenis);
  render(toestand);
}

/**
 * Draait IN de Magister-tab. Moet zelfstandig zijn: geen imports, geen
 * verwijzingen naar variabelen van buiten.
 */
function leesTokenUitTab() {
  for (const sleutel of Object.keys(sessionStorage)) {
    if (!sleutel.startsWith('oidc.user:')) continue;
    try {
      const u = JSON.parse(sessionStorage.getItem(sleutel));
      if (u && u.access_token) return { token: u.access_token };
    } catch (e) { /* geen bruikbare sleutel, volgende */ }
  }
  return null;
}

// Het token blijft in deze variabele voor de duur van een sync. Niet naar
// chrome.storage, niet naar de console, niet in een foutmelding.
async function haalToken() {
  const tabs = await chrome.tabs.query({ url: 'https://*.magister.net/*' });
  const bruikbaar = tabs.filter((t) => !t.url.startsWith('https://accounts.'));
  for (const tab of bruikbaar) {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id }, func: leesTokenUitTab,
    });
    if (res && res.result) {
      return { token: res.result.token, tenant: new URL(tab.url).hostname };
    }
  }
  throw new MagisterFout('niet-ingelogd', 'Geen ingelogde Magister-tab gevonden.');
}

/**
 * De peildatum voor het cijferoverzicht, of '' als die niet nodig is.
 * Zonder peildatum geeft Magister voor een afgesloten schooljaar
 * {"Items": [], "TotalCount": 0} met status 200 terug: geen fout, geen
 * waarschuwing, gewoon niets. aanmelding() geeft de aanmelding met de laatste
 * begindatum, en dat is de hele zomer lang het jaar dat net afgesloten is.
 */
export function peildatumVoor(aanmelding, nu = new Date()) {
  const tot = String((aanmelding && aanmelding.tot) || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tot)) return '';
  return tot < lokaleDatum(nu) ? tot : '';
}

// Een poort die niet opengaat is geen onbekende fout: het apparaat is weg,
// staat uit, of wordt vastgehouden door een ander venster of door evosend in
// een terminal. In al die gevallen helpt hetzelfde scherm.
async function openTransport(poort) {
  try {
    return await SerieelTransport.open(poort);
  } catch (e) {
    const fout = new Error('de poort van de rekenmachine ging niet open');
    fout.soort = 'geen-rekenmachine';
    throw fout;
  }
}

function stopAlsAfgebroken() {
  if (afbreken) throw new Afgebroken('afgebroken door de gebruiker');
}

const telLessen = (dagen) => dagen.reduce((n, d) =>
  n + d[3].filter((r) => r[0] === 'les').length, 0);

function datumOver(dagen) {
  const d = new Date();
  d.setDate(d.getDate() + dagen);
  return lokaleDatum(d);
}

export async function sync() {
  // Twee syncs tegelijk betekent twee keer open op dezelfde poort. De tweede
  // krijgt dan een InvalidStateError en meldt "er ging iets mis", terwijl de
  // eerste er onderdoor gewoon mee doorgaat.
  if (bezig) return;
  bezig = true;
  afbreken = false;
  const begonnen = Date.now();
  ga({ type: 'sync' });
  let transport = null;
  try {
    const { token, tenant } = await haalToken();
    const client = maakClient({ tenant, token });
    const account = await client.account();
    const persoonId = account.rol === 'ouder' ? toestand.kind.id : account.id;
    const aanmelding = await client.aanmelding(persoonId);
    const afspraken = await client.afspraken(persoonId, lokaleDatum(new Date()),
      datumOver(27));
    const cijferrijen = await client.cijfers(persoonId, aanmelding.id,
      peildatumVoor(aanmelding));

    const model = bouwModel({ afspraken, cijferrijen,
      leerling: toestand.kind ? toestand.kind.naam : '' });
    const cijfers = model.vakken.reduce((n, v) => n + v[2].length, 0);
    ga({ type: 'fase', fase: 'genereren',
      feiten: { lessen: telLessen(model.dagen), cijfers } });

    stopAlsAfgebroken();
    // Past het niet, dan gaan er dagen van achteren af in plaats van dat de
    // hele sync afketst; alleen de dagen die het gehaald hebben tellen mee.
    const { bron: magdata, dagen } = passendeMagdata(model);
    const erop = model.dagen.slice(0, dagen);
    const app = await (await fetch(chrome.runtime.getURL('calc/MAGISTER.py'))).text();

    const poort = await bestaandePoort();
    if (!poort) { ga({ type: 'geenPoort' }); return; }
    stopAlsAfgebroken();
    transport = await openTransport(poort);

    ga({ type: 'fase', fase: 'versturen' });
    // Altijd allebei, MAGISTER eerst: breekt de transfer af tijdens MAGDATA,
    // dan staat de app er al en toont hij zijn eigen "sync opnieuw"-scherm.
    await stuurAlles(transport, [
      { naam: 'MAGISTER', bron: app },
      { naam: 'MAGDATA', bron: magdata },
    ], (gedaan, totaal) => {
      // De enige plek waar een transfer veilig kan stoppen: op een
      // pakketgrens, met een bevestigd pakket erachter.
      stopAlsAfgebroken();
      ga({ type: 'voortgang', gedaan, totaal });
    });

    const tijd = new Date().toTimeString().slice(0, 5);
    await chrome.storage.local.set({ laatsteSync: tijd });
    ga({ type: 'gereed', resultaat: { tijd, cijfers,
      lessen: telLessen(erop),
      seconden: Math.round((Date.now() - begonnen) / 100) / 10,
      tot: erop[erop.length - 1][1], periode: model.periode,
      dagen, gevraagd: model.dagen.length } });
  } catch (e) {
    // Afbreken is geen fout: het scherm staat dan al op klaar.
    if (!(e instanceof Afgebroken)) {
      ga({ type: 'fout', soort: soortVoorFout(e), bron: 'sync',
        details: technischeDetails(e) });
    }
  } finally {
    if (transport) await transport.sluit();
    bezig = false;
  }
}

// leesPakket stelt de enige diagnose die hier echt helpt; deze tekst is de
// draad terug naar de foutsoort die dat op het scherm zet.
const GEEN_ANTWOORD = /geen antwoord van de rekenmachine/;

/**
 * Een korte, feitelijke regel over wat er misging: welke call, welke status.
 * Nooit het token - MagisterFout.details draagt alleen het pad en de status.
 */
function technischeDetails(e) {
  if (!e) return null;
  const d = e.details && typeof e.details === 'object' ? e.details : null;
  if (d && d.pad) {
    return d.status ? `HTTP ${d.status} op ${d.pad}` : `mislukt op ${d.pad}`;
  }
  return e.message ? String(e.message).slice(0, 120) : null;
}

function soortVoorFout(e) {
  // Een fout die zelf weet wat hij is, wint: MagisterFout, en alles waar
  // sync() zelf een soort aan hangt.
  if (e && FOUTEN[e.soort]) return e.soort;
  if (e && e.name === 'NotFoundError') return 'geen-rekenmachine';
  if (e && /65535|past niet/.test(String(e.message))) return 'te-groot';
  // Geen antwoord voordat er ook maar een pakket bevestigd is: dan heeft de
  // rekenmachine nooit meegedaan en staat er dus ook niets half op.
  if (GEEN_ANTWOORD.test(String(e && e.message)) && !toestand.voortgang.gedaan) {
    return 'geen-rekenmachine';
  }
  if (toestand.fase === 'versturen') return 'verbinding-afgebroken';
  return 'onbekend';
}

// --- rendering -------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const SCHERMEN = ['kind-kiezen', 'klaar', 'koppelen', 'bezig', 'gereed', 'fout'];

function render(t) {
  for (const naam of SCHERMEN) $(`s-${naam}`).hidden = naam !== t.scherm;
  $('foutstreep').hidden = t.scherm !== 'fout';

  $('kindchip').hidden = !t.kind || !t.kind.naam || t.scherm === 'kind-kiezen';
  if (t.kind) {
    $('kindinitiaal').textContent = t.kind.naam.slice(0, 1).toUpperCase();
    $('kindnaam').textContent = t.kind.naam;
  }

  const titels = { 'bezig': 'Bezig met syncen', 'gereed': 'Sync klaar' };
  $('koptitel').textContent = t.scherm === 'fout'
    ? FOUTEN[t.fout.soort].titel
    : (titels[t.scherm] || 'Magister naar TI-84');

  if (t.scherm === 'kind-kiezen') toonKindkaarten(t);
  if (t.scherm === 'klaar') {
    $('laatste-sync').textContent = t.laatsteSync
      ? `Laatst gesynct: ${t.laatsteSync}` : 'Nog niet eerder gesynct';
    $('feit-rooster').textContent = 'vier weken vooruit';
    $('feit-cijfers').textContent = 'dit schooljaar';
    $('feit-apparaat').textContent = t.poortBekend
      ? 'TI-84 Evo-T · verbonden' : 'nog niet gekozen';
  }
  if (t.scherm === 'bezig') toonFasen(t);
  if (t.scherm === 'gereed') toonGereed(t);
  if (t.scherm === 'fout') toonFout(t);
}

function vinkje() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'vink');
  svg.setAttribute('viewBox', '0 0 18 18');
  svg.setAttribute('aria-hidden', 'true');
  const pad = document.createElementNS(SVG_NS, 'path');
  pad.setAttribute('d', 'M3.5 9.5 7 13 14.5 5');
  pad.setAttribute('fill', 'none');
  pad.setAttribute('stroke', 'currentColor');
  pad.setAttribute('stroke-width', '2.5');
  pad.setAttribute('stroke-linecap', 'round');
  pad.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(pad);
  return svg;
}

function maakKaart(kind) {
  const kaart = document.createElement('button');
  kaart.className = 'kaart';
  kaart.type = 'button';
  kaart.dataset.id = String(kind.id);
  kaart.setAttribute('aria-pressed', 'false');

  const rondje = document.createElement('span');
  rondje.className = 'rondje';
  rondje.textContent = (kind.naam || '?').slice(0, 1).toUpperCase();

  const wie = document.createElement('span');
  wie.className = 'wie';
  const naam = document.createElement('span');
  naam.className = 'naam';
  naam.textContent = kind.naam;
  wie.appendChild(naam);
  // Magister geeft geen klas of school mee bij een kind; de volledige naam is
  // het enige extra dat twee kinderen uit elkaar houdt.
  if (kind.volledig && kind.volledig !== kind.naam) {
    const school = document.createElement('span');
    school.className = 'school';
    school.textContent = kind.volledig;
    wie.appendChild(school);
  }

  kaart.append(rondje, wie);
  kaart.addEventListener('click', () => { keuze = kind; werkKeuzeBij(); });
  return kaart;
}

function werkKeuzeBij() {
  for (const kaart of $('kindkaarten').children) {
    const aan = Boolean(keuze) && kaart.dataset.id === String(keuze.id);
    kaart.setAttribute('aria-pressed', aan ? 'true' : 'false');
    const bestaand = kaart.querySelector('.vink');
    if (aan && !bestaand) kaart.appendChild(vinkje());
    if (!aan && bestaand) bestaand.remove();
  }
  $('knop-doorgaan').disabled = !keuze;
  $('knop-doorgaan').textContent = keuze
    ? `Doorgaan met ${keuze.naam}` : 'Doorgaan';
}

function toonKindkaarten(t) {
  const houder = $('kindkaarten');
  houder.textContent = '';
  for (const kind of t.kinderen) houder.appendChild(maakKaart(kind));
  werkKeuzeBij();
}

function toonFasen(t) {
  const orde = ['ophalen', 'genereren', 'versturen'];
  const nu = orde.indexOf(t.fase);
  orde.forEach((naam, i) => {
    const li = $(`fase-${naam}`);
    li.className = i < nu ? 'af' : (i === nu ? 'bezig' : '');
  });
  $('fase-ophalen-feit').textContent = t.feiten.lessen !== undefined
    ? `${t.feiten.lessen} lessen, ${t.feiten.cijfers} cijfers` : '';
  const pct = percentage(t);
  $('baan-vulling').style.width = pct === null ? '0%' : `${pct}%`;
  $('baan-percentage').textContent = pct === null ? '' : `${pct}%`;
  $('baan-resterend').textContent = pct === null || pct === 0 ? ''
    : `nog ongeveer ${Math.max(1, Math.round((100 - pct) / 12))} seconden`;
  $('fase-versturen-feit').textContent = t.voortgang.totaal
    ? `${kB(t.voortgang.gedaan)} van ${kB(t.voortgang.totaal)} kB` : '';
}

function toonGereed(t) {
  const r = t.resultaat;
  // t.kind kan in theorie leeg zijn (leerlingaccount zonder onthouden naam);
  // dan geen naam in de kop in plaats van een crash in de renderer.
  const naam = t.kind && t.kind.naam ? t.kind.naam : 'je rooster';
  $('gereed-kop').textContent = `Data van ${naam} staat erop`;
  // Het ontwerp schrijft "3,4 seconden"; een JavaScript-getal komt er met een
  // punt uit.
  const seconden = String(r.seconden).replace('.', ',');
  $('gereed-sub').textContent = `Overgezet om ${r.tijd} · ${seconden} seconden`;
  $('gereed-lessen').textContent = r.lessen;
  $('gereed-lessen-bij').textContent = `lessen · t/m ${r.tot}`;
  $('gereed-cijfers').textContent = r.cijfers;
  $('gereed-cijfers-bij').textContent = cijfersBijschrift(r);
  $('gereed-slot').textContent = gereedSlot(r);
}

const kB = (n) => (n / 1000).toFixed(1).replace('.', ',');

function toonFout(t) {
  const f = FOUTEN[t.fout.soort];
  $('fout-kop').textContent = f.kop;
  $('fout-body').textContent = f.body;
  $('fout-stap').textContent = f.stap;
  $('knop-fout').textContent = foutknop(t).tekst;
  const techniek = t.fout.details;
  $('fout-techniek').hidden = !techniek;
  $('fout-techniek').textContent = techniek || '';
  const pct = t.fout.soort === 'verbinding-afgebroken' ? percentage(t) : null;
  $('fout-baan').hidden = pct === null;
  $('fout-baan-tekst').hidden = pct === null;
  if (pct !== null) {
    $('fout-baan-vulling').style.width = `${pct}%`;
    // Het ontwerp noemt hier ook hoever hij kwam in kB. De foutentabel houdt
    // alleen algemene tekst, dus dat concrete stuk hoort hier.
    $('fout-baan-tekst').textContent = `afgebroken op ${pct}% `
      + `- ${kB(t.voortgang.gedaan)} van ${kB(t.voortgang.totaal)} kB`;
  }
}

// --- knoppen ---------------------------------------------------------------

// Alleen de keuze wordt onthouden. Nooit het token.
async function bewaarKind(kind) {
  if (!inExtensie) return;
  await chrome.storage.local.set({ kindId: kind.id, kindNaam: kind.naam });
}

function naarKindKiezen() {
  keuze = toestand.kind;
  ga({ type: 'anderKind' });
}

function openMagister() {
  if (!inExtensie) return;
  chrome.tabs.create({ url: MAGISTER_URL });
}

// Moet uit een klik komen: navigator.serial.requestPort eist een gebaar van de
// gebruiker. Daarom staat er voor de aanroep niets dat op iets wacht.
async function vraagPoort() {
  if (!inExtensie) return;
  try {
    await kiesPoort();
    ga({ type: 'poort' });
  } catch (e) {
    // Het venster van Chrome is gesloten zonder te kiezen, of er stond geen
    // apparaat in de lijst. Dezelfde uitleg, met een knop die het opnieuw doet.
    ga({ type: 'fout', soort: 'geen-rekenmachine' });
  }
}

// foutknop() in stroom.js kiest welke actie erbij hoort; hier staat alleen
// hoe die actie eruitziet. "Opnieuw proberen" doet echt opnieuw wat er misging.
const ACTIES = {
  magister: () => {
    openMagister();
    // De tab staat nu open; zonder deze stap belooft de tekst "kom hier terug"
    // iets wat de knop niet meer kan waarmaken.
    ga({ type: 'fout', soort: 'niet-ingelogd', bron: toestand.fout.bron,
      geopend: true });
  },
  poort: vraagPoort,
  anderKind: naarKindKiezen,
  sluiten: () => window.close(),
  // dezelfde grens als knop-sync: in de demostand is er geen chrome.* om mee
  // te praten
  herstart: () => { if (inExtensie) start(); },
  sync: () => { if (inExtensie) sync(); },
};

let gekoppeld = false;

function koppelKnoppen() {
  // start() mag na een fout opnieuw draaien; de knoppen blijven dezelfde.
  if (gekoppeld) return;
  gekoppeld = true;
  $('knop-doorgaan').addEventListener('click', async () => {
    if (!keuze) return;
    const kind = keuze;
    await bewaarKind(kind);
    ga({ type: 'kies', kind });
  });
  $('knop-sync').addEventListener('click', () => { if (inExtensie) sync(); });
  $('knop-ander-kind').addEventListener('click', naarKindKiezen);
  $('knop-nog-een-kind').addEventListener('click', naarKindKiezen);
  $('knop-kies-poort').addEventListener('click', vraagPoort);
  $('knop-afbreken').addEventListener('click', () => {
    // De transfer stopt bij het volgende pakket; het scherm wacht daar niet op.
    afbreken = true;
    ga({ type: 'afbreken' });
  });
  $('knop-sluiten').addEventListener('click', () => window.close());
  $('knop-fout').addEventListener('click', () => ACTIES[foutknop(toestand).actie]());
}

// --- opstarten -------------------------------------------------------------

export async function start() {
  koppelKnoppen();
  const bewaard = await chrome.storage.local.get(
    ['kindId', 'kindNaam', 'laatsteSync']);
  let kinderen = [];
  let kind = bewaard.kindId
    ? { id: bewaard.kindId, naam: bewaard.kindNaam } : null;
  const poortBekend = Boolean(await bestaandePoort());
  // Wat al bekend is gaat er meteen in: mislukt het hieronder, dan staat het
  // foutscherm er met het onthouden kind en kan de knop het echt opnieuw
  // proberen. Nog niet renderen -- anders flitst er een scherm voorbij dat
  // meteen weer weg is.
  zet({ type: 'start', kinderen: kind ? [kind] : [], kind,
    laatsteSync: bewaard.laatsteSync, poortBekend });
  try {
    const { token, tenant } = await haalToken();
    const client = maakClient({ tenant, token });
    const account = await client.account();
    if (account.rol === 'ouder') {
      kinderen = await client.kinderen(account.id);
      // een onthouden kind dat niet meer bij dit account hoort vervalt
      if (kind && !kinderen.some((k) => k.id === kind.id)) kind = null;
    } else {
      // een leerlingaccount is zijn eigen kind; er valt niets te kiezen
      kind = { id: account.id, naam: bewaard.kindNaam || '' };
      kinderen = [kind];
    }
  } catch (e) {
    ga({ type: 'fout', soort: soortVoorFout(e), bron: 'start',
      details: technischeDetails(e) });
    return;
  }
  keuze = kind;
  ga({ type: 'start', kinderen, kind, laatsteSync: bewaard.laatsteSync,
    poortBekend });
}

const DEMO = {
  kinderen: [{ id: 1, naam: 'Fenna' }, { id: 2, naam: 'Sem' }],
  kind: { id: 1, naam: 'Fenna' },
  laatsteSync: 'vandaag 07:41',
};

function demo() {
  // ?scherm=bezig, ?scherm=fout&soort=geen-rekenmachine, enzovoort
  koppelKnoppen();
  const p = new URLSearchParams(location.search);
  let t = volgende(BEGIN, { type: 'start', ...DEMO });
  t.poortBekend = true;
  const scherm = p.get('scherm') || 'klaar';
  if (scherm === 'kind-kiezen') t = volgende(t, { type: 'anderKind' });
  if (scherm === 'koppelen') t = volgende(t, { type: 'geenPoort' });
  if (scherm === 'bezig') {
    t = volgende(t, { type: 'sync' });
    t = volgende(t, { type: 'fase', fase: 'versturen',
      feiten: { lessen: 42, cijfers: 41 } });
    t = volgende(t, { type: 'voortgang', gedaan: 11800, totaal: 21400 });
  }
  if (scherm === 'gereed') {
    t = volgende(t, { type: 'gereed', resultaat: { tijd: '09:12', seconden: 3.4,
      lessen: 42, cijfers: 41, tot: 'vr 11-09', periode: 'P1 · P2',
      dagen: 28, gevraagd: 28 } });
  }
  if (scherm === 'fout') {
    t = volgende(t, { type: 'sync' });
    t = volgende(t, { type: 'fase', fase: 'versturen' });
    t = volgende(t, { type: 'voortgang', gedaan: 11800, totaal: 21400 });
    t = volgende(t, { type: 'fout',
      soort: p.get('soort') || 'verbinding-afgebroken' });
  }
  keuze = t.kind;
  toestand = t;
  render(toestand);
}

if (!inExtensie) {
  document.addEventListener('DOMContentLoaded', demo);
} else {
  document.addEventListener('DOMContentLoaded', start);
}
