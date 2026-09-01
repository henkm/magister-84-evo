// De naad tussen de modules: panel.js zelf, in een neppe browser.
// De losse modules zijn elk apart getest; wat hier misgaat, gaat mis in de
// volgorde waarin het paneel ze aanroept.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adem, laadPaneel, nepOmgeving, nepPoort, totScherm,
} from './paneelomgeving.js';

async function paneelKlaar(opties) {
  const omgeving = nepOmgeving(opties);
  const paneel = await laadPaneel(omgeving);
  await paneel.start();
  return { omgeving, paneel, dom: omgeving.dom };
}

test('een gewone sync zet beide programmas op de rekenmachine', async () => {
  const { omgeving, dom } = await paneelKlaar();
  assert.equal(dom.scherm(), 'klaar');
  dom.knop('knop-sync').klik();
  await totScherm(dom, 'gereed');
  assert.equal(dom.tekst('gereed-kop'), 'Data van Fenna staat erop');
  assert.ok(omgeving.poort.geschreven.length > 8, 'er is te weinig verstuurd');
  assert.ok(omgeving.opgeslagen.laatsteSync, 'de synctijd hoort onthouden');
  assert.equal(omgeving.poort.dicht, true, 'de poort hoort weer dicht');
});

// --- 1 · een mislukte start is geen doodlopende weg ------------------------

test('een mislukte start houdt het onthouden kind vast', async () => {
  // 401 op /api/account: een Magister-token gaat na ongeveer een uur stuk,
  // dus dit is de fout die het vaakst voorkomt.
  const { omgeving, dom } = await paneelKlaar({ status: { '/api/account': 401 } });
  assert.equal(dom.scherm(), 'fout');
  assert.equal(dom.tekst('fout-kop'), 'Je Magister-sessie is verlopen');
  assert.equal(dom.tekst('kindnaam'), 'Fenna',
    'het onthouden kind is al gelezen en hoort niet weg te vallen');
  assert.equal(omgeving.dom.el('kindchip').hidden, false);
});

test('de knop op een startfout doet de start echt opnieuw', async () => {
  const { omgeving, dom } = await paneelKlaar({ status: { '/api/account': 401 } });
  assert.match(dom.tekst('knop-fout'), /opnieuw/i);
  omgeving.status = {};                       // de gebruiker logt opnieuw in
  dom.knop('knop-fout').klik();
  await totScherm(dom, 'klaar');
  // en van daaruit werkt de sync gewoon, in plaats van te struikelen over
  // een kind dat er nooit in is gezet
  dom.knop('knop-sync').klik();
  await totScherm(dom, 'gereed');
});

test('niet ingelogd opent Magister en biedt daarna een weg terug', async () => {
  const { omgeving, dom } = await paneelKlaar({ tabs: [] });
  assert.equal(dom.tekst('fout-kop'), 'Je bent niet ingelogd bij Magister');
  assert.equal(dom.tekst('knop-fout'), 'Magister openen');
  dom.knop('knop-fout').klik();
  await adem();
  assert.deepEqual(omgeving.geopendeTabs, ['https://magister.net/']);
  assert.match(dom.tekst('knop-fout'), /opnieuw/i,
    'zonder weg terug kan de gebruiker alleen het venster nog sluiten');
});

// --- 2 · afbreken breekt af ------------------------------------------------

test('afbreken stopt de transfer bij het volgende pakket', async () => {
  const heel = await paneelKlaar();
  heel.dom.knop('knop-sync').klik();
  await totScherm(heel.dom, 'gereed');
  const alles = heel.omgeving.poort.geschreven.length;

  const { omgeving, dom } = await paneelKlaar({
    poort: nepPoort({ opSchrijf: (n) => {
      if (n === 8) dom.knop('knop-afbreken').klik();
    } }),
  });
  dom.knop('knop-sync').klik();
  await totScherm(dom, 'klaar');
  for (let i = 0; i < 200; i++) await adem();   // een doorlopende transfer
  assert.ok(omgeving.poort.geschreven.length < alles,
    `er is doorgeschreven: ${omgeving.poort.geschreven.length} van ${alles}`);
  assert.equal(dom.scherm(), 'klaar', 'afbreken is geen fout');
  assert.equal(omgeving.poort.dicht, true, 'de poort hoort weer dicht');
});

