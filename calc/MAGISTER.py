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
    vlak(311, 42, 4, 138, BAND)
    hoogte = max(8, 138 * zichtbaar // totaal)
    top = 42 + (138 - hoogte) * eerste // max(1, totaal - zichtbaar)
    vlak(311, top, 4, hoogte, AZUUR)
