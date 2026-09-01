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
5. Laat de kabel zitten tot het eindscherm verschijnt. Moet het toch stoppen,
   gebruik dan **Afbreken** en niet de kabel.

## Let op: elke sync overschrijft alles

Elke sync stuurt **beide** programma's, `MAGISTER` eerst en `MAGDATA` daarna,
altijd en zonder versiecontrole. Wat er op de rekenmachine stond, is daarna
weg.

Dat is opzet. Breekt de transfer af tijdens `MAGDATA`, dan staat de app er al
en toont hij zijn eigen scherm dat er opnieuw gesynct moet worden. Een
gecombineerd bestand zou bij dezelfde storing een half programma achterlaten
dat helemaal niet meer start.

**Afbreken** stopt op de eerstvolgende pakketgrens: het lopende pakket wordt
nog bevestigd en daarna gaat de poort dicht. Wat er tot dat moment verstuurd
is, blijft op de rekenmachine staan — precies dezelfde situatie als een kabel
die eruit valt, en de app vangt dat zelf op. Zolang een sync loopt, doet **Nu
syncen** niets; twee transfers tegelijk op een poort kan niet.

## Wat er op de rekenmachine past

Een programma op de Evo heeft een 16-bits lengteveld: `MAGDATA` mag hooguit
65535 bytes zijn. Twee dingen houden het daaronder.

- **Huiswerk wordt afgekapt op 240 tekens**, met `...` erachter zodat te zien
  is dat er meer was. Het lesdetail toont dertig tekens per regel, dus 240
  tekens is acht regels scrollen — en de `Inhoud`-velden van Magister zijn
  regelmatig langer dan dat. Zonder die grens past een leerling met acht
  lesuren huiswerk per dag niet meer in een programma.
- **Past het dan nog niet, dan gaan er hele dagen van achteren af** tot het
  wel past. Vandaag is waar het om gaat, de vierde week niet. Het eindscherm
  meldt tot hoeveel dagen het rooster is ingekort. Alleen als zelfs een enkele
  dag niet past, stopt de sync met een fout.

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
node --test                      # JavaScript: protocol, client, model, paneel
python3 -m pytest tests/ -q      # Python: de app, de layout, de kruiscontrole
python3 -m tools.check_extension # verwijzingen in extension/
```

De JavaScript-tests draaien ook het paneel zelf. `tests/js/paneelomgeving.js`
zet daarvoor een browser neer die niet bestaat — een DOM, `chrome.*`, een
Magister die antwoordt en een rekenmachine aan een seriële poort — zodat de
naad tussen de modules te testen is zonder Chrome, zonder Magister-sessie en
zonder apparaat. Dat is de laag waar de losse modules elk voor zich kloppen
maar de volgorde ertussen misgaat.

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

## Wat het apparaat ons heeft geleerd

Op 2026-09-01 heeft de hele keten voor het eerst echt gedraaid: extensie ->
Magister -> generator -> Kermit -> Evo -> app op het scherm. Vijf aannames
bleken fout, en alle vijf zijn ze nu vastgelegd in een test die rood wordt als
iemand ze terugdraait. Ze staan hier omdat ze allemaal dezelfde vorm hebben:
iets wat op de Mac klopte en op het apparaat niet.

**1. Twee programma's over één open poort kan niet.** De transfer liep vast op
28,8 van 46,6 kB -- exact de grens tussen `MAGISTER` en `MAGDATA`. Na het
`B`-pakket doet de Evo niets meer met die verbinding, dus het tweede `S`-pakket
liep in een timeout. `stuurAlles` opent en sluit nu per programma een eigen
verbinding, precies wat `tools/evosend` met twee aanroepen altijd al deed.

**2. `requestPort()` werkt niet in een popupvenster.** Het keuzevenster van
Chrome kwam nooit in beeld en `requestPort()` gaf meteen `NotFoundError`.
Vanuit een gewoon tabblad werkt dezelfde aanroep met hetzelfde filter wel; het
paneel opent daarom in een tabblad.

**3. De Evo start een programma met `from MAGISTER import *`.** `__name__` is
daar `"MAGISTER"` en niet `"__main__"`, dus een gewone main-guard vuurt nooit:
wit scherm, meteen weg, geen foutmelding. De app start zichzelf zodra `ti_draw`
er echt is; `tests/test_app_start.py` importeert het bestand precies zoals het
apparaat dat doet.

**4. `fill_rect` van 1 pixel hoog knalt** met `tidrawException: Height cannot be
negative`, terwijl 17 en 22 hoog in hetzelfde beeld goed gingen. Alle strepen
gaan nu door `draw_line`. De neppe `ti_draw` weigert voortaan een rechthoek
dunner dan 2 pixel.

**5. `show_draw()` is geen flush maar "pauzeer tot CLEAR".** Het beeld stond er
perfect op en geen enkele toets deed iets: elke druk kwam bij `show_draw`
terecht en nooit bij `wait_key`. Tekenwerk is meteen zichtbaar, dus de lus is
teken -> `wait_key` -> teken. De neppe `ti_draw` laat `show_draw()` nu knallen.

De rode draad: een test-double die alles slikt laat precies die fouten door.
Elke keer dat het apparaat iets weigerde, is die weigering in `tests/fake_ti.py`
gezet -- dat is wat de suite sindsdien wél kan zien.

De app zelf is met de hand nagekeken op het scherm: koptekst binnen de blauwe
balk, de twee regels van een lesregel los van elkaar, elke chip om zijn eigen
tekst heen, en de begintijd niet meer onder de lesuur-badge door.

Rechtstreeks een nieuwe versie op het apparaat zetten, zonder de extensie:

```bash
python3 -m tools.evosend MAGISTER calc/MAGISTER.py
python3 -m tools.evosend MAGDATA calc/MAGDATA.py
```

Een lopend programma houdt de poort vast; sluit het eerst af met CLEAR of ON.

Verder is er één bewuste afwijking van het ontwerp: de keuzekaarten tonen
alleen de naam van het kind, niet de regel `4 havo · Stedelijk Lyceum`
eronder. Die gegevens zitten niet in het `/kinderen`-antwoord en zouden per
kind een extra call kosten op precies het eerste scherm — een call die 403 kan
geven.