test('nog eens syncen tijdens een sync opent de poort geen tweede keer', async () => {
  let los = null;
  const { omgeving, dom } = await paneelKlaar({
    poort: nepPoort({ opSchrijf: (n) => (n === 4
      ? new Promise((res) => { los = res; }) : undefined) }),
  });
  dom.knop('knop-sync').klik();
  for (let i = 0; i < 500 && !los; i++) await adem();
  assert.ok(los, 'de transfer is nooit op gang gekomen');
  dom.knop('knop-sync').klik();                 // ongeduldige gebruiker
  await adem();
  assert.equal(omgeving.poort.aantalOpen, 1, 'de poort ging twee keer open');
  assert.equal(dom.scherm(), 'bezig');
  los();
  await totScherm(dom, 'gereed');
  // Twee keer open hoort erbij: een verbinding per programma, en niet meer --
  // de tweede klik heeft er geen derde bij gemaakt.
  assert.equal(omgeving.poort.aantalOpen, 2);
});

// --- 3 · een stille rekenmachine is geen halve transfer --------------------

test('een poort die niet opengaat is een rekenmachine die niet aan staat', async () => {
  const { dom } = await paneelKlaar({
    poort: nepPoort({ faalOpen: new DOMException('Failed to open serial port.',
      'InvalidStateError') }),
  });
  dom.knop('knop-sync').klik();
  await totScherm(dom, 'fout');
  assert.equal(dom.tekst('fout-kop'), 'Geen rekenmachine gevonden');
  assert.match(dom.tekst('fout-stap'), /beginscherm/);
});

test('een rekenmachine die niet antwoordt is geen halve transfer', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'],
    now: new Date('2026-09-01T09:12:00Z') });
  const { omgeving, dom } = await paneelKlaar({
    poort: nepPoort({ antwoordt: false }),
  });
  dom.knop('knop-sync').klik();
  for (let i = 0; i < 500 && !omgeving.poort.geschreven.length; i++) await adem();
  assert.equal(omgeving.poort.geschreven.length, 1, 'alleen send-init');
  for (let i = 0; i < 20; i++) await adem();
  t.mock.timers.tick(20000);
  await totScherm(dom, 'fout');
  assert.equal(dom.tekst('fout-kop'), 'Geen rekenmachine gevonden',
    'er is niets bevestigd, dus staat er ook niets half op');
  assert.equal(dom.el('fout-baan').hidden, true);
});

// --- 4 · peildatum ---------------------------------------------------------

test('peildatum hoort bij een afgesloten schooljaar, niet bij het lopende', async () => {
  const { paneel } = await paneelKlaar();
  const nu = new Date('2026-08-31T10:00:00Z');
  assert.equal(paneel.peildatumVoor({ van: '2025-08-01', tot: '2026-07-31' }, nu),
    '2026-07-31');
  assert.equal(
    paneel.peildatumVoor({ van: '2025-08-01', tot: '2026-07-31T00:00:00Z' }, nu),
    '2026-07-31', 'Magister geeft de datum ook als tijdstip terug');
  assert.equal(paneel.peildatumVoor({ van: '2026-08-01', tot: '2027-07-31' }, nu),
    '', 'het lopende jaar heeft er geen nodig');
  assert.equal(paneel.peildatumVoor({ van: '2026-08-01', tot: '' }, nu), '');
});

test('een afgesloten schooljaar wordt met peildatum opgevraagd', async () => {
  // zonder peildatum geeft Magister hier {"Items":[],"TotalCount":0} met een
  // status 200: geen fout, geen waarschuwing, gewoon niets
  const { omgeving, dom } = await paneelKlaar({
    aanmeldingen: [{ Id: 900, Begin: '2019-08-01', Einde: '2020-07-31' }],
  });
  dom.knop('knop-sync').klik();
  await totScherm(dom, 'gereed');
  const url = omgeving.opgevraagd.find((u) => u.includes('cijferoverzicht'));
  assert.match(url, /&peildatum=2020-07-31$/);
});

test('het lopende schooljaar krijgt geen peildatum mee', async () => {
  const { omgeving, dom } = await paneelKlaar();
  dom.knop('knop-sync').klik();
  await totScherm(dom, 'gereed');
  const url = omgeving.opgevraagd.find((u) => u.includes('cijferoverzicht'));
  assert.equal(url.includes('peildatum'), false);
});

test('nul cijfers is een geslaagde sync zonder los scheidingsteken', async () => {
  const { dom } = await paneelKlaar({ cijfers: [] });
  dom.knop('knop-sync').klik();
  await totScherm(dom, 'gereed');
  assert.equal(dom.tekst('gereed-cijfers'), '0');
  const bij = dom.tekst('gereed-cijfers-bij');
  assert.equal(bij.trim().endsWith('·'), false, `"${bij}" bungelt`);
  assert.match(bij, /cijfers/);
});

