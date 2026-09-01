// Een document dat genoeg doet om src/menu.js er echt in te laten draaien.
//
// De opbouw is overgenomen uit de werkelijke sidebar van Magister (gekopieerd
// uit een ingelogde tab op 2026-09-01): een AngularJS ng-repeat over
// ul.main-menu, waarin elk item li > a#menu-<naam> > i.far.fa-<icoon> +
// span.caption is, met de Angular-attributen die daarbij horen. Verzin hier
// niets bij: wat de kloon moet overleven staat in die markup.

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.ouder = null;
    this.style = {};
    this.handlers = {};
    this._attrs = new Map();
    this._tekst = '';
  }

  get id() { return this._attrs.get('id') || ''; }
  set id(v) { this._attrs.set('id', String(v)); }

  get className() { return this._attrs.get('class') || ''; }
  set className(v) { this._attrs.set('class', String(v)); }

  get klassen() {
    return this.className ? this.className.split(/\s+/).filter(Boolean) : [];
  }

  get classList() {
    return {
      contains: (k) => this.klassen.includes(k),
      add: (k) => {
        if (!this.klassen.includes(k)) {
          this.className = this.klassen.concat(k).join(' ');
        }
      },
      remove: (k) => { this.className = this.klassen.filter((x) => x !== k).join(' '); },
    };
  }

  getAttributeNames() { return [...this._attrs.keys()]; }
  setAttribute(n, v) { this._attrs.set(n, String(v)); }
  getAttribute(n) { return this._attrs.has(n) ? this._attrs.get(n) : null; }
  removeAttribute(n) { this._attrs.delete(n); }

  appendChild(k) {
    k.ouder = this;
    this.children.push(k);
    return k;
  }

  remove() {
    if (!this.ouder) return;
    const i = this.ouder.children.indexOf(this);
    if (i >= 0) this.ouder.children.splice(i, 1);
    this.ouder = null;
  }

  get textContent() {
    if (this.children.length) return this.children.map((k) => k.textContent).join('');
    return this._tekst;
  }

  set textContent(v) { this._tekst = String(v); this.children = []; }

  cloneNode(diep) {
    const kopie = new El(this.tagName);
    for (const [n, v] of this._attrs) kopie._attrs.set(n, v);
    kopie._tekst = this._tekst;
    kopie.style = { ...this.style };
    // handlers gaan bewust NIET mee: cloneNode kopieert in een browser ook
    // geen listeners, en menu.js hoort zijn eigen klik te hangen.
    if (diep) for (const k of this.children) kopie.appendChild(k.cloneNode(true));
    return kopie;
  }

  addEventListener(soort, fn) {
    (this.handlers[soort] = this.handlers[soort] || []).push(fn);
  }

  klik() {
    let voorkomen = false;
    for (const fn of this.handlers.click || []) {
      fn({ preventDefault: () => { voorkomen = true; } });
    }
    return voorkomen;
  }

  /** Alleen wat menu.js gebruikt: "li", "a", "i", "span", "ul.main-menu". */
  _zoek(kiezer) {
    const [tag, klasse] = kiezer.split('.');
    const uit = [];
    for (const k of this.children) {
      const tagOk = !tag || k.tagName === tag.toUpperCase();
      if (tagOk && (!klasse || k.classList.contains(klasse))) uit.push(k);
      for (const d of k._zoek(kiezer)) uit.push(d);
    }
    return uit;
  }

  querySelector(kiezer) { return this._zoek(kiezer)[0] || null; }
  querySelectorAll(kiezer) { return this._zoek(kiezer); }
}

function alles(el) {
  const uit = [el];
  for (const k of el.children) for (const d of alles(k)) uit.push(d);
  return uit;
}

function menuItem(id, icoon, titel, klassen) {
  const li = new El('li');
  li.className = klassen;
  li.setAttribute('ng-repeat', 'item in menuitems');
  li.setAttribute('ng-class', "{'active': item.isActive}");
  li.setAttribute('ng-hide', 'item.visibleState === 2');
  li.setAttribute('ng-mouseover', 'onMouseOver($event)');
  li.setAttribute('ng-mouseleave', 'onMouseLeave()');
  li.setAttribute('ng-attr-id', '{{item.id}}');

  const a = new El('a');
  a.setAttribute('ng-click', 'onSelectItem(item)');
  a.id = id;

  const i = new El('i');
  i.className = 'far ng-scope ' + icoon;
  i.setAttribute('ng-if', 'item.icon');
  i.setAttribute('ng-class', 'item.icon');

  const span = new El('span');
  span.className = 'caption ng-binding ng-scope';
  span.setAttribute('ng-bind', 'item.title');
  span.setAttribute('ng-if', "item.title !== 'OPP'");
  span.setAttribute('title', '');
  span.textContent = titel;

  a.appendChild(i);
  a.appendChild(span);
  li.appendChild(a);
  return li;
}

export function nepMagister({ metMenu = true } = {}) {
  const body = new El('body');
  const doc = { body };
  let menu = null;

  function nieuwMenu() {
    const ul = new El('ul');
    ul.className = 'main-menu';
    ul.appendChild(menuItem('menu-vandaag', 'fa-home', 'Vandaag',
      'ng-scope active'));
    ul.appendChild(menuItem('menu-agenda', 'fa-calendar-alt', 'Agenda',
      'ng-scope'));
    ul.appendChild(menuItem('menu-afwezigheid', 'fa-check-circle',
      'Afwezigheid', 'ng-scope ng-hide'));
    ul.appendChild(menuItem('menu-cijfers', 'fa-file-alt', 'Cijfers',
      'ng-scope'));
    return ul;
  }

  if (metMenu) {
    menu = nieuwMenu();
    body.appendChild(menu);
  }

  doc.querySelector = (k) => body.querySelector(k);
  doc.querySelectorAll = (k) => body.querySelectorAll(k);
  doc.getElementById = (id) => alles(body).find((e) => e.id === id) || null;
  doc.menu = () => menu;

  // Een MutationObserver die de test zelf laat vuren: "Angular heeft het menu
  // opnieuw opgebouwd" is een gebeurtenis die je in een test wilt sturen, niet
  // afwachten.
  const terugroepen = [];
  doc.Waarnemer = class {
    constructor(fn) { this.fn = fn; }
    observe() { terugroepen.push(this.fn); }
    disconnect() { }
  };
  doc.hertekend = () => { for (const fn of terugroepen) fn(); };

  /** Angular rendert de sidebar pas na het laden: het menu komt later. */
  doc.voegMenuToe = () => {
    menu = nieuwMenu();
    body.appendChild(menu);
    doc.hertekend();
  };

  /** Wat ng-repeat doet bij een route-wissel: de hele lijst opnieuw. */
  doc.herbouwMenu = () => {
    if (!menu) return;
    menu.children = [];
    menu.appendChild(menuItem('menu-vandaag', 'fa-home', 'Vandaag', 'ng-scope'));
    menu.appendChild(menuItem('menu-cijfers', 'fa-file-alt', 'Cijfers',
      'ng-scope active'));
    doc.hertekend();
  };
  return doc;
}
