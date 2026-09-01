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
    if (antwoord.status === 401) {
      throw new MagisterFout('sessie-verlopen',
        'Je Magister-sessie is verlopen.', { pad });
    }
    if (antwoord.status === 403) {
      throw new MagisterFout('geen-toegang',
        'Dit account mag deze gegevens niet opvragen.', { pad });
    }
    if (!antwoord.ok) {
      throw new MagisterFout('magister-fout',
        `Magister antwoordde met ${antwoord.status}.`,
        { pad, status: antwoord.status });
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
    async aanmelding(persoonId) {
      const j = await get(`/api/personen/${persoonId}/aanmeldingen`);
      const alle = rijen(j).map((a) => ({
        id: veld(a, 'id'),
        van: veld(a, 'begin') || '',
        tot: veld(a, 'einde') || '',
        studie: veld(veld(a, 'studie') || {}, 'omschrijving')
          || veld(veld(a, 'studie') || {}, 'code') || '',
      }));
      alle.sort((a, b) => String(b.van).localeCompare(String(a.van)));
      if (!alle.length) {
        throw new MagisterFout('geen-aanmelding',
          'Dit account heeft geen aanmelding voor een schooljaar.', {});
      }
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
        + '?actievePerioden=&alleenBerekendeKolommen=false&alleenPTAKolommen=false';
      if (peildatum) pad += `&peildatum=${peildatum}`;
      return rijen(await get(pad));
    },
  };
}
