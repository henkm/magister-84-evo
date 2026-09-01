"""Nep-ti_draw die elke oproep vastlegt, zodat het pixelraster testbaar is."""
import sys
import types

calls = []


def _record(naam):
    def f(*args):
        calls.append((naam,) + args)
    return f


def reset():
    calls.clear()


# Gemeten op een TI-84 Evo-T op 2026-09-01: fill_rect(0, 39, 319, 1) sloopte
# de app met "tidrawException: Height cannot be negative", terwijl 17 en 22
# hoog in hetzelfde beeld wel gingen. Een neppe ti_draw die alles slikt laat
# zoiets ongemerkt door de hele suite komen, dus doet deze dat niet meer.
# De ondergrens is niet exact gemeten (1 faalt, 17 werkt); 2 is de zuinigste
# aanname die het gemeten geval afvangt. Een streep hoort met draw_line.
MIN_ZIJDE = 2


def _rechthoek(naam):
    def f(x, y, w, h):
        if w < MIN_ZIJDE or h < MIN_ZIJDE:
            raise ValueError(
                "%s(%d, %d, %d, %d): het apparaat weigert een rechthoek "
                "dunner dan %d pixel" % (naam, x, y, w, h, MIN_ZIJDE))
        calls.append((naam, x, y, w, h))
    return f


def install():
    d = types.ModuleType("ti_draw")
    for naam in ("set_color", "draw_line", "draw_text", "show_draw", "clear"):
        setattr(d, naam, _record(naam))
    for naam in ("fill_rect", "draw_rect"):
        setattr(d, naam, _rechthoek(naam))
    d.get_screen_dim = lambda: [319, 209]
    # MAGISTER.py start zichzelf zodra ti_draw echt is; dit merk houdt hem
    # tegen bij import in de testsuite, waar de tests main() zelf aanroepen.
    d.IS_NEP = True
    sys.modules["ti_draw"] = d

    s = types.ModuleType("ti_system")
    s.wait_key = lambda: 0
    sys.modules["ti_system"] = s
