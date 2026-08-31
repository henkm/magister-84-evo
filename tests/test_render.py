import MAGISTER as M

def vlakken(calls):
    return [c for c in calls if c[0] == "fill_rect"]

def teksten(calls):
    return [c for c in calls if c[0] == "draw_text"]

def test_kop_matches_the_design_grid(tekeningen):
    M.kop("VANDAAG", "ma 31-08")
    assert ("fill_rect", 0, 0, 319, 22) in vlakken(tekeningen)
    assert ("draw_text", 6, 6, "VANDAAG") in teksten(tekeningen)
    assert ("draw_text", M.right_x("ma 31-08"), 6, "ma 31-08") in teksten(tekeningen)

def test_contextbalk_and_separator(tekeningen):
    M.contextbalk("7 lessen", "gesynct 07:41")
    assert ("fill_rect", 0, 22, 319, 17) in vlakken(tekeningen)
    assert ("fill_rect", 0, 39, 319, 1) in vlakken(tekeningen)
    assert ("draw_text", 6, 25, "7 lessen") in teksten(tekeningen)

def test_stale_data_gets_an_orange_marker(tekeningen):
    M.contextbalk("morgen", "gesynct 2 dgn", verouderd=True)
    assert ("fill_rect", 169, 26, 6, 6) in vlakken(tekeningen)

def test_voetbalk_sits_at_192(tekeningen):
    M.voetbalk("^v kies  ENTER open  <> dag", "2 cijf")
    assert ("fill_rect", 0, 192, 319, 17) in vlakken(tekeningen)
    assert ("draw_text", 6, 196, "^v kies  ENTER open  <> dag") in teksten(tekeningen)

def test_scrollbar_track_and_thumb(tekeningen):
    M.scrollbar(0, 5, 10)
    assert ("fill_rect", 311, 42, 4, 138) in vlakken(tekeningen)
    assert ("fill_rect", 311, 42, 4, 69) in vlakken(tekeningen)

def test_nothing_is_drawn_below_the_screen(tekeningen):
    M.kop("VANDAAG", "ma 31-08")
    M.voetbalk("x")
    for c in tekeningen:
        if c[0] in ("fill_rect", "draw_rect"):
            assert c[2] + c[4] <= M.SCREEN_H
        if c[0] == "draw_text":
            assert c[2] <= M.SCREEN_H
