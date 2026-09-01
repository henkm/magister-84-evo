// Hangt een eigen item onderaan het hoofdmenu van Magister.
//
// Kent geen chrome.* en geen echte browser: het document en de klik-afhandeling
// komen van buiten, zodat deze laag met node --test te testen is.
//
// Het item wordt geKLOOND van een bestaand menu-item in plaats van nagebouwd.
// Magister is een AngularJS-app met eigen klassen, kleuren en hover-gedrag; een
// zelfgebouwd knopje staat scheef bij de eerste de beste stijlwijziging, een
// kloon erft alles vanzelf. Wat er daarna af moet zijn de Angular-attributen
// (anders zou een digest ons item als een echt menuitem kunnen behandelen) en
// de toestandsklassen van het item waarvan we kopieerden.

export const ITEM_ID = 'menu-ti84';
export const MENU_KIEZER = 'ul.main-menu';
// Kort, zoals de buren (Vandaag, Agenda, Cijfers). "Sync naar rekenmachine"
// past niet op een regel in die smalle balk; de uitleg staat in de tooltip.
export const LABEL = 'Rekenmachine';
export const TITEL = 'Rooster en cijfers naar de TI-84 sturen';

// Een rekenmachine in dezelfde stijl als de buren: dunne witte lijnen, geen
// vlak. Bewust geen logo -- dit is een menu-item van Magister, geen reclame --
// en bewust geen Font Awesome-klasse: welke stijlen Magister van dat lettertype
// laadt weten we niet, en een ontbrekend glyph geeft een leeg vierkantje.
const ICOON = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"'
  + ' stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round">'
  + '<rect x="5" y="2.2" width="14" height="19.6" rx="2.4"/>'
  + '<rect x="8" y="5.2" width="8" height="3.6" rx="1"/>'
  + '<g fill="#ffffff" stroke="none">'
  + '<circle cx="8.7" cy="12.6" r=".95"/><circle cx="12" cy="12.6" r=".95"/>'
  + '<circle cx="15.3" cy="12.6" r=".95"/>'
  + '<circle cx="8.7" cy="15.8" r=".95"/><circle cx="12" cy="15.8" r=".95"/>'
  + '<circle cx="15.3" cy="15.8" r=".95"/>'
  + '<circle cx="8.7" cy="19" r=".95"/><circle cx="12" cy="19" r=".95"/>'
  + '<circle cx="15.3" cy="19" r=".95"/></g></svg>');

// active/ng-hide horen bij het item waarvan we kopieerden, niet bij het onze.
const TOESTANDSKLASSEN = ['active', 'expanded', 'children', 'highlight-menu',
  'ng-hide'];

function alleElementen(el) {
  const uit = [el];
  for (const kind of el.children) {
    for (const k of alleElementen(kind)) uit.push(k);
  }
  return uit;
}

/** Het item waar we het onze op baseren: het eerste echte menu-item. */
export function sjabloon(menu) {
  for (const li of menu.querySelectorAll('li')) {
    const a = li.querySelector('a');
    if (a && String(a.id || '').startsWith('menu-') && a.id !== ITEM_ID) {
      return li;
    }
  }
  return null;
}

export function bouwItem(menu, opKlik) {
  const basis = sjabloon(menu);
  if (!basis) return null;
  const li = basis.cloneNode(true);

  for (const el of alleElementen(li)) {
    for (const naam of el.getAttributeNames()) {
      if (naam.startsWith('ng-')) el.removeAttribute(naam);
    }
  }
  for (const k of TOESTANDSKLASSEN) li.classList.remove(k);
  li.setAttribute('data-ti84', 'menu-item');

  const a = li.querySelector('a');
  a.id = ITEM_ID;
  a.setAttribute('title', TITEL);
  a.style.cursor = 'pointer';
  a.addEventListener('click', (e) => {
    if (e && e.preventDefault) e.preventDefault();
    opKlik();
  });

  const icoon = li.querySelector('i');
  if (icoon) {
    // De klassen van Magister blijven staan. Daar hangt de breedte van het
    // icoonvakje aan, en dus waar het bijschrift begint: een eigen breedte
    // opleggen (dat deed dit eerst) schoof de tekst naar links en dat is
    // precies wat je ziet als iets niet van de app zelf is. Het glyph wordt
    // onzichtbaar gemaakt en de tekening komt er als achtergrond in, in
    // hetzelfde vakje.
    icoon.style.color = 'transparent';
    icoon.style.backgroundImage = 'url("' + ICOON + '")';
    icoon.style.backgroundRepeat = 'no-repeat';
    icoon.style.backgroundPosition = 'center';
    icoon.style.backgroundSize = 'contain';
  }

  const bijschrift = li.querySelector('span');
  if (bijschrift) {
    bijschrift.textContent = LABEL;
    bijschrift.setAttribute('title', TITEL);
  }
  return li;
}

/** Zet het item in het menu. Twee keer aanroepen levert er geen twee op. */
export function plaatsItem(doc, opKlik) {
  const menu = doc.querySelector(MENU_KIEZER);
  if (!menu) return null;
  const bestaand = doc.getElementById(ITEM_ID);
  if (bestaand) return bestaand;
  const li = bouwItem(menu, opKlik);
  if (li) menu.appendChild(li);
  return li;
}

/**
 * Plaatst het item en zet het terug zodra Magister het menu opnieuw opbouwt.
 * Dat gebeurt: het is een SPA met hash-routing, en ng-repeat bezit die lijst.
 */
export function bewaakMenu(doc, opKlik, Waarnemer) {
  const W = Waarnemer || (typeof MutationObserver !== 'undefined'
    ? MutationObserver : null);
  plaatsItem(doc, opKlik);
  if (!W) return null;
  const waarnemer = new W(() => { plaatsItem(doc, opKlik); });
  waarnemer.observe(doc.body || doc, { childList: true, subtree: true });
  return waarnemer;
}
