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

def test_room_text_never_overlaps_the_chip(tekeningen):
    for chip in M.CHIP_KLEUR:
        tekeningen.clear()
        M.lesregel(42, _les(chip=chip))
        chip_x = M.RIGHT - M.chip_breedte(chip)
        kamer = [c for c in teksten(tekeningen) if c[3].startswith("- ")]
        assert kamer, chip
        x, s = kamer[0][1], kamer[0][3]
        assert x + M.text_width(s) <= chip_x, (chip, x, s)

def test_long_subject_and_room_stay_within_the_screen(tekeningen):
    M.lesregel(42, _les(vak="wiskunde D versneld traject bovenbouw",
                         lokaal="A1.23"))
    for c in teksten(tekeningen):
        x, s = c[1], c[3]
        assert x + M.text_width(s) <= M.RIGHT, c

def test_cancelled_strikethrough_stays_within_the_screen(tekeningen):
    M.lesregel(42, _les(status="vervallen",
                         vak="wiskunde D versneld traject bovenbouw",
                         lokaal="A1.23"))
    doorhaling = [c for c in vlakken(tekeningen) if c[4] == 1 and c[2] == 52]
    assert doorhaling
    x, w = doorhaling[0][1], doorhaling[0][3]
    assert x + w <= M.RIGHT

def test_subject_gets_the_full_width_when_there_is_no_room(tekeningen):
    onderwerp = "abcdefghijklmnopqrst"
    M.lesregel(42, _les(vak=onderwerp, lokaal=""))
    assert onderwerp in [c[3] for c in teksten(tekeningen)]

def test_teacher_name_never_crosses_the_right_edge(tekeningen):
    M.lesregel(42, _les(docent="van der Meulen-Jansen (VDM)"))
    for c in teksten(tekeningen):
        x, s = c[1], c[3]
        assert x + M.text_width(s) <= M.RIGHT, c

def test_today_gets_the_vandaag_header(tekeningen):
    M.toon_dag(0, 0, 0)
    assert ("draw_text", 6, 6, "VANDAAG") in teksten(tekeningen)

def test_other_days_get_the_rooster_header(tekeningen):
    M.toon_dag(1, 0, 0)
    assert ("draw_text", 6, 6, "ROOSTER") in teksten(tekeningen)

def test_day_screen_places_rows_on_the_design_pitch(tekeningen):
    # Rij 1 van de fixture is een tussenuur en tekent geen band, dus de
    # banden staan op 42, 98 en 126 - niet op 42, 70, 98.
    M.toon_dag(0, 0, 0)
    banden = [c for c in vlakken(tekeningen) if c[3] == 319 and c[4] == 26]
    assert [c[2] for c in banden][:3] == [42, 98, 126]
    assert ("draw_text", 80, 70, "tussenuur 09:45-10:30") in teksten(tekeningen)

def test_day_screen_shows_a_more_indicator(tekeningen):
    M.toon_dag(0, 0, 0)
    labels = [c[3] for c in teksten(tekeningen)]
    assert any(s.startswith("v ") and "meer" in s for s in labels)

def test_empty_day_shows_the_notice_block(tekeningen):
    M.toon_dag(2, 0, 0)
    assert ("fill_rect", 24, 96, 271, 40) in vlakken(tekeningen)
    t = [c[3] for c in teksten(tekeningen)]
    assert "geen lessen op deze dag" in t

def test_empty_day_uses_no_orange(tekeningen):
    M.toon_dag(2, 0, 0)
    assert ("set_color",) + M.ORANJE not in [c for c in tekeningen if c[0] == "set_color"]

def test_scroll_past_the_end_of_the_list_is_clamped(tekeningen):
    # Dag 0 heeft 6 rijen; met ZICHTBAAR=5 is scroll=1 de hoogst geldige
    # waarde. Een hogere scroll mag de lijst niet in lege ruimte laten
    # doorschuiven (minder rijen dan er zichtbaar zouden moeten zijn).
    M.toon_dag(0, 0, 5)
    banden = [c for c in vlakken(tekeningen) if c[3] == 319 and c[4] == 26]
    assert [c[2] for c in banden] == [70, 98, 126, 154]
