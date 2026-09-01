// De zes schermen uit het ontwerp als een pure toestandsmachine.
// panel.js rendert een toestand en stuurt gebeurtenissen terug; hier zitten
// alle beslissingen, zodat de hele flow zonder browser te testen is.

export const BEGIN = {
  scherm: 'kind-kiezen',
  kinderen: [],
  kind: null,
  poortBekend: false,
  laatsteSync: null,
  fase: null,
  voortgang: { gedaan: 0, totaal: 0 },
  feiten: {},
  resultaat: null,
  fout: null,
};

export const FOUTEN = {
  'niet-ingelogd': {
    titel: 'Sync gestopt',
    kop: 'Je bent niet ingelogd bij Magister',
    body: 'De extensie leest mee met je eigen Magister-tab. Zonder ingelogde '
      + 'tab is er geen data. Er is niets naar de rekenmachine gestuurd.',
    stap: 'Open Magister, log in als ouder en kom hier terug.',
    knop: 'Magister openen',
  },
  'tab-herladen': {
    titel: 'Sync gestopt',
    kop: 'Herlaad je Magister-tab',
    body: 'De extensie is net geinstalleerd of bijgewerkt, en je Magister-tab '
      + 'draait nog de vorige versie mee. Daardoor kan de extensie er niet bij. '
      + 'Er is niets naar de rekenmachine gestuurd.',
    stap: 'Ververs de Magister-tab en klik daarna op Opnieuw proberen.',
    knop: 'Opnieuw proberen',
  },
  'sessie-verlopen': {
    titel: 'Sync gestopt',
    kop: 'Je Magister-sessie is verlopen',
    body: 'Magister logt je na een tijdje automatisch uit. Er is niets naar de '
      + 'rekenmachine gestuurd.',
    stap: 'Ververs de Magister-tab, log opnieuw in en klik daarna op Opnieuw '
      + 'proberen.',
    knop: 'Opnieuw proberen',
  },
  'geen-toegang': {
    titel: 'Sync gestopt',
    kop: 'Dit account mag deze gegevens niet opvragen',
    body: 'Magister weigert de gegevens van dit kind voor dit account. Er is '
      + 'niets naar de rekenmachine gestuurd.',
    stap: 'Controleer of je met het juiste account bent ingelogd.',
    knop: 'Opnieuw proberen',
  },
  'geen-aanmelding': {
    titel: 'Sync gestopt',
    kop: 'Dit account heeft geen schooljaar',
    body: 'Magister kent voor dit kind geen aanmelding voor een schooljaar. '
      + 'Er valt dus geen rooster of cijferlijst op te halen. Er is niets naar '
      + 'de rekenmachine gestuurd.',
    stap: 'Controleer of je het juiste kind hebt gekozen.',
    knop: 'Ander kind',
  },
  'magister-fout': {
    titel: 'Sync gestopt',
    kop: 'Magister gaf geen antwoord dat we begrijpen',
    body: 'Er is niets naar de rekenmachine gestuurd. Dit ligt aan Magister, '
      + 'niet aan je rekenmachine.',
    stap: 'Probeer het over een paar minuten opnieuw.',
    knop: 'Opnieuw proberen',
  },
  netwerkfout: {
    titel: 'Sync gestopt',
    kop: 'Magister is niet bereikbaar',
    body: 'De verbinding met Magister mislukte. Er is niets naar de '
      + 'rekenmachine gestuurd.',
    stap: 'Controleer je internetverbinding en probeer het opnieuw.',
    knop: 'Opnieuw proberen',
  },
  'geen-rekenmachine': {
    titel: 'Sync gestopt',
    kop: 'Geen rekenmachine gevonden',
    body: 'De data uit Magister is binnen en staat klaar. Alleen het versturen '
      + 'kan nog niet.',
    stap: '1 · Sluit de USB-C-kabel aan beide kanten aan. 2 · Zet de '
      + 'rekenmachine aan met ON en ga naar het beginscherm. 3 · Kies hem '
      + 'opnieuw in het venster van Chrome.',
    knop: 'Rekenmachine kiezen',
  },
  'verbinding-afgebroken': {
    titel: 'Sync afgebroken',
    kop: 'Verbinding halverwege verbroken',
    body: 'Op de rekenmachine staat nu deels oude data.',
    stap: 'Sluit de kabel weer aan en sync opnieuw. De rekenmachine wordt dan '
      + 'volledig overschreven.',
    knop: 'Opnieuw syncen',
  },
  'te-groot': {
    titel: 'Sync gestopt',
    kop: 'De gegevens passen niet op de rekenmachine',
    body: 'Er is meer data dan er in een programma past. Er is niets naar de '
      + 'rekenmachine gestuurd.',
    stap: 'Meld dit: de extensie kort het rooster zelf al in, en zelfs een '
      + 'enkele dag past niet.',
    knop: 'Sluiten',
  },
  onbekend: {
    titel: 'Sync gestopt',
    kop: 'Er ging iets mis',
    body: 'De sync is gestopt. Wat er op de rekenmachine staat, kan oude data zijn.',
    stap: 'Probeer het opnieuw. Blijft het misgaan, sluit de kabel opnieuw aan.',
    knop: 'Opnieuw proberen',
  },
};

