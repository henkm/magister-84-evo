# Magister naar TI-84

Chrome-extensie die het rooster en de cijfers uit je eigen, ingelogde
Magister-tab leest en ze als twee Python-programma's naar een TI-84 Evo-T
stuurt. Op de rekenmachine staat daarna een app die het rooster van vier weken
en de cijferlijst van dit schooljaar laat zien, ook zonder internet.

Twee programma's gaan naar het apparaat:

- `MAGISTER` — de app zelf (`calc/MAGISTER.py`).
- `MAGDATA` — de opgehaalde data, als Python-bron. De parser van Python is het
  dataformaat; de rekenmachine heeft daardoor geen json-module nodig.

## Vereisten

- Chrome op een desktop (Web Serial; dat werkt niet op Android of iOS).
- Een USB-C-kabel naar de TI-84 Evo-T.
- Een Magister-tab waar je op bent ingelogd, als ouder of als leerling.

## Installeren

1. Open `chrome://extensions`.
2. Zet rechtsboven **Ontwikkelaarsmodus** aan.
3. Klik **Uitgepakte extensie laden** en kies de map `extension/`.
4. Het blauwe M-pictogram verschijnt in de werkbalk.

## Gebruiken

1. Zorg dat er een tabblad open staat waar je bij Magister bent ingelogd.
2. Klik op het pictogram. Er opent een eigen venster — bewust geen popup: het
   apparaatvenster van Chrome pakt de focus, en een popup sluit zodra hij de
   focus verliest. Midden in een transfer breekt dat de verbinding af.
3. Heeft je account meer dan een kind, kies dan voor wie deze rekenmachine is.
   Die keuze wordt onthouden.
4. Sluit de rekenmachine aan, zet hem aan en klik **Nu syncen**. De eerste keer
   vraagt Chrome eenmalig toestemming voor het apparaat.
5. Laat de kabel zitten tot het eindscherm verschijnt.

## Let op: elke sync overschrijft alles

Elke sync stuurt **beide** programma's, `MAGISTER` eerst en `MAGDATA` daarna,
altijd en zonder versiecontrole. Wat er op de rekenmachine stond, is daarna
weg.

Dat is opzet. Breekt de transfer af tijdens `MAGDATA`, dan staat de app er al
en toont hij zijn eigen scherm dat er opnieuw gesynct moet worden. Een
gecombineerd bestand zou bij dezelfde storing een half programma achterlaten
dat helemaal niet meer start.

## Wat er met je token gebeurt

De extensie leest het toegangstoken uit de `sessionStorage` van je eigen
Magister-tab en gebruikt het alleen in de `Authorization`-header van de
verzoeken aan Magister. Het gaat niet naar `chrome.storage`, niet naar de
console en niet in een foutmelding. In `chrome.storage.local` staan alleen
`kindId`, `kindNaam` en `laatsteSync`.

## Mappen

| Map | Wat |
| --- | --- |
| `calc/` | De app voor de rekenmachine (`MAGISTER.py`) en een voorbeeld-`MAGDATA.py`. |
| `extension/` | De extensie: manifest, service worker en het paneel. |
| `extension/src/` | De pure modules — protocol, Magister-client, datamodel, generator, toestandsmachine. Geen DOM, geen `chrome.*`. |
| `extension/calc/` | De kopie van de app die de extensie meestuurt. |
| `tools/` | Hulpscripts: `evosend` (versturen vanaf de opdrachtregel), `sync_app`, `icons`, `check_extension`, `golden`. |
| `tests/` | Beide testsuites. |

## Testen

```bash
node --test                      # JavaScript: protocol, client, model, flow
python3 -m pytest tests/ -q      # Python: de app, de layout, de kruiscontrole
python3 -m tools.check_extension # verwijzingen in extension/
```

`check_extension` loopt na of het manifest geldig is en of alles waar de
extensie naar wijst ook echt bestaat: de pictogrammen, wat `panel.html`
binnenhaalt, elk importpad in de JavaScript en de app die het paneel bij een
sync meestuurt. Chrome faalt daar stil — een typefout in een importpad laat
het paneel leeg achter zonder een enkele melding. `pytest` draait dezelfde
controle mee.

## `python3 -m tools.sync_app`

De extensie stuurt `calc/MAGISTER.py` bij elke sync mee en leest die uit haar
eigen pakket, dus er moet een kopie in `extension/calc/` staan. Dit script
maakt die kopie.

**Draai het na elke wijziging in `calc/MAGISTER.py`.** Doe je dat niet, dan
faalt `tests/test_app_sync.py` omdat de kopie achterloopt.

## `python3 -m tools.icons`

Genereert de vier pictogrammen in `extension/icons/`. Pas ze niet met de hand
aan; wijzig het raster in het script en draai het opnieuw.

## De vormgeving nakijken zonder de extensie te laden

`panel.html` heeft een demostand: is er geen `chrome`-API, dan rendert het
paneel een vaste voorbeeldtoestand. Zo zijn alle zes de schermen te bekijken
zonder Magister-sessie en zonder rekenmachine.

Chrome laadt geen ES-modules vanaf `file://` (CORS), dus dat gaat via een
servertje:

```bash
python3 -m http.server 8765 --directory extension
```

Open daarna `http://localhost:8765/panel.html?scherm=klaar`. De schermen zijn
`kind-kiezen`, `klaar`, `koppelen`, `bezig`, `gereed` en `fout`; bij die
laatste kiest `&soort=` de fout, bijvoorbeeld
`?scherm=fout&soort=geen-rekenmachine`. De soorten staan in `FOUTEN` in
`extension/src/stroom.js`.
