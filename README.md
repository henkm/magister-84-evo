# Rooster naar je rekenmachine

Chrome-extensie die het rooster en de cijfers uit je eigen, ingelogde
Magister-tab leest en ze als twee Python-programma's naar een TI-84 Evo-T
stuurt. Op de rekenmachine staat daarna een app die het rooster van vier weken
en de cijferlijst van dit schooljaar laat zien, ook zonder internet.

Twee programma's gaan naar het apparaat:

- `MAGISTER` — de app zelf (`calc/MAGISTER.py`).
- `MAGDATA` — de opgehaalde data, als Python-bron. De parser van Python is het
  dataformaat; de rekenmachine heeft daardoor geen json-module nodig.

## Vereisten

- Chrome 116 of nieuwer op een desktop (Web Serial; dat werkt niet op
  Android of iOS).
- Een USB-C-kabel naar de TI-84 Evo-T.
- Een Magister-tab waar je op bent ingelogd, als ouder of als leerling.

## Installeren

1. Open `chrome://extensions`.
2. Zet rechtsboven **Ontwikkelaarsmodus** aan.
3. Klik **Uitgepakte extensie laden** en kies de map `extension/`.
4. Het rekenmachine-pictogram verschijnt in de werkbalk.

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

## Het protocol naar de rekenmachine

Nagebouwd uit `evo-send.min.js` van ti84calcwiz.com en daarna tegen het echte
apparaat aan gelegd. Het is **Web Serial**, geen WebUSB: `navigator.serial`
met een filter op VID `0x0451` en PID `0xE018`, 115200 baud.

De framing is Kermit:

- Pakket: `[SOH 0x01][len+32][seq+32][type][data][checksum][CR]`.
- Is `len` groter dan 80, of is het een `F`-pakket, dan wordt de lengtebyte 32
  en volgen er twee lengtetekens base-95 met een eigen header-checksum.
- Checksum: `(32 + ((som + ((som & 0xC0) >> 6)) & 63)) & 255`.
- Escaping: bytes onder 32, plus 127 en 255, worden `#` gevolgd door
  `64 ^ byte`; een letterlijke `#` of `~` krijgt er een `#` voor.
- Volgorde: `S` (send-init) -> `F` -> `A` -> `D`* -> `Z` -> `B`, elk met een
  `Y` terug. Een `E` betekent fout.
- Een datapakket bevat hoogstens 2000 **ge-escapete** bytes, en nooit een
  escape-paar dat doormidden geknipt is.

De bestandsnaam in het `F`-pakket is een URL:
`hh01/xfr/var?name=<naam>&type=15&memtarget=0&policy=1` -- `type=15` voor een
Python-programma, `type=2` voor TI-BASIC.

De payload is CBOR: een map met `metaData` (`type`, `version`, `flags`, en
`name` als UTF-16LE), `version`, `size` en `data`, met daarachter een 16-bits
XOR-checksum over die map. In `data` zit de programmacontainer --
`[0x13 0x01 0x00 0x00]`, `u32` totale lengte, `u32` naamlengte, de naam, een
nulbyte, `u16` bronlengte, `[0x00 0x02]`, de broncode -- aangevuld met nullen
tot de totale lengte.

Programmanamen zijn 1 tot 8 tekens uit A-Z en 0-9 en beginnen met een letter.
Voor de URL en de metadata gaan ze naar TI's private use area: A-Z vanaf
`0xE800`, 0-9 vanaf `0xE401`.

**Web Serial werkt niet in een service worker.** De poort moet in een pagina
leven, en dat bepaalt de hele opbouw van de extensie.

## Wat er met je token gebeurt

Het content script op de Magister-pagina leest het toegangstoken uit de
`sessionStorage` van je eigen tab en geeft het door aan het paneel. Daar
belandt het in de `Authorization`-header van de verzoeken aan Magister, en
nergens anders: niet in `chrome.storage`, niet in de console en niet in een
foutmelding. In `chrome.storage.local` staan alleen `kindId`, `kindNaam` en
`laatsteSync`.

Omdat het token uit het content script komt en niet via `chrome.scripting`,
blijft het bij een permissie en een host:

| Wat | Waarvoor |
| --- | --- |
| `storage` | Onthouden voor welk kind deze rekenmachine is, en wanneer er voor het laatst is gesynct. |
| `https://*.magister.net/*` | De pagina waar het content script op draait, en de enige plek waar de extensie gegevens ophaalt. |

Verder gaat er niets naar buiten: geen server, geen account, geen analytics.
De gegevens lopen van je eigen Magister-tab rechtstreeks de USB-kabel in.

Eén randgeval hoort erbij. Een tab die al openstond toen de extensie werd
geinstalleerd of bijgewerkt, draait nog geen content script en antwoordt dus
niet. Dat is iets anders dan niet ingelogd zijn, en het krijgt daarom zijn
eigen scherm: herlaad de Magister-tab. Je ziet het ook aan de sidebar -- staat
het menu-item er niet, dan is dat dezelfde oorzaak.

## Wat Magister eigenaardig doet

Vijf dingen die je alleen op de tast vindt, en die elk een keer een sync
hebben gekost.

**Twee API-generaties leven naast elkaar.** `/api/personen/...` antwoordt in
PascalCase (`Items`, `TotalCount`), `/api/leerlingen/...` in camelCase
(`items`, `totalCount`). De client vangt beide vormen af.

**`actievePerioden` moet een waarde hebben.** Leeg meesturen levert HTTP 400
met "The value '' is invalid." -- geen uitleg waar je iets aan hebt, alleen
een 400 op een call die er verder goed uitziet.

**`peildatum` is verplicht zodra het schooljaar is afgesloten.** Zonder die
parameter geeft het cijferoverzicht `{"Items": [], "TotalCount": 0}` terug:
status 200, geen fout, geen waarschuwing, gewoon niets. Voor het lopende jaar
moet hij er juist niet in.

**Tijden zijn echte UTC.** `Start` komt binnen als `2026-09-01T07:45:00Z`
terwijl dat lesuur 2 is. Rauw gelezen loopt de schooldag van 07:00 tot 14:30,
een dag die niet bestaat. De extensie rekent om naar Europe/Amsterdam en
stuurt kant-en-klare kloktijden mee; de rekenmachine heeft geen
tijdzonedatabase.

**Cijfers zijn niet altijd getallen.** In een steekproef van 172 rijen: 135
kommagetallen, 16 gehele, 17 keer tekst (`g`, `o`, `vr`) en 4 leeg. Sorteren,
rekenen en kleuren moeten daar alle drie tegen kunnen. De gemiddeldes komen
van Magister zelf, uit de berekende kolommen en de periode `GEM`; zelf wegen
naspelen zou de schoolregels net anders raden.

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

## De lettermaat op het scherm

De hele layout hangt aan twee gemeten getallen, en allebei weken ze af van wat
we eerst aannamen.

**Een teken is 10 px breed en er passen er 32 op een regel.** Gemeten met een
liniaal van 48 verschillende tekens vanaf x=0: het laatste volledig zichtbare
teken is nummer 32, en 319 / 32 = 9,97. Bij de aangenomen 8 px waren het er 39
geweest, en elke rechts uitgelijnde of gecentreerde tekst stond dus verkeerd.

**`draw_text(x, y, s)` zet het letterblok op `[y-18, y-3]`, en dat blok is 16
px hoog.** De kleinste regelafstand zonder dat staarten elkaar raken is daarmee
16 px, niet de aangenomen 11. Drie metingen op het apparaat wijzen alle drie
precies die ankerpositie aan en geen enkele andere. De app rekent daarom
overal met de **bovenkant** van het letterblok, want dat is wat je tegen een
balk aan uitlijnt.

`tests/layoutregels.py` bewaakt beide getallen met vier regels die over een
heel beeld gaan in plaats van over een losse aanroep: alles blijft binnen het
scherm, tekstblokken overlappen elkaar niet, tekst staat op een andere kleur
dan zichzelf, en tekst blijft binnen het vlak waar hij bij hoort. Ze bestaan
omdat de suite eerder fouten liet passeren die op het apparaat meteen te zien
waren.

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
