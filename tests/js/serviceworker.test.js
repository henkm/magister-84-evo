// De service worker beslist waar het paneel opengaat. Chrome faalt hier stil:
// gaat er iets mis, dan doet een klik op het pictogram gewoon niets, zonder
// melding en zonder spoor. Daarom staat er een neppe chrome.* omheen.
import test from 'node:test';
import assert from 'node:assert/strict';

const PANEEL_URL = 'chrome-extension://nep/panel.html';
let teller = 0;

/** Laadt een verse service_worker.js met een neppe chrome.* eromheen. */
async function laadWorker({ contexten = [] } = {}) {
  const gedaan = { gemaakt: [], geactiveerd: [], gefocust: [], gevraagd: null };
  const luisteraars = {};
  globalThis.chrome = {
    runtime: {
      getURL: (pad) => `chrome-extension://nep/${pad}`,
      getContexts: async (filter) => { gedaan.gevraagd = filter; return contexten; },
      onMessage: { addListener: (f) => { luisteraars.bericht = f; } },
    },
    action: { onClicked: { addListener: (f) => { luisteraars.klik = f; } } },
    tabs: {
      create: async ({ url }) => { gedaan.gemaakt.push(url); },
      update: async (id, opties) => { gedaan.geactiveerd.push([id, opties]); },
    },
    windows: {
      update: async (id, opties) => { gedaan.gefocust.push([id, opties]); },
    },
  };
  teller += 1;
  await import(`../../extension/service_worker.js?n=${teller}`);
  return { gedaan, luisteraars };
}

test('een klik op het pictogram opent het paneel in een tabblad', async () => {
  const { gedaan, luisteraars } = await laadWorker();
  await luisteraars.klik();
  assert.deepEqual(gedaan.gemaakt, [PANEEL_URL]);
});

test('een tweede klik springt naar het paneel dat al openstaat', async () => {
  const { gedaan, luisteraars } = await laadWorker({
    contexten: [{ tabId: 12, windowId: 4, documentUrl: PANEEL_URL }],
  });
  await luisteraars.klik();
  assert.deepEqual(gedaan.gemaakt, [], 'een tweede paneel claimt de poort niet');
  assert.deepEqual(gedaan.geactiveerd, [[12, { active: true }]]);
  assert.deepEqual(gedaan.gefocust, [[4, { focused: true }]]);
});

test('het paneel wordt gezocht met getContexts, niet met tabs.query', async () => {
  // tabs.query zou over alle tabs van de gebruiker gaan en vraagt daarvoor de
  // permissie "tabs". getContexts kent alleen de eigen pagina's van de
  // extensie, en dat is precies wat we zoeken.
  const { gedaan, luisteraars } = await laadWorker();
  await luisteraars.klik();
  assert.deepEqual(gedaan.gevraagd,
    { contextTypes: ['TAB'], documentUrls: [PANEEL_URL] });
});

test('een context zonder tabblad telt niet als open paneel', async () => {
  // Het paneel kan ook als offscreen document of popup bestaan; die hebben
  // tabId -1 en daar valt niet naartoe te springen.
  const { gedaan, luisteraars } = await laadWorker({
    contexten: [{ tabId: -1, windowId: -1, documentUrl: PANEEL_URL }],
  });
  await luisteraars.klik();
  assert.deepEqual(gedaan.gemaakt, [PANEEL_URL]);
});

test('het menu-item in de sidebar opent hetzelfde paneel', async () => {
  const { gedaan, luisteraars } = await laadWorker();
  luisteraars.bericht({ type: 'paneel-openen' });
  await new Promise(setImmediate);
  assert.deepEqual(gedaan.gemaakt, [PANEEL_URL]);
});

test('een ander bericht opent niets', async () => {
  const { gedaan, luisteraars } = await laadWorker();
  luisteraars.bericht({ type: 'iets-anders' });
  luisteraars.bericht(null);
  await new Promise(setImmediate);
  assert.deepEqual(gedaan.gemaakt, []);
});
