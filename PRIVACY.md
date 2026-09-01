# Privacybeleid — Rooster naar je rekenmachine

Laatst gewijzigd: 1 september 2026

Deze extensie stuurt niets naar de maker en niets naar derden. Er is geen
server, geen account en geen analytics. Gegevens gaan maar naar twee plekken:
naar Magister zelf, waar ze vandaan komen, en naar de rekenmachine aan je
USB-kabel. Hieronder staat precies wat er gebeurt met alles wat de extensie
onder ogen krijgt.

## Welke gegevens de extensie leest

Alleen wat nodig is om een rooster en een cijferlijst op een rekenmachine te
zetten, en alleen op het moment dat jij op **Nu syncen** klikt:

- je rooster van de komende vier weken (lessen, tijden, lokalen, docenten,
  huiswerk en mededelingen);
- je cijfers van het lopende schooljaar;
- de voornaam van de leerling, om te laten zien voor wie deze rekenmachine is;
- als je een ouderaccount hebt: de lijst met je kinderen, zodat je kunt kiezen.

Die gegevens komen van Magister zelf, uit de sessie waar je in je eigen browser
al op bent ingelogd. De extensie logt niet voor je in en vraagt nooit om een
wachtwoord.

## Waar ze heen gaan

Naar de rekenmachine die met de USB-kabel aan je computer hangt. Verder
nergens. De gegevens gaan niet naar de maker van deze extensie, niet naar een
server, niet naar een andere website en niet naar een advertentienetwerk. Ze
worden niet verkocht en niet gedeeld.

De enige verbindingen die de extensie maakt, gaan naar `magister.net` — dezelfde
plek waar je browser al mee praat als je Magister openhebt.

## Wat er op je computer bewaard blijft

In de lokale opslag van de extensie (`chrome.storage.local`) staan drie dingen:

| Wat | Waarom |
| --- | --- |
| `kindId` | Voor welk kind deze rekenmachine bedoeld is. |
| `kindNaam` | Om die naam op het scherm te tonen. |
| `laatsteSync` | Om te laten zien wanneer je voor het laatst hebt gesynct. |

Meer niet. Het rooster en de cijfers worden niet bewaard: ze worden opgehaald,
omgezet naar een programma en verstuurd, en daarna zijn ze weg.

## Je toegangstoken

Om gegevens bij Magister op te vragen is een toegangstoken nodig. Dat token
staat al in je eigen Magister-tab; de extensie leest het daar uit en gebruikt
het alleen in de `Authorization`-header van de verzoeken aan Magister, voor de
duur van één sync.

Het token wordt **niet** opgeslagen, **niet** naar de console geschreven,
**niet** in een foutmelding opgenomen en **niet** in een URL gezet.

## Verwijderen

- Verwijder je de extensie, dan verdwijnt de lokale opslag met hem mee.
- Op de rekenmachine staan de programma's `MAGISTER` en `MAGDATA`. Die
  verwijder je daar zelf, via het geheugenscherm.

## Kinderen

Deze extensie is bedoeld voor het eigen schoolrooster van de gebruiker of dat
van zijn kind. De gegevens blijven op de eigen computer en de eigen
rekenmachine; er wordt niets over een kind naar buiten gestuurd.

## Vragen

De broncode staat op <https://github.com/henkm/magister-84-evo>. Vragen en
meldingen kunnen daar als issue.

---

# Privacy policy (English summary)

This extension sends nothing to its developer and nothing to any third party.
There is no server, no account and no analytics. Data goes to two places only:
to Magister itself, where it comes from, and to the calculator on your USB
cable.

It reads your own Magister timetable and grades — using the session you are
already signed in to, in your own browser — and writes them over USB to a
TI-84 Evo-T calculator connected to your computer. The data goes nowhere else:
not to the developer, not to any server, not to any third party. It is never
sold or shared.

The only network requests the extension makes go to `magister.net`.

Local storage (`chrome.storage.local`) holds three values: which child this
calculator is for (`kindId`, `kindNaam`) and when the last sync happened
(`laatsteSync`). The timetable and grades are not stored. The access token is
read from the page's own session, used only in the `Authorization` header for
the duration of a single sync, and is never stored, logged, put in an error
message, or placed in a URL.

Uninstalling the extension removes its local storage. The programs on the
calculator (`MAGISTER` and `MAGDATA`) are removed on the device itself.

Source code: <https://github.com/henkm/magister-84-evo>
