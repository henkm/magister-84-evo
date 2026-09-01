import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MagisterFout, maakClient, rijen, veld } from '../../extension/src/magister.js';

const fixture = (naam) => JSON.parse(
  readFileSync(new URL(`../fixtures/${naam}.json`, import.meta.url), 'utf8'));

/** Neemt een lijst [urlpatroon, antwoord] en onthoudt welke urls zijn opgevraagd. */
function nepHaal(routes) {
  const opgevraagd = [];
  const haal = async (url, opties) => {
    opgevraagd.push({ url, opties });
    for (const [patroon, antwoord] of routes) {
      if (url.includes(patroon)) {
        if (typeof antwoord === 'number') {
          return { ok: false, status: antwoord, json: async () => ({}) };
        }
        if (antwoord === KAPOT) {
          return { ok: true, status: 200,
            json: async () => { throw new SyntaxError('Unexpected token <'); } };
        }
        return { ok: true, status: 200, json: async () => antwoord };
      }
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  haal.opgevraagd = opgevraagd;
  return haal;
}

/** Markeert een route waarvan de body geen JSON is (een inlogpagina bijvoorbeeld). */
const KAPOT = Symbol('kapotte body');

test('beide schrijfwijzen van de API worden gelezen', () => {
  assert.deepEqual(rijen({ Items: [1, 2] }), [1, 2]);
  assert.deepEqual(rijen({ items: [3] }), [3]);
  assert.deepEqual(rijen({}), []);
  assert.deepEqual(rijen(null), []);
  assert.equal(veld({ Naam: 'a' }, 'naam'), 'a');
  assert.equal(veld({ naam: 'b' }, 'naam'), 'b');
  assert.equal(veld({}, 'naam'), undefined);
});

test('een ouderaccount wordt herkend', async () => {
  const c = maakClient({ tenant: 'school.magister.net', token: 'x',
    haal: nepHaal([['/api/account', fixture('account-ouder')]]) });
  assert.deepEqual(await c.account(), { id: 5001, rol: 'ouder' });
});

test('een leerlingaccount wordt herkend', async () => {
  const c = maakClient({ tenant: 'school.magister.net', token: 'x',
    haal: nepHaal([['/api/account', fixture('account-leerling')]]) });
  assert.deepEqual(await c.account(), { id: 6002, rol: 'leerling' });
});

test('kinderen komen met roepnaam terug', async () => {
  const c = maakClient({ tenant: 'school.magister.net', token: 'x',
    haal: nepHaal([['/kinderen', fixture('kinderen')]]) });
  const k = await c.kinderen(5001);
  assert.deepEqual(k.map((x) => [x.id, x.naam]), [[6002, 'Fenna'], [6003, 'Sem']]);
});

test('de lopende aanmelding is de laatst begonnen', async () => {
  const c = maakClient({ tenant: 'school.magister.net', token: 'x',
    haal: nepHaal([['/aanmeldingen', fixture('aanmeldingen')]]) });
  const a = await c.aanmelding(6002);
  assert.equal(a.id, 88001);
  assert.equal(a.studie, '4 havo');
});

test('het token gaat mee als Bearer en staat nergens in de url', async () => {
  const haal = nepHaal([['/api/account', fixture('account-ouder')]]);
  const c = maakClient({ tenant: 'school.magister.net', token: 'geheim', haal });
  await c.account();
  const { url, opties } = haal.opgevraagd[0];
  assert.equal(opties.headers.Authorization, 'Bearer geheim');
  assert.ok(!url.includes('geheim'), 'token mag niet in de url staan');
});

test('401 is een verlopen sessie, geen algemene fout', async () => {
  const c = maakClient({ tenant: 'school.magister.net', token: 'x',
    haal: nepHaal([['/api/account', 401]]) });
  await assert.rejects(() => c.account(), (e) => {
    assert.ok(e instanceof MagisterFout);
    assert.equal(e.soort, 'sessie-verlopen');
    return true;
  });
});

test('403 is geen toegang', async () => {
  const c = maakClient({ tenant: 'school.magister.net', token: 'x',
    haal: nepHaal([['/kinderen', 403]]) });
  await assert.rejects(() => c.kinderen(1), (e) => e.soort === 'geen-toegang');
});

test('een netwerkstoring wordt een nette fout', async () => {
  const c = maakClient({ tenant: 'school.magister.net', token: 'x',
    haal: async () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(() => c.account(), (e) => e.soort === 'netwerkfout');
});

test('geen enkele foutmelding bevat het token, in elke fouttak', async () => {
  // De regel voor dit bestand: het token verlaat de Authorization-header niet.
  // Elke tak die een MagisterFout gooit hoort hier langs te komen, ook de tak
  // waar haal zelf struikelt; die werd eerder helemaal niet aangeraakt.
  const GEHEIM = 'ZEERGEHEIM';
  const kapot = async () => { throw new TypeError(`Failed to fetch ${GEHEIM}`); };
  const takken = [
    ['netwerkfout', kapot, (c) => c.account()],
    ['sessie-verlopen', nepHaal([['/api/account', 401]]), (c) => c.account()],
    ['geen-toegang', nepHaal([['/api/account', 403]]), (c) => c.account()],
    ['magister-fout', nepHaal([['/api/account', 500]]), (c) => c.account()],
    ['magister-fout', nepHaal([['/api/account', KAPOT]]), (c) => c.account()],
    ['geen-aanmelding', nepHaal([['/aanmeldingen', { Items: [] }]]),
      (c) => c.aanmelding(6002)],
  ];
  for (const [soort, haal, roep] of takken) {
    const c = maakClient({ tenant: 'school.magister.net', token: GEHEIM, haal });
    await assert.rejects(() => roep(c), (e) => {
      assert.ok(e instanceof MagisterFout, `${soort} gaf geen MagisterFout`);
      assert.equal(e.soort, soort);
      assert.ok(!String(e.message).includes(GEHEIM), `${soort}: token in het bericht`);
      assert.ok(!JSON.stringify(e.details || {}).includes(GEHEIM),
        `${soort}: token in de details`);
      assert.ok(!JSON.stringify(e).includes(GEHEIM), `${soort}: token in de fout`);
      return true;
    });
  }
});

test('een body die geen JSON is wordt een MagisterFout', async () => {
  const c = maakClient({ tenant: 'school.magister.net', token: 'x',
    haal: nepHaal([['/api/account', KAPOT]]) });
  await assert.rejects(() => c.account(), (e) => {
    assert.ok(e instanceof MagisterFout, 'een rauwe SyntaxError kwam naar boven');
    assert.equal(e.soort, 'magister-fout');
    assert.equal(e.details.status, 200);
    return true;
  });
});

test('geen aanmelding is een eigen soort, geen algemene Magister-fout', async () => {
  const c = maakClient({ tenant: 'school.magister.net', token: 'x',
    haal: nepHaal([['/aanmeldingen', { Items: [] }]]) });
  await assert.rejects(() => c.aanmelding(6002), (e) => {
    assert.ok(e instanceof MagisterFout);
    assert.equal(e.soort, 'geen-aanmelding');
    assert.match(e.message, /aanmelding/);
    return true;
  });
});

test('afspraken vragen een datumbereik op', async () => {
  const haal = nepHaal([['/afspraken', { Items: [] }]]);
  const c = maakClient({ tenant: 'school.magister.net', token: 'x', haal });
  await c.afspraken(6002, '2026-09-01', '2026-09-28');
  assert.match(haal.opgevraagd[0].url,
    /\/api\/personen\/6002\/afspraken\?van=2026-09-01&tot=2026-09-28$/);
});

test('peildatum gaat alleen mee als hij gegeven is', async () => {
  const haal = nepHaal([['cijferoverzicht', { Items: [] }]]);
  const c = maakClient({ tenant: 'school.magister.net', token: 'x', haal });
  await c.cijfers(6002, 88001);
  assert.ok(!haal.opgevraagd[0].url.includes('peildatum'));
  await c.cijfers(6002, 79004, '2026-06-01');
  assert.match(haal.opgevraagd[1].url, /&peildatum=2026-06-01$/);
});
