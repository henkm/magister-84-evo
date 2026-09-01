// Magister-client. Kent geen Chrome en geen DOM: fetch komt van buiten, zodat
// deze laag met node --test te testen is.

export class MagisterFout extends Error {
  constructor(soort, bericht, details) {
    super(bericht);
    this.name = 'MagisterFout';
    // sessie-verlopen | geen-toegang | geen-aanmelding | magister-fout | netwerkfout
    this.soort = soort;
    this.details = details;  // nooit het token
  }
}

/** Items of items, wat het endpoint ook geeft. */
export function rijen(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.Items)) return json.Items;
  if (Array.isArray(json.items)) return json.items;
  return [];
}

/** Leest een veld ongeacht hoofdletter: veld(o, 'naam') vindt Naam en naam. */
export function veld(obj, naam) {
  if (!obj) return undefined;
  const groot = naam.charAt(0).toUpperCase() + naam.slice(1);
  return obj[groot] !== undefined ? obj[groot] : obj[naam];
}

export function maakClient({ tenant, token, haal = globalThis.fetch }) {
  const basis = `https://${tenant}`;

  async function get(pad) {
    let antwoord;
    try {
      antwoord = await haal(basis + pad, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
    } catch (e) {
      throw new MagisterFout('netwerkfout',
        'Magister is niet bereikbaar. Staat je internetverbinding aan?', { pad });
    }
    // De status gaat overal mee in de details: het foutscherm toont hem, en
    // zonder die regel is een 401 op /api/account niet te onderscheiden van
    // een 401 op de cijfers zonder de console erbij te halen.
    if (antwoord.status === 401) {
      throw new MagisterFout('sessie-verlopen',
        'Je Magister-sessie is verlopen.', { pad, status: 401 });
    }
    if (antwoord.status === 403) {
      throw new MagisterFout('geen-toegang',
        'Dit account mag deze gegevens niet opvragen.',
        { pad, status: 403 });
    }
    if (!antwoord.ok) {
      // Een 400 draagt bijna altijd een uitleg in het antwoord: welke
      // parameter Magister niet lust. Die weggooien maakt het onmogelijk om
      // zonder de ontwikkelaarsconsole te achterhalen wat er mis is.
      // Afgekapt, want het is bedoeld als aanwijzing, niet als logboek.
      let uitleg = '';
      try {
        uitleg = String(await antwoord.text()).replace(/\s+/g, ' ').slice(0, 300);
      } catch (e) { /* geen leesbare body, ook goed */ }
      throw new MagisterFout('magister-fout',
        `Magister antwoordde met ${antwoord.status}.`,
        { pad, status: antwoord.status, uitleg });
    }
    try {
      return await antwoord.json();
    } catch (e) {
      // Een stuk body dat geen JSON is (een inlogpagina, een halve response)
      // hoort een MagisterFout te worden, geen rauwe SyntaxError.
      throw new MagisterFout('magister-fout',
        'Magister gaf een antwoord dat niet te lezen was.',
        { pad, status: antwoord.status });
    }
  }

  return {
    async account() {
      const j = await get('/api/account');
      const persoon = veld(j, 'persoon') || {};
      const groepen = veld(j, 'groep') || [];
      const namen = groepen.map((g) => String(veld(g, 'naam') || '').toLowerCase());
      return { id: veld(persoon, 'id'), rol: namen.includes('ouder') ? 'ouder' : 'leerling' };
    },

    async kinderen(ouderId) {
      const j = await get(`/api/personen/${ouderId}/kinderen`);
      return rijen(j).map((k) => ({
        id: veld(k, 'id'),
        naam: veld(k, 'roepnaam') || veld(k, 'achternaam') || '',
        volledig: [veld(k, 'roepnaam'), veld(k, 'achternaam')].filter(Boolean).join(' '),
      }));
    },

    /** De lopende aanmelding: die met de laatste begindatum. */
    /**
     * De lopende aanmelding: die met een einddatum die nog niet voorbij is,
     * en van die groep de vroegste - dat is het schooljaar waar de leerling
     * nu in zit, niet het jaar erna.
     *
     * Bewust gekozen op de EINDdatum en niet op de begindatum. Magister noemt
     * het beginveld niet overal hetzelfde, en een veld dat niet gelezen wordt
     * levert een sortering op die stilzwijgend niets doet: dan wint de eerste
     * uit de lijst, en dat was op een echt account de aanmelding van drie jaar
     * geleden. De cijfercall kreeg daardoor een peildatum uit 2024 en gaf 400.
     * De einddatum wordt aantoonbaar wel gelezen, dus daar rust de keuze op.
     */
    async aanmelding(persoonId, vandaag) {
      const j = await get(`/api/personen/${persoonId}/aanmeldingen`);
      const nu = vandaag || new Date().toISOString().slice(0, 10);
      const alle = rijen(j).map((a) => ({
        id: veld(a, 'id'),
        van: veld(a, 'begin') || veld(a, 'start') || veld(a, 'aanvang') || '',
        tot: veld(a, 'einde') || veld(a, 'eind') || '',
        studie: veld(veld(a, 'studie') || {}, 'omschrijving')
          || veld(veld(a, 'studie') || {}, 'code') || '',
      }));
      if (!alle.length) {
        throw new MagisterFout('geen-aanmelding',
          'Dit account heeft geen aanmelding voor een schooljaar.', {});
      }

      const lopend = alle.filter((a) => a.tot && a.tot >= nu);
      if (lopend.length) {
        lopend.sort((a, b) => a.tot.localeCompare(b.tot));
        return lopend[0];
      }
      // Alles is afgelopen: neem het laatst geeindigde jaar. Dat is het jaar
      // waar nog cijfers in staan, en cijfers() krijgt er een peildatum bij.
      alle.sort((a, b) => String(b.tot).localeCompare(String(a.tot)));
      return alle[0];
    },

    async afspraken(persoonId, van, tot) {
      const j = await get(`/api/personen/${persoonId}/afspraken?van=${van}&tot=${tot}`);
      return rijen(j);
    },

    /**
     * peildatum is verplicht voor een afgesloten schooljaar: zonder die
     * parameter geeft Magister stilzwijgend een lege lijst terug.
     */
    async cijfers(persoonId, aanmeldingId, peildatum) {
      let pad = `/api/personen/${persoonId}/aanmeldingen/${aanmeldingId}`
        + '/cijfers/cijferoverzichtvooraanmelding'
        // actievePerioden=true is wat Magister zelf meestuurt. Leeg laten geeft
        // HTTP 400: "The value '' is invalid." Met true krijg je de perioden
        // die op de peildatum lopen - dezelfde die je op de site ziet, dus de
        // rekenmachine toont hetzelfde als de website.
        + '?actievePerioden=true&alleenBerekendeKolommen=false'
        + '&alleenPTAKolommen=false';
      if (peildatum) pad += `&peildatum=${peildatum}`;
      return rijen(await get(pad));
    },
  };
}
