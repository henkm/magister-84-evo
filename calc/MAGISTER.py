"""Magister op de TI-84 Evo-T. Eén bestand, want de Evo kent geen packages."""

try:
    import ti_draw as D
    from ti_system import wait_key
except ImportError:      # op de Mac tijdens tests
    D = None
    wait_key = None

# --- gemeten op het apparaat, niet aangenomen ---
ADVANCE = 10
LINE = 11
SCREEN_W = 319
SCREEN_H = 209
RIGHT = 313
MAX_TEKENS = 32     # gemeten: het 32e teken is nog volledig zichtbaar op 319 px breedte

# --- palet ---
BLAUW = (11, 107, 181)
AZUUR = (30, 150, 239)
BAND = (233, 244, 253)
SELECTIE = (214, 233, 250)
PAGINA = (244, 249, 254)
WIT = (255, 255, 255)
DONKER = (16, 49, 79)
GEDEMPT = (91, 123, 152)
ORANJE = (245, 130, 11)


def text_width(s):
    return len(s) * ADVANCE


def fits(s, px):
    return text_width(s) <= px


def right_x(s):
    return RIGHT - text_width(s)


def truncate(s, px):
    # If budget cannot hold even one character, return empty string
    if px < ADVANCE:
        return ""
    if fits(s, px):
        return s
    ruimte = px - ADVANCE          # één teken voor de punt
    woorden = s.split(" ")
    uit = ""
    for w in woorden:
        kandidaat = w if not uit else uit + " " + w
        # Include word if text + dot fits within px
        if text_width(kandidaat) + ADVANCE > px:
            break
        uit = kandidaat
    if not uit:
        uit = s[:max(0, ruimte // ADVANCE)]
    return uit + "."


def wrap(s, px):
    # If budget cannot hold even one character, return empty list
    if px < ADVANCE:
        return []

    regels, huidig = [], ""
    for w in s.split(" "):
        kandidaat = w if not huidig else huidig + " " + w
        if fits(kandidaat, px):
            huidig = kandidaat
        else:
            if huidig:
                regels.append(huidig)
            # Hard-break words that don't fit on their own line
            while w:
                if fits(w, px):
                    huidig = w
                    break
                else:
                    # Fill a line with as many characters as fit
                    chars_per_line = px // ADVANCE
                    regel = w[:chars_per_line]
                    regels.append(regel)
                    w = w[chars_per_line:]
            else:
                # If w became empty after the loop (which shouldn't happen with while w),
                # reset huidig
                if not w:
                    huidig = ""
    if huidig:
        regels.append(huidig)
    return regels


# --- veldconstanten voor DAGEN[i][3] ---
L_SOORT, L_BEGIN, L_EIND, L_UUR, L_VAK, L_LOKAAL, L_DOCENT, \
    L_STATUS, L_CHIP, L_TEKST, L_OMS = range(11)

try:
    from MAGDATA import (GESYNCT, GESYNCT_UREN, LEERLING, PERIODE,
                         DAGEN, VAKKEN)
    _DATA_FOUT = ""
except Exception as e:       # ontbrekend of halverwege afgebroken
    GESYNCT, GESYNCT_UREN, LEERLING, PERIODE = "", 0, "", ""
    DAGEN, VAKKEN = [], []
    _DATA_FOUT = str(e)


def data_ok():
    return not _DATA_FOUT and len(DAGEN) > 0


def dag_index(datum):
    for i in range(len(DAGEN)):
        if DAGEN[i][0] == datum:
            return i
    return 0


# --- tekenlaag: het vaste raster ---

def kleur(rgb):
    D.set_color(rgb[0], rgb[1], rgb[2])


def vlak(x, y, w, h, rgb):
    kleur(rgb)
    D.fill_rect(x, y, w, h)


def tekst(x, y, s, rgb):
    kleur(rgb)
    D.draw_text(x, y, s)


def rand(x, y, w, h, rgb):
    kleur(rgb)
    D.draw_rect(x, y, w, h)


def kop(titel, rechts=""):
    vlak(0, 0, 319, 22, BLAUW)
    tekst(6, 6, titel, WIT)
    if rechts:
        tekst(right_x(rechts), 6, rechts, WIT)


def contextbalk(links, rechts="", verouderd=False):
    vlak(0, 22, 319, 17, WIT)
    if links:
        tekst(6, 25, links, BLAUW)
    if verouderd:
        vlak(169, 26, 6, 6, ORANJE)
    if rechts:
        x = 181 if verouderd else right_x(rechts)
        tekst(x, 25, rechts, GEDEMPT)
    vlak(0, 39, 319, 1, AZUUR)


def voetbalk(links, rechts=""):
    vlak(0, 192, 319, 17, BLAUW)
    tekst(6, 196, links, WIT)
    if rechts:
        tekst(257, 196, rechts, WIT)


def scrollbar(eerste, zichtbaar, totaal):
    if totaal <= zichtbaar:
        return
    eerste = max(0, min(eerste, totaal - zichtbaar))
    vlak(311, 42, 4, 138, BAND)
    hoogte = max(8, 138 * zichtbaar // totaal)
    top = 42 + (138 - hoogte) * eerste // (totaal - zichtbaar)
    vlak(311, top, 4, hoogte, AZUUR)


# --- tekenlaag: de lesregel ---

BADGE_X = 54
BADGE_W = 36
TEKST_X = 96

CHIP_KLEUR = {
    "HW": BLAUW,
    "TOETS": ORANJE,
    "GEWIJZIGD": ORANJE,
    "VERVALT": GEDEMPT,
}


def chip_breedte(label):
    return text_width(label) + 8


def _lesregel_kleuren(status):
    if status == "vervallen":
        return WIT, GEDEMPT, GEDEMPT, GEDEMPT
    if status == "gewijzigd":
        return BAND, ORANJE, BLAUW, DONKER
    return BAND, AZUUR, BLAUW, DONKER


def lesregel(y, rij, geselecteerd=False):
    band, accent, badge, voorgrond = _lesregel_kleuren(rij[L_STATUS])
    if geselecteerd:
        band = SELECTIE
    vlak(0, y, 319, 26, band)
    vlak(0, y, 4, 26, accent)

    tekst(8, y + 5, rij[L_BEGIN], GEDEMPT)
    tekst(8, y + 16, rij[L_EIND], GEDEMPT)

    vlak(BADGE_X, y + 4, BADGE_W, 18, badge)
    uur = rij[L_UUR]
    tekst(BADGE_X + (BADGE_W - text_width(uur)) // 2, y + 8, uur, WIT)

    chip = rij[L_CHIP]
    if chip:
        beschikbaar = RIGHT - chip_breedte(chip) - 8 - TEKST_X
    else:
        beschikbaar = RIGHT - TEKST_X

    # De kolom is voor het hele blok (vak + lokaal), niet alleen het vak: het
    # lokaal wint als de ruimte krap is, want dat is wat je in de gang nodig
    # hebt. Past het vak dan niet eens voor één teken, dan vervalt het lokaal.
    lokaal = ("- " + rij[L_LOKAAL]) if rij[L_LOKAAL] else ""
    reserve = text_width(lokaal) + ADVANCE if lokaal else 0
    vak_ruimte = beschikbaar - reserve
    if lokaal and vak_ruimte < ADVANCE:
        lokaal = ""
        vak_ruimte = beschikbaar

    vak = truncate(rij[L_VAK], vak_ruimte)
    tekst(TEKST_X, y + 5, vak, voorgrond)
    breedte = text_width(vak)
    if lokaal:
        tekst(TEKST_X + breedte + ADVANCE, y + 5, lokaal, GEDEMPT)
        breedte += ADVANCE + text_width(lokaal)
    docent = truncate(rij[L_DOCENT], RIGHT - TEKST_X)
    tekst(TEKST_X, y + 16, docent, GEDEMPT)

    if rij[L_STATUS] == "vervallen":
        vlak(TEKST_X, y + 10, breedte, 1, GEDEMPT)

    if chip:
        b = chip_breedte(chip)
        vlak(RIGHT - b, y + 6, b, 14, CHIP_KLEUR[chip])
        tekst(RIGHT - b + 4, y + 8, chip, WIT)

    if geselecteerd:
        rand(0, y, 317, 24, BLAUW)


def gatregel(y, rij):
    vlak(8, y + 4, 64, 1, GEDEMPT)
    vlak(256, y + 4, 55, 1, GEDEMPT)
    tekst(80, y, "tussenuur %s-%s" % (rij[L_BEGIN], rij[L_EIND]), GEDEMPT)


# --- tekenlaag: het roosterscherm ---

RIJ_PITCH = 28
LIJST_Y = 42
ZICHTBAAR = 5


def is_onvoldoende(cijfer):
    """Waar bij een cijfer onder de 5,5. Niet-getallen zijn nooit onvoldoende.

    Let op: dit moet numeriek, niet als tekst. Bij een tekstvergelijking is
    "10,0" kleiner dan "5,5" en zou een tien rood kleuren.
    """
    if not cijfer:
        return False
    try:
        return float(cijfer.replace(",", ".")) < 5.5
    except ValueError:
        return False


def mededeling(regel1, regel2=""):
    vlak(24, 96, 271, 40, BAND)
    vlak(24, 96, 4, 40, AZUUR)
    tekst(40, 105, regel1, DONKER)
    if regel2:
        tekst(40, 119, regel2, GEDEMPT)


def _volgende_lesdag(i):
    for j in range(i + 1, len(DAGEN)):
        if DAGEN[j][3]:
            return DAGEN[j][1]
    return ""


def toon_dag(i, selectie=0, scroll=0):
    datum, kop_datum, bijschrift, rijen = DAGEN[i]
    lessen = [r for r in rijen if r[L_SOORT] == "les"]
    vandaag = bijschrift == "vandaag"
    vlak(0, 0, 319, 209, PAGINA)
    if vandaag:
        kop("VANDAAG", kop_datum)
        contextbalk("%d lessen" % len(lessen), GESYNCT, GESYNCT_UREN >= 24)
    else:
        kop("ROOSTER", "< " + kop_datum + " >")
        contextbalk(bijschrift, GESYNCT, GESYNCT_UREN >= 24)

    if not rijen:
        volgende = _volgende_lesdag(i)
        mededeling("geen lessen op deze dag",
                   "volgende lesdag: " + volgende if volgende else "")
        voetbalk("<> dag  CLR vandaag  2 cijfers")
        return

    # scrollbar() clamps zijn eigen argumenten, maar dat beschermt alleen de
    # duimpositie. Zonder deze clamp scrollt de lijst zelf voorbij het einde
    # en blijft er lege ruimte over onder in het scherm.
    scroll = max(0, min(scroll, max(0, len(rijen) - ZICHTBAAR)))
    zichtbaar = rijen[scroll:scroll + ZICHTBAAR]
    for n in range(len(zichtbaar)):
        y = LIJST_Y + n * RIJ_PITCH
        rij = zichtbaar[n]
        if rij[L_SOORT] == "gat":
            gatregel(y, rij)
        else:
            lesregel(y, rij, geselecteerd=(scroll + n == selectie))

    rest = len(rijen) - scroll - ZICHTBAAR
    if rest > 0:
        tekst(8, 181, "v %d lessen meer" % rest, GEDEMPT)
    scrollbar(scroll, ZICHTBAAR, len(rijen))
    if vandaag:
        voetbalk("^v kies  ENTER open  <> dag", "2 cijf")
    else:
        voetbalk("<> dag  ENTER open  CLR vandaag")


# --- tekenlaag: lesdetail, vakkenlijst en cijfers ---

def toon_lesdetail(dag_i, rij_i, scroll=0):
    rijen = DAGEN[dag_i][3]
    rij = rijen[rij_i]
    vlak(0, 0, 319, 209, PAGINA)
    kop("LESUUR " + rij[L_UUR], DAGEN[dag_i][1])

    _, accent, badge, voorgrond = _lesregel_kleuren(rij[L_STATUS])
    vlak(0, 22, 319, 52, BAND)
    vlak(0, 22, 4, 52, accent)
    vlak(10, 30, BADGE_W, 18, badge)
    tekst(10 + (BADGE_W - text_width(rij[L_UUR])) // 2, 34, rij[L_UUR], WIT)

    chip = rij[L_CHIP]
    chip_b = chip_breedte(chip) if chip else 0

    # De tijd staat rechts uitgelijnd in plaats van op een vaste x: "hh:mm-
    # hh:mm" is altijd 110px breed, en op een vaste x=225 loopt dat voorbij
    # de rechterrand (225+110=335 > 319). De vaknaam krijgt zijn budget pas
    # nadat de tijd-positie bekend is, zodat de twee elkaar nooit raken.
    tijd = rij[L_BEGIN] + "-" + rij[L_EIND]
    tijd_x = right_x(tijd)
    tekst(54, 31, truncate(rij[L_VAK], tijd_x - 8 - 54), voorgrond)
    tekst(54, 45, truncate("lokaal " + rij[L_LOKAAL], RIGHT - 54), GEDEMPT)
    # Idem voor de docent: die deelt zijn regel met de chip als die er is.
    docent_breedte = (RIGHT - chip_b - 8 - 54) if chip else (RIGHT - 54)
    tekst(54, 59, truncate(rij[L_DOCENT], docent_breedte), GEDEMPT)
    tekst(tijd_x, 31, tijd, GEDEMPT)
    if chip:
        vlak(RIGHT - chip_b, 57, chip_b, 14, CHIP_KLEUR[chip])
        tekst(RIGHT - chip_b + 4, 59, chip, WIT)

    if rij[L_TEKST]:
        label = "toets" if chip == "TOETS" else "huiswerk"
        vlak(0, 78, 319, 17, WIT)
        tekst(6, 81, label, BLAUW)
        vlak(0, 95, 319, 1, AZUUR)
        # Met een omschrijving erbij is er maar plek voor 4 regels huiswerk-
        # tekst, anders raakt het omschrijving-blok de voetbalk (192).
        max_regels = 4 if rij[L_OMS] else 6
        regels = wrap(rij[L_TEKST], 307)[scroll:scroll + max_regels]
        for n in range(len(regels)):
            tekst(6, 101 + 12 * n, regels[n], DONKER)
        if rij[L_OMS]:
            y_oms = 101 + 12 * len(regels)
            tekst(6, y_oms, "omschrijving", GEDEMPT)
            tekst(6, y_oms + 12, truncate(rij[L_OMS], 307), GEDEMPT)
    elif rij[L_OMS]:
        tekst(6, 101, truncate(rij[L_OMS], 307), GEDEMPT)
    else:
        tekst(6, 101, "geen huiswerk of toets", GEDEMPT)

    voetbalk("<> les  CLEAR terug")


def toon_vakken(selectie=0, scroll=0):
    vlak(0, 0, 319, 209, PAGINA)
    if not VAKKEN:
        kop("VAKKEN", PERIODE)
        contextbalk("gemiddelde per vak", GESYNCT, GESYNCT_UREN >= 24)
        mededeling("nog geen cijfers in " + PERIODE, "dit is geen fout")
        voetbalk("1 rooster  CLEAR terug")
        return

    # De rijen worden vóór kop()/contextbalk() getekend. Puur cosmetisch
    # maakt de volgorde niets uit (de kopband beslaat y=0-39, de rijen
    # beginnen bij y=42, dus niets overlapt); maar kop() tekent zelf een band
    # van 319x22 op y=0 - exact dezelfde afmeting als een vakregel. Zou kop()
    # eerst komen, dan is die band het eerste 319x22-vlak in de tekenlijst en
    # schuift dat de rij-y's in een test die op (breedte, hoogte) filtert.
    zichtbaar = VAKKEN[scroll:scroll + ZICHTBAAR]
    for n in range(len(zichtbaar)):
        y = LIJST_Y + n * 24
        naam, gem, _ = zichtbaar[n]
        onvoldoende = is_onvoldoende(gem)
        accent = ORANJE if onvoldoende else (GEDEMPT if not gem else AZUUR)
        vlak(0, y, 319, 22, SELECTIE if scroll + n == selectie else BAND)
        vlak(0, y, 4, 22, accent)
        # De vaknaam deelt zijn regel met het (rechts uitgelijnde) gemiddelde
        # of met "geen"; het budget wordt van die kolom afgeleid zodat de
        # twee elkaar nooit raken, in plaats van een vaste breedte te gokken.
        kolom = right_x(gem) if gem else 265
        tekst(14, y + 6, truncate(naam, kolom - 8 - 14), DONKER)
        if gem:
            tekst(kolom, y + 6, gem, ORANJE if onvoldoende else DONKER)
        else:
            tekst(kolom, y + 6, "geen", GEDEMPT)
        if scroll + n == selectie:
            rand(0, y, 317, 20, BLAUW)

    kop("VAKKEN", PERIODE)
    contextbalk("gemiddelde per vak", GESYNCT, GESYNCT_UREN >= 24)

    rest = len(VAKKEN) - scroll - ZICHTBAAR
    if rest > 0:
        tekst(8, 161, "v %d vakken meer" % rest, GEDEMPT)
    voetbalk("^v kies  ENTER cijfers", "1 rstr")


def toon_cijfers(vak_i, scroll=0):
    naam, gem, cijfers = VAKKEN[vak_i]
    vlak(0, 0, 319, 209, PAGINA)
    # Ook hier: het titelbudget hangt af van hoeveel ruimte "gem ..." rechts
    # nodig heeft, in plaats van een vaste 240px die bij een lang, spatieloos
    # vaknaam over de rechts uitgelijnde tekst heen kan lopen.
    rechts = "gem " + (gem if gem else "-")
    titel_breedte = right_x(rechts) - 8 - 6
    kop(truncate(naam, titel_breedte).upper(), rechts)
    contextbalk("%d cijfers" % len(cijfers), PERIODE)

    zichtbaar = cijfers[scroll:scroll + ZICHTBAAR]
    for n in range(len(zichtbaar)):
        y = LIJST_Y + n * RIJ_PITCH
        oms, cijfer, meta, soort = zichtbaar[n]
        blokkleur = {"onvoldoende": ORANJE, "tekst": GEDEMPT}.get(soort, BLAUW)
        vlak(0, y, 319, 26, BAND)
        vlak(0, y, 4, 26, blokkleur)
        tekst(14, y + 5, truncate(oms, 267), DONKER)
        tekst(14, y + 16, truncate(meta, 267), GEDEMPT)
        vlak(281, y + 4, 32, 18, blokkleur)
        tekst(281 + (32 - text_width(cijfer)) // 2, y + 8, cijfer, WIT)

    scrollbar(scroll, ZICHTBAAR, len(cijfers))
    voetbalk("^v scroll  CLEAR vakken")
