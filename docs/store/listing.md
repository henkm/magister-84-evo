# Wat je waar invult in de Chrome Web Store

Alles wat de console uitvraagt staat hier klaar om te plakken. De teksten voor
gebruikers zijn Nederlands; de verantwoordingen zijn Engels, want die worden
door een beoordelaar van Google gelezen.

Zip bouwen: `python3 -m tools.pak` -> `dist/rooster-naar-je-rekenmachine-1.0.0.zip`

---

## Tabblad "Store listing"

**Naam** (uit het manifest, 28 tekens)

```
Rooster naar je rekenmachine
```

**Korte omschrijving** (89 van de 132 tekens)

```
Stuurt het rooster en de cijfers uit je eigen Magister-tab over USB naar een TI-84 Evo-T.
```

**Uitgebreide omschrijving**

```
Je rooster en je cijfers op je grafische rekenmachine, zodat je ze in de les
bij je hebt zonder je telefoon te pakken.

Deze extensie leest het rooster en de cijferlijst uit de Magister-tab waar je
zelf al op bent ingelogd, en zet ze over de USB-kabel op een TI-84 Evo-T. Op
de rekenmachine staat daarna een app die werkt zonder internet:

• Vandaag in een oogopslag: welke les, hoe laat, welk lokaal, welke docent.
• Vier weken vooruit bladeren, met huiswerk en mededelingen per les.
• De cijferlijst van dit schooljaar, per vak, met het gemiddelde erbij.
• Gewijzigde en vervallen lessen staan er duidelijk bij.

Zo werkt het: open Magister, klik op "Rekenmachine" in het menu (of op het
pictogram in de werkbalk), sluit de rekenmachine aan en klik op "Nu syncen".
De eerste keer vraagt Chrome eenmalig toestemming voor het apparaat.

Ben je ouder met meer dan een kind, dan kies je eenmalig voor wie deze
rekenmachine is. Die keuze wordt onthouden.

Wat er niet gebeurt: er is geen server, geen account en geen analytics. Je
gegevens gaan van je eigen Magister-tab rechtstreeks de kabel in, en verder
nergens heen. De broncode is openbaar.

Nodig: Chrome 116 of nieuwer op een desktop (Web Serial werkt niet op Android
of iOS), een USB-C-kabel, en een TI-84 Plus CE-T Python Edition ("Evo-T").

Deze extensie is gemaakt door een ouder en staat los van Magister, Iddink
Group en Texas Instruments.
```

**Categorie**: Education
**Taal**: Nederlands
**Support-URL**: `https://github.com/henkm/magister-84-evo/issues`

---

## Tabblad "Privacy practices"

**Single purpose description**

```
This extension has one purpose: to copy the signed-in user's own school
timetable and grades from Magister (a Dutch school administration system) onto
a TI-84 Plus CE-T Python Edition calculator connected over USB, so the student
can see them offline on their calculator.
```

**Justification: `storage`**

```
Stores three values so the user does not have to repeat a choice on every
sync: which child this calculator belongs to (id and first name, for parent
accounts with more than one child) and the timestamp of the last sync, which
is shown on the panel. No timetable data, no grades and no credentials are
stored.
```

**Justification: host permission `https://*.magister.net/*`**

```
Magister gives every school its own subdomain (school.magister.net), so a
single fixed host would only work for one school. The extension needs this
access for two things: a content script on the page, which reads the OAuth
access token from the tab's own sessionStorage and renders a menu entry in the
Magister sidebar, and the API calls to that same tenant that fetch the
timetable and the grades. No other site is accessed.
```

**Remote code**: No, I am not using remote code.
Alle code zit in het pakket. Er wordt niets ingeladen van een CDN, er is geen
`eval`, en de Python-broncode die naar de rekenmachine gaat wordt in de browser
opgebouwd uit `calc/MAGISTER.py` uit het pakket zelf.

**Data usage — aankruisen**