// Wat de knop op het foutscherm doet. Namen, geen functies: deze module kent
// geen DOM en geen chrome.*.
const EIGEN_ACTIE = {
  'niet-ingelogd': 'magister',
  'geen-rekenmachine': 'poort',
  'geen-aanmelding': 'anderKind',
  'te-groot': 'sluiten',
};

/**
 * De knop op het foutscherm: { tekst, actie }. "Opnieuw proberen" doet
 * opnieuw wat er misging -- de start of de sync -- en niet alleen een ander
 * scherm tonen, want dan blijft de halve toestand staan waarin het misging.
 */
export function foutknop(t) {
  const f = t.fout || {};
  const soort = FOUTEN[f.soort] ? f.soort : 'onbekend';
  const opnieuw = f.bron === 'start' ? 'herstart' : 'sync';
  // De tab staat open, dus "Magister openen" is op: nu moet er een weg terug
  // zijn, anders is dit scherm een doodlopende weg.
  if (soort === 'niet-ingelogd' && f.geopend) {
    return { tekst: 'Opnieuw proberen', actie: opnieuw };
  }
  return { tekst: FOUTEN[soort].knop, actie: EIGEN_ACTIE[soort] || opnieuw };
}

/**
 * Het bijschrift onder het aantal cijfers. Nul cijfers is bij aanvang van een
 * schooljaar gewoon waar; zonder periode mag er alleen geen scheidingsteken
 * naar niets blijven hangen.
 */
export function cijfersBijschrift(r) {
  if (r.periode) return `cijfers · ${r.periode}`;
  return r.cijfers ? 'cijfers · dit schooljaar' : 'cijfers · nog niets ingevoerd';
}

/** De slotalinea van het gereedscherm. */
export function gereedSlot(r) {
  const regels = [];
  if (r.dagen < r.gevraagd) {
    regels.push(`Het rooster is ingekort tot ${r.dagen} dagen; meer past er `
      + 'niet in een programma.');
  }
  regels.push(`Op de rekenmachine staat bovenaan "gesynct ${r.tijd}". `
    + 'Klopt het rooster niet? Controleer of hierboven de juiste naam staat.');
  return regels.join(' ');
}

export function percentage(t) {
  if (t.fase !== 'versturen' && t.scherm !== 'fout') return null;
  if (!t.voortgang.totaal) return null;
  return Math.round((t.voortgang.gedaan / t.voortgang.totaal) * 100);
}

export function volgende(toestand, g) {
  const t = { ...toestand };
  switch (g.type) {
    case 'start':
      t.kinderen = g.kinderen || [];
      t.kind = g.kind || null;
      t.laatsteSync = g.laatsteSync || null;
      t.poortBekend = Boolean(g.poortBekend);
      t.scherm = t.kind ? 'klaar' : 'kind-kiezen';
      return t;
    case 'kies':
      t.kind = g.kind;
      t.scherm = 'klaar';
      return t;
    case 'anderKind':
      t.scherm = 'kind-kiezen';
      return t;
    case 'geenPoort':
      t.scherm = 'koppelen';
      t.poortBekend = false;
      return t;
    case 'poort':
      t.scherm = 'klaar';
      t.poortBekend = true;
      return t;
    case 'sync':
      t.scherm = 'bezig';
      t.fase = 'ophalen';
      t.voortgang = { gedaan: 0, totaal: 0 };
      t.feiten = {};
      t.fout = null;
      return t;
    case 'fase':
      t.fase = g.fase;
      t.feiten = { ...t.feiten, ...(g.feiten || {}) };
      return t;
    case 'voortgang':
      t.voortgang = { gedaan: g.gedaan, totaal: g.totaal };
      return t;
    case 'gereed':
      t.scherm = 'gereed';
      t.resultaat = g.resultaat;
      t.fase = null;
      return t;
    case 'fout':
      t.scherm = 'fout';
      // bron zegt wat er opnieuw moet als de gebruiker op de knop drukt.
      t.fout = { soort: FOUTEN[g.soort] ? g.soort : 'onbekend',
        bron: g.bron || null, geopend: Boolean(g.geopend),
        details: g.details || null };
      return t;
    case 'opnieuw':
    case 'afbreken':
      t.scherm = 'klaar';
      t.fout = null;
      t.fase = null;
      t.voortgang = { gedaan: 0, totaal: 0 };
      return t;
    default:
      return toestand;
  }
}
