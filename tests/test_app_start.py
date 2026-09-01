"""Start de app zichzelf als het apparaat hem start?

Gemeten op een TI-84 Evo-T op 2026-09-01: MAGISTER stond erop, maar draaien
deed hij niet. De shell liet zien waarom -- de Evo start een programma met
"from MAGISTER import *", dus __name__ is daar "MAGISTER" en niet "__main__".
De main-guard onderaan het bestand vuurde er nooit, en dat zag eruit als een
wit scherm dat meteen weer dichtging, zonder foutmelding.

De rest van de suite kan dit niet zien: die importeert MAGISTER juist om main()
zelf aan te roepen. Deze test doet het als het apparaat.
"""
import sys
import types

TEKENFUNCTIES = ("set_color", "fill_rect", "draw_rect", "draw_line",
                 "draw_text", "show_draw", "clear")

K_CLEAR = 45          # gemeten toetscode; sluit de app vanaf vandaag


def _apparaat():
    """Een ti_draw zoals op het apparaat: opnemend, maar niet als nep gemerkt."""
    calls = []
    d = types.ModuleType("ti_draw")

    def maak(naam):
        def f(*args):
            calls.append((naam,) + args)
        return f

    for naam in TEKENFUNCTIES:
        setattr(d, naam, maak(naam))
    d.get_screen_dim = lambda: [319, 209]
    s = types.ModuleType("ti_system")
    s.wait_key = lambda: K_CLEAR
    return d, s, calls


def test_de_app_start_zichzelf_zoals_de_evo_hem_start():
    d, s, calls = _apparaat()
    origineel = {n: sys.modules.get(n)
                 for n in ("ti_draw", "ti_system", "MAGISTER")}
    sys.modules["ti_draw"] = d
    sys.modules["ti_system"] = s
    sys.modules.pop("MAGISTER", None)
    try:
        import MAGISTER  # noqa: F401  -- dit is "from MAGISTER import *"
    finally:
        for naam, mod in origineel.items():
            if mod is None:
                sys.modules.pop(naam, None)
            else:
                sys.modules[naam] = mod

    assert [c for c in calls if c[0] == "draw_text"], \
        "de app tekende niets bij import: op het apparaat start hij dus niet"
    assert [c for c in calls if c[0] == "show_draw"], \
        "er is getekend maar nooit geflusht; het scherm blijft dan leeg"
