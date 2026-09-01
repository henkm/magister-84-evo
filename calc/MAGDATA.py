"""Handgeschreven testfixture -- geen scaffolding, geen leftover.

tests/conftest.py zet calc/ op sys.path, dus dit bestand is de MAGDATA
waarmee het grootste deel van de testsuite draait: elke test die MAGISTER.py
importeert zonder zelf M.DAGEN/M.VAKKEN te vervangen, tekent met de data
hieronder. Plan 2 heeft zijn eigen generator (extension/src/genereer.js,
uitgevoerd door de extensie op een echt Magister-account); dit bestand is
daar bewust geen vervanging van, maar de vaste, met de hand samengestelde
input voor de Python-kant van de suite. Verwijderen betekent: de suite valt
om.

De vorm volgt wat de generator uitvoert (zie genereer.js/cijfers.js): het
scheidingsteken in de cijfermeta is " · " (middenpunt, gemeten zichtbaar op
het apparaat), en GESYNCT_UREN staat op 0 -- de generator kan hem zonder
klok op het apparaat nooit laten oplopen, dus dat is de enige waarde die
ooit uit een sync komt. Boven de 24 (de staleness-drempel in MAGISTER.py)
komt hij dus nooit vandaan; dat pad wordt alleen getest door de waarde
tijdelijk te overschrijven, niet door deze fixture.
"""

GESYNCT = "gesynct 07:41"
GESYNCT_UREN = 0
LEERLING = "Fenna"
PERIODE = "P1"

DAGEN = [
    ("2026-09-01", "di 01-09", "vandaag", [
        ("les", "09:00", "09:45", "1", "wiskunde B", "118", "Alting (ALT)",
         "normaal", "", "", ""),
        ("gat", "09:45", "10:30", "", "", "", "", "normaal", "", "", ""),
        ("les", "10:30", "12:00", "3-4", "natuurkunde", "206", "Bos (BOS)",
         "normaal", "TOETS", "hoofdstuk 1 tot en met 3 leren", "SO H1-H3"),
        ("les", "12:30", "13:15", "5", "nederlands", "105", "Vermeer (VMR)",
         "vervallen", "VERVALT", "", ""),
        ("les", "13:15", "14:00", "6", "engels", "112", "de Wit (DWT)",
         "gewijzigd", "GEWIJZIGD", "", "lokaal gewijzigd"),
        ("les", "14:00", "14:45", "7", "geschiedenis", "203", "Jansen (JNS)",
         "normaal", "HW", "bronnenopdracht afmaken", ""),
    ]),
    ("2026-09-02", "wo 02-09", "morgen", [
        ("les", "09:00", "09:45", "1", "aardrijkskunde", "301", "Smit (SMT)",
         "normaal", "", "", ""),
        ("les", "09:45", "10:30", "2", "wiskunde B", "118", "Alting (ALT)",
         "normaal", "", "", ""),
    ]),
    ("2026-09-05", "za 05-09", "weekend", []),
]

VAKKEN = [
    ("wiskunde B", "7,2", [
        ("SO hoofdstuk 1", "6,8", "12-06 · P1 · telt mee", "normaal"),
        ("Proefwerk H1-H2", "7,6", "26-06 · P1 · telt mee", "normaal"),
    ]),
    ("natuurkunde", "5,1", [
        ("Practicum", "5,1", "14-06 · P1 · telt mee", "onvoldoende"),
    ]),
    ("lichamelijke opvoeding", "", [
        ("Inhaalmoment", "vr", "01-06 · P1 · vrijstelling", "tekst"),
    ]),
]
