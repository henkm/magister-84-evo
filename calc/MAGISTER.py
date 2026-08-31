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