test('een fout van Magister noemt welke call het was en welke status', async () => {
  // Zonder deze regel is een 500 op afspraken niet te onderscheiden van een
  // 500 op cijfers, en moet je de ontwikkelaarsconsole erbij halen om te zien
  // waar het misging.
  const { dom } = await paneelKlaar({ status: { '/afspraken': 500 } });
  dom.knop('knop-sync').klik();
  await totScherm(dom, 'fout');

  const regel = dom.tekst('fout-techniek');
  assert.match(regel, /HTTP 500/);
  assert.match(regel, /afspraken/);
  assert.ok(!regel.includes('geheim'), 'het token hoort hier nooit in');
});

test('ook een verlopen sessie noemt de call waarop het misging', async () => {
  const { dom } = await paneelKlaar({ status: { '/api/account': 401 } });
  await totScherm(dom, 'fout');
  assert.equal(dom.el('fout-techniek').hidden, false);
  assert.match(dom.tekst('fout-techniek'), /HTTP 401 op \/api\/account/);
});

// --- koppelen: het filter mag de rekenmachine niet wegfilteren -------------

test('de eerste keuze gaat met filter, de tweede zonder', async () => {
  // Geen enkele poort: de sync loopt tot het koppelscherm en de keuze mislukt
  // daarna met NotFoundError -- precies wat Chrome geeft als de lijst leeg is
  // of de gebruiker het venster sluit.
  const { omgeving, dom } = await paneelKlaar({ poort: null });
  dom.knop('knop-sync').klik();
  await totScherm(dom, 'koppelen');

  dom.knop('knop-kies-poort').klik();
  await totScherm(dom, 'fout');
  assert.equal(dom.tekst('fout-kop'), 'Geen rekenmachine gevonden');
  assert.deepEqual(omgeving.keuzes[0], { filters: [{ usbVendorId: 0x0451,
    usbProductId: 0xE018 }] }, 'de eerste poging hoort gefilterd te zijn');
  // Zonder de naam van de fout op het scherm is een lege lijst niet te
  // onderscheiden van een pagina die Web Serial helemaal niet heeft.
  assert.match(dom.tekst('fout-techniek'), /NotFoundError/);
  assert.equal(dom.el('fout-techniek').hidden, false);
  assert.match(dom.tekst('fout-techniek'), /alle seriele poorten/);

  dom.knop('knop-fout').klik();
  for (let i = 0; i < 10; i++) await adem();
  assert.equal(omgeving.keuzes.length, 2);
  assert.deepEqual(omgeving.keuzes[1], {}, 'de tweede poging hoort ongefilterd');
  assert.doesNotMatch(dom.tekst('fout-techniek'), /alle seriele poorten/,
    'na een ongefilterde poging is er niets ruimers meer te proberen');
});

test('een geslaagde keuze brengt je terug op het klaarscherm', async () => {
  const { omgeving, dom } = await paneelKlaar({ poort: null });
  dom.knop('knop-sync').klik();
  await totScherm(dom, 'koppelen');
  omgeving.poort = nepPoort();               // de gebruiker sluit hem aan
  dom.knop('knop-kies-poort').klik();
  await totScherm(dom, 'klaar');
});

test('een eerder toegestane vreemde poort wint niet van de rekenmachine', async () => {
  // Wie ooit een Arduino of een bluetoothpoort heeft toegestaan, houdt die in
  // navigator.serial.getPorts(). De eerste pakken is dan de verkeerde.
  const vreemd = nepPoort({ info: { usbVendorId: 0x2341, usbProductId: 0x0043 } });
  const echt = nepPoort();
  const { dom } = await paneelKlaar({ poorten: [vreemd, echt] });
  dom.knop('knop-sync').klik();
  await totScherm(dom, 'gereed');
  assert.equal(vreemd.aantalOpen, 0, 'de vreemde poort hoort dicht te blijven');
  assert.ok(echt.geschreven.length > 8, 'er is niets naar de TI gegaan');
});

test('Klaar sluit het eigen tabblad, niet niets', async () => {
  // window.close() werkt niet op een tabblad dat de extensie zelf heeft
  // geopend; dan doet de knop stilzwijgend niets.
  const { omgeving, dom } = await paneelKlaar();
  dom.knop('knop-sync').klik();
  await totScherm(dom, 'gereed');
  dom.knop('knop-sluiten').klik();
  for (let i = 0; i < 5; i++) await adem();
  assert.deepEqual(omgeving.geslotenTabs, [99]);
  assert.ok(!omgeving.gesloten, 'window.close() is de verkeerde weg in een tab');
});
