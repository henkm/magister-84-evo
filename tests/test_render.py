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
    assert ("draw_text", 181, 25, "gesynct 2 dgn") in teksten(tekeningen)

def test_voetbalk_sits_at_192(tekeningen):
    M.voetbalk("^v kies  ENTER open  <> dag", "2 cijf")
    assert ("fill_rect", 0, 192, 319, 17) in vlakken(tekeningen)
    assert ("draw_text", 6, 196, "^v kies  ENTER open  <> dag") in teksten(tekeningen)

def test_scrollbar_track_and_thumb(tekeningen):
    M.scrollbar(0, 5, 10)
    assert ("fill_rect", 311, 42, 4, 138) in vlakken(tekeningen)
    assert ("fill_rect", 311, 42, 4, 69) in vlakken(tekeningen)

def test_nothing_is_drawn_below_the_screen(tekeningen):
    # Exercise all functions with boundary conditions
    M.kop("VANDAAG", "ma 31-08")
    M.contextbalk("7 lessen", "gesynct 07:41")
    M.contextbalk("stale", "old", verouderd=True)
    M.voetbalk("hints", "2 cijf")
    # scrollbar with adversarial arguments
    M.scrollbar(50, 5, 10)      # eerste past the end
    M.scrollbar(-3, 5, 10)      # negative eerste
    M.scrollbar(5, 5, 10)       # last valid position
    M.scrollbar(0, 1, 1)        # single-item list (should return early)

    # Verify all rectangles and text stay within bounds
    for c in tekeningen:
        if c[0] in ("fill_rect", "draw_rect"):
            x, y, w, h = c[1], c[2], c[3], c[4]
            assert y + h <= M.SCREEN_H, f"Rectangle {c} exceeds screen height at y+h={y+h}"
        if c[0] == "draw_text":
            x, y, s = c[1], c[2], c[3]
            assert y <= M.SCREEN_H, f"Text {c} exceeds screen height at y={y}"

def _les(**kw):
    r = ["les", "10:30", "12:00", "3-4", "natuurkunde", "206", "Bos (BOS)",
         "normaal", "", "", ""]
    for k, v in kw.items():
        r[getattr(M, "L_" + k.upper())] = v
    return tuple(r)

def test_lesson_row_uses_the_36px_badge_and_x96_text_column(tekeningen):
    M.lesregel(42, _les())
    v = vlakken(tekeningen)
    assert ("fill_rect", 0, 42, 319, 26) in v          # band
    assert ("fill_rect", 0, 42, 4, 26) in v            # accentbalk
    assert ("fill_rect", 54, 46, 36, 18) in v          # badge, 36 breed
    t = teksten(tekeningen)
    assert ("draw_text", 8, 47, "10:30") in t
    assert ("draw_text", 8, 58, "12:00") in t
    assert ("draw_text", 96, 47, "natuurkunde") in t
    assert ("draw_text", 96, 58, "Bos (BOS)") in t

def test_double_period_badge_text_is_centred_in_36px(tekeningen):
    M.lesregel(42, _les(uur="3-4"))
    assert ("draw_text", 54 + (36 - 30) // 2, 50, "3-4") in teksten(tekeningen)

def test_single_digit_badge_keeps_the_same_column(tekeningen):
    M.lesregel(42, _les(uur="1"))
    assert ("draw_text", 54 + (36 - 10) // 2, 50, "1") in teksten(tekeningen)

def test_cancelled_lesson_is_white_grey_and_struck_through(tekeningen):
    M.lesregel(42, _les(status="vervallen", chip="VERVALT"))
    v = vlakken(tekeningen)
    assert ("fill_rect", 0, 42, 319, 26) in v
    doorhaling = [c for c in v if c[4] == 1 and c[2] == 52]
    assert doorhaling and doorhaling[0][1] == 96

def test_changed_lesson_has_an_orange_accent_bar(tekeningen):
    M.lesregel(42, _les(status="gewijzigd", chip="GEWIJZIGD"))
    kleuren = [c for c in tekeningen if c[0] == "set_color"]
    assert ("set_color",) + M.ORANJE in kleuren

def test_chip_width_uses_10px_advance(tekeningen):
    assert M.chip_breedte("HW") == 28
    assert M.chip_breedte("TOETS") == 58
    assert M.chip_breedte("GEWIJZIGD") == 98
    M.lesregel(42, _les(chip="TOETS"))
    assert ("fill_rect", 313 - 58, 48, 58, 14) in vlakken(tekeningen)

def test_selected_row_gets_the_selection_band_and_frame(tekeningen):
    M.lesregel(42, _les(), geselecteerd=True)
    assert ("fill_rect", 0, 42, 319, 26) in vlakken(tekeningen)
    randen = [c for c in tekeningen if c[0] == "draw_rect"]
    assert randen

def test_gap_row_draws_rules_not_a_band(tekeningen):
    M.gatregel(42, ("gat", "09:45", "10:30", "", "", "", "", "normaal", "", "", ""))
    v = vlakken(tekeningen)
    assert not [c for c in v if c[3] == 319 and c[4] == 26]
    assert ("fill_rect", 8, 46, 64, 1) in v
    assert ("draw_text", 80, 42, "tussenuur 09:45-10:30") in teksten(tekeningen)
