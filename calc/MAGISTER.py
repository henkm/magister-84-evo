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
    tekst(TEKST_X, y + 16, rij[L_DOCENT], GEDEMPT)

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
