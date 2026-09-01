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
      + 'rekenmachine aan met ON. 3 · Kies hem opnieuw in het venster van Chrome.',
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
    stap: 'Meld dit; de extensie moet dan minder weken rooster meesturen.',
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
      t.fout = { soort: FOUTEN[g.soort] ? g.soort : 'onbekend',
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
