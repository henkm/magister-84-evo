import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_ID, LABEL, bewaakMenu, plaatsItem, sjabloon }
  from '../../extension/src/menu.js';
import { nepMagister } from './nepmenu.js';

const items = (doc) => doc.menu().querySelectorAll('li');
const onsItem = (doc) => {
  const a = doc.getElementById(ITEM_ID);
  return a ? a.ouder : null;
};

test('het item komt onderaan het menu en heet Rekenmachine', () => {
  const doc = nepMagister();
  plaatsItem(doc, () => {});
  const rij = items(doc);
  assert.equal(rij.length, 5);
  const laatste = rij[rij.length - 1];
  assert.equal(laatste.querySelector('span').textContent, LABEL);
  assert.equal(laatste.querySelector('a').id, ITEM_ID);
});

test('het item is een kloon, dus het draagt de klassen van zijn buren', () => {
  // Dit is de hele reden om te klonen: Magister bepaalt hoe een menu-item
  // eruitziet, wij niet.
  const doc = nepMagister();
  plaatsItem(doc, () => {});
  const basis = sjabloon(doc.menu());
  const ons = onsItem(doc);
  assert.ok(basis.classList.contains('ng-scope'));
  assert.ok(ons.classList.contains('ng-scope'), 'de klassen zijn niet mee gekloond');
  assert.equal(ons.querySelector('i').tagName, 'I', 'het icoon-element hoort te blijven');
  assert.equal(ons.querySelector('span').classList.contains('caption'), true);
});

test('de toestand van het item waarvan we kopieerden gaat er af', () => {
  // Het eerste item is "active"; zonder opruimen zou ons item er ook
  // geselecteerd uitzien, en met ng-hide zelfs onzichtbaar zijn.
  const doc = nepMagister();
  plaatsItem(doc, () => {});
  const ons = onsItem(doc);
  assert.equal(ons.classList.contains('active'), false);
  assert.equal(ons.classList.contains('ng-hide'), false);
});

test('alle angular-attributen zijn uit de kloon verdwenen', () => {
  // Een kloon mét ng-repeat en ng-click is voor Angular een half herkenbaar
  // ding; die haken horen door te knippen.
  const doc = nepMagister();
  plaatsItem(doc, () => {});
  const ons = onsItem(doc);
  const alles = [ons, ons.querySelector('a'), ons.querySelector('i'),
    ons.querySelector('span')];
  for (const el of alles) {
    const ng = el.getAttributeNames().filter((n) => n.startsWith('ng-'));
    assert.deepEqual(ng, [], `${el.tagName} houdt nog ${ng.join(', ')} vast`);
  }
});

test('klikken opent het paneel en laat Magister zelf niets doen', () => {
  const doc = nepMagister();
  let geopend = 0;
  plaatsItem(doc, () => { geopend += 1; });
  const voorkomen = doc.getElementById(ITEM_ID).klik();
  assert.equal(geopend, 1);
  assert.equal(voorkomen, true, 'zonder preventDefault navigeert Magister mee');
});

test('twee keer plaatsen levert geen tweede item op', () => {
  const doc = nepMagister();
  plaatsItem(doc, () => {});
  plaatsItem(doc, () => {});
  assert.equal(items(doc).length, 5);
});

test('na een herbouw van het menu staat het item er weer', () => {
  // Magister is een SPA met hash-routing; ng-repeat bouwt die lijst opnieuw op
  // en gooit alles weg wat er niet in hoort -- dus ook ons item.
  const doc = nepMagister();
  bewaakMenu(doc, () => {}, doc.Waarnemer);
  assert.ok(onsItem(doc), 'het item stond er meteen niet');

  doc.herbouwMenu();
  assert.ok(onsItem(doc), 'het item is na een route-wissel niet teruggekomen');
  assert.equal(items(doc).length, 3, 'twee eigen items na een herbouw');
});

test('een klik werkt ook na een herbouw', () => {
  // Het teruggezette item is een nieuwe kloon; die heeft zijn eigen listener
  // nodig, want cloneNode neemt er geen mee.
  const doc = nepMagister();
  let geopend = 0;
  bewaakMenu(doc, () => { geopend += 1; }, doc.Waarnemer);
  doc.herbouwMenu();
  doc.getElementById(ITEM_ID).klik();
  assert.equal(geopend, 1);
});

test('een pagina zonder dat menu blijft ongemoeid', () => {
  // Magister heeft ook pagina's zonder sidebar (inloggen, foutschermen).
  const doc = nepMagister({ metMenu: false });
  assert.equal(plaatsItem(doc, () => {}), null);
  assert.doesNotThrow(() => bewaakMenu(doc, () => {}, doc.Waarnemer));
});

test('een menu dat pas later verschijnt krijgt het item alsnog', () => {
  // Het content script draait op document_idle; Angular rendert zijn sidebar
  // mogelijk pas daarna. Opgeven bij een leeg document zou betekenen dat het
  // item precies bij een trage pagina wegblijft.
  const doc = nepMagister({ metMenu: false });
  bewaakMenu(doc, () => {}, doc.Waarnemer);
  assert.equal(onsItem(doc), null, 'er was nog geen menu om iets in te zetten');
  doc.voegMenuToe();
  assert.ok(onsItem(doc), 'het item kwam niet alsnog in het menu');
});
