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


def install():
    d = types.ModuleType("ti_draw")
    for naam in ("set_color", "fill_rect", "draw_rect", "draw_line",
                 "draw_text", "show_draw", "clear"):
        setattr(d, naam, _record(naam))
    d.get_screen_dim = lambda: [319, 209]
    # MAGISTER.py start zichzelf zodra ti_draw echt is; dit merk houdt hem
    # tegen bij import in de testsuite, waar de tests main() zelf aanroepen.
    d.IS_NEP = True
    sys.modules["ti_draw"] = d

    s = types.ModuleType("ti_system")
    s.wait_key = lambda: 0
    sys.modules["ti_system"] = s
