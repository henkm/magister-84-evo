// Dunne schil: leest het token uit de Magister-tab, roept de pure modules aan
// en rendert de toestand. Neemt zelf geen beslissingen.
import { bouwModel, genereerMagdata } from './src/genereer.js';
import { MagisterFout, maakClient } from './src/magister.js';
import { lokaleDatum } from './src/rooster.js';
import { stuurAlles } from './src/send.js';
import { BEGIN, FOUTEN, percentage, volgende } from './src/stroom.js';
import { SerieelTransport, bestaandePoort, kiesPoort } from './src/transport.js';

// Demostand: panel.html rechtstreeks in een tab geopend heeft geen chrome.*
// en geen Web Serial. Alles wat die nodig heeft, kijkt hier eerst.
const inExtensie = typeof chrome !== 'undefined' && Boolean(chrome.tabs);

const MAGISTER_URL = 'https://magister.net/';
const SVG_NS = 'http://www.w3.org/2000/svg';

let toestand = BEGIN;
// De kaart die op het keuzescherm is aangeklikt maar nog niet bevestigd.
let keuze = null;

function ga(gebeurtenis) {
  toestand = volgende(toestand, gebeurtenis);
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

function datumOver(dagen) {
  const d = new Date();
  d.setDate(d.getDate() + dagen);
  return lokaleDatum(d);
}

async function sync() {
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
    const cijferrijen = await client.cijfers(persoonId, aanmelding.id);

    const model = bouwModel({ afspraken, cijferrijen,
      leerling: toestand.kind ? toestand.kind.naam : '' });
    const lessen = model.dagen.reduce((n, d) =>
      n + d[3].filter((r) => r[0] === 'les').length, 0);
    const cijfers = model.vakken.reduce((n, v) => n + v[2].length, 0);
    ga({ type: 'fase', fase: 'genereren', feiten: { lessen, cijfers } });

    const magdata = genereerMagdata(model);
    const app = await (await fetch(chrome.runtime.getURL('calc/MAGISTER.py'))).text();

    const poort = await bestaandePoort();
    if (!poort) { ga({ type: 'geenPoort' }); return; }
    transport = await SerieelTransport.open(poort);

    ga({ type: 'fase', fase: 'versturen' });
    // Altijd allebei, MAGISTER eerst: breekt de transfer af tijdens MAGDATA,
    // dan staat de app er al en toont hij zijn eigen "sync opnieuw"-scherm.
    await stuurAlles(transport, [
      { naam: 'MAGISTER', bron: app },
      { naam: 'MAGDATA', bron: magdata },
    ], (gedaan, totaal) => ga({ type: 'voortgang', gedaan, totaal }));

    const tijd = new Date().toTimeString().slice(0, 5);
    await chrome.storage.local.set({ laatsteSync: tijd });
    ga({ type: 'gereed', resultaat: { tijd, lessen, cijfers,
      seconden: Math.round((Date.now() - begonnen) / 100) / 10,
      tot: model.dagen[model.dagen.length - 1][1], periode: model.periode } });
  } catch (e) {
    ga({ type: 'fout', soort: soortVoorFout(e) });
  } finally {
    if (transport) await transport.sluit();
  }
}

function soortVoorFout(e) {
  if (e instanceof MagisterFout) return e.soort;
  if (e && e.name === 'NotFoundError') return 'geen-rekenmachine';
  if (e && /65535|past niet/.test(String(e.message))) return 'te-groot';
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
  $('gereed-cijfers-bij').textContent = `cijfers · ${r.periode}`;
  $('gereed-slot').textContent = `Op de rekenmachine staat bovenaan `
    + `"gesynct ${r.tijd}". Klopt het rooster niet? Controleer of hierboven de `
    + 'juiste naam staat.';
}

const kB = (n) => (n / 1000).toFixed(1).replace('.', ',');

function toonFout(t) {
  const f = FOUTEN[t.fout.soort];
  $('fout-kop').textContent = f.kop;
  $('fout-body').textContent = f.body;
  $('fout-stap').textContent = f.stap;
  $('knop-fout').textContent = f.knop;
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

// De knop op het foutscherm doet wat zijn eigen tekst belooft. FOUTEN kent per
// soort een andere knoptekst, dus een vaste actie zou daar tegenin gaan:
// "Ander kind" en "Sluiten" horen geen nieuwe poging te starten.
const FOUTACTIE = {
  'niet-ingelogd': openMagister,
  'geen-rekenmachine': vraagPoort,
  'geen-aanmelding': naarKindKiezen,
  'te-groot': () => window.close(),
};

function koppelKnoppen() {
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
  $('knop-afbreken').addEventListener('click', () => ga({ type: 'afbreken' }));
  $('knop-sluiten').addEventListener('click', () => window.close());
  $('knop-fout').addEventListener('click', () => {
    const soort = toestand.fout ? toestand.fout.soort : 'onbekend';
    const doen = FOUTACTIE[soort];
    if (doen) doen(); else ga({ type: 'opnieuw' });
  });
}

// --- opstarten -------------------------------------------------------------

async function start() {
  koppelKnoppen();
  const bewaard = await chrome.storage.local.get(
    ['kindId', 'kindNaam', 'laatsteSync']);
  let kinderen = [];
  let kind = bewaard.kindId
    ? { id: bewaard.kindId, naam: bewaard.kindNaam } : null;
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
    ga({ type: 'fout', soort: soortVoorFout(e) });
    return;
  }
  keuze = kind;
  ga({ type: 'start', kinderen, kind, laatsteSync: bewaard.laatsteSync,
    poortBekend: Boolean(await bestaandePoort()) });
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
      lessen: 42, cijfers: 41, tot: 'vr 11-09', periode: 'P1 · P2' } });
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