- [x] Personally identifiable information — de voornaam van de leerling
- [x] Authentication information — het toegangstoken uit de eigen sessie
- [x] Website content — rooster en cijfers uit de Magister-API

Aanvinken en niet minder, ook al gaat er niets naar de maker. Google rekent
elke overdracht die het apparaat verlaat mee, en de aanroepen naar Magister
verlaten het apparaat. Te weinig aankruisen is een beleidsovertreding; te veel
aankruisen kost hooguit een regel in de listing die het privacybeleid daarna
uitlegt.

**De drie verklaringen**: alle drie aanvinken. Ze zijn alle drie waar — er
wordt niets verkocht, niets voor een ander doel gebruikt en niets voor
kredietwaardigheid gebruikt.

**Privacy policy URL**

```
https://github.com/henkm/magister-84-evo/blob/main/PRIVACY.md
```

De repo moet daarvoor openbaar staan.

---

## Notes for the reviewer

Plak dit in het veld voor de beoordelaar. Zonder deze uitleg loopt hij vast:
hij kan niet inloggen op Magister, want zo'n account hangt aan een school.

```
Testing without a Magister account:

This extension reads data from Magister, a Dutch school administration system.
Accounts are issued by individual schools to parents and students, so I cannot
provide test credentials.

To see the full interface without an account, open the extension's panel with
the demo flag:

  chrome-extension://<EXTENSION_ID>/panel.html?demo=1

That renders every screen with built-in sample data (invented names, no real
student data) and touches neither Magister nor the serial port. Add
&scherm=<name> to jump to a specific screen: kind-kiezen, klaar, koppelen,
bezig, gereed, fout. For the error screens, &soort=<kind> selects which error,
for example ?demo=1&scherm=fout&soort=geen-rekenmachine.

The hardware side needs a TI-84 Plus CE-T Python Edition over USB and cannot
be exercised without the device. The transfer uses the Web Serial API
(navigator.serial), filtered on USB vendor 0x0451 / product 0xE018.

Full source: https://github.com/henkm/magister-84-evo
```

---

## Beeldmateriaal

| Wat | Eis | Waar |
| --- | --- | --- |
| Pictogram | 128x128 PNG | `extension/icons/icon-128.png` |
| Screenshot 1 | 1280x800 | `screenshots/1-klaar.png` |
| Screenshot 2 | 1280x800 | `screenshots/2-kind-kiezen.png` |
| Screenshot 3 | 1280x800 | `screenshots/3-gereed.png` |
| Screenshot 4 | 1280x800 | `screenshots/4-bezig.png` |
| Kleine promotietegel | 440x280, optioneel | nog niet gemaakt |

De vier screenshots komen uit de demostand van het paneel, dus met de verzonnen
namen Fenna en Sem en zonder een echte Magister-sessie.

Er hoort er nog een bij, en dat is de belangrijkste: een foto van de
rekenmachine met het rooster erop. Dat is het beeld dat vertelt waar dit over
gaat, en dat kan alleen een foto zijn.

**Opnieuw maken.** Vanuit de wortel van de repo:

```bash
python3 -m http.server 8765
```

Open dan `http://localhost:8765/docs/store/schermafdruk.html?scherm=klaar` in
een venster van 1280x800 en maak een schermafdruk; herhaal voor `kind-kiezen`,
`gereed` en `bezig`. Op een scherm met dubbele pixeldichtheid komt er 2560x1600
uit; terugbrengen met:

```bash
sips -z 800 1280 docs/store/screenshots/*.png
```

`schermafdruk.html` meet zelf hoe hoog het paneel op elk scherm is, dus na een
wijziging in het paneel klopt de omlijsting nog steeds.

---

## Voor de volgende versie

Verhoog `version` in `extension/manifest.json` (de store weigert een upload met
een versie die er al is), draai `python3 -m tools.pak` en upload de nieuwe zip.
