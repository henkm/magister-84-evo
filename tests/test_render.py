import MAGISTER as M
import layoutregels

def vlakken(calls):
    return [c for c in calls if c[0] == "fill_rect"]

def teksten(calls):
    return [c for c in calls if c[0] == "draw_text"]

def kleuren_in_gebied(calls, y_min, y_max):
    """Kleuren van teken-oproepen (fill_rect/draw_rect/draw_text) waarvan de
    y-positie in [y_min, y_max) valt, gekoppeld via de voorafgaande
    set_color-oproep."""
    kleuren = []
    for i, c in enumerate(calls):
        if c[0] != "set_color":
            continue
        volgende = calls[i + 1] if i + 1 < len(calls) else None
        if volgende and volgende[0] in ("fill_rect", "draw_rect", "draw_text"):
            y = volgende[2]
            if y_min <= y < y_max:
                kleuren.append(c[1:])
    return kleuren

def test_contextbalk_and_separator(tekeningen):
    M.contextbalk("7 lessen", "gesynct 07:41")
    assert ("fill_rect", 0, 22, 319, 17) in vlakken(tekeningen)
    assert ("fill_rect", 0, 39, 319, 1) in vlakken(tekeningen)
    assert ("draw_text", 6, 41, "7 lessen") in teksten(tekeningen)

def test_stale_data_gets_an_orange_marker(tekeningen):
    M.contextbalk("morgen", "gesynct 2 dgn", verouderd=True)
    assert ("fill_rect", 169, 26, 6, 6) in vlakken(tekeningen)
    assert ("draw_text", 181, 41, "gesynct 2 dgn") in teksten(tekeningen)

def test_scrollbar_track_and_thumb(tekeningen):
    M.scrollbar(0, 5, 10)
    assert ("fill_rect", 315, 42, 4, 150) in vlakken(tekeningen)
    assert ("fill_rect", 315, 42, 4, 75) in vlakken(tekeningen)

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

    # Voor tekst is een losse "y <= SCREEN_H"-vergelijking na de ankerregel
    # onjuist: draw_text-y is top+18, dus de voetbalk (top=193) meldt zich op
    # 211 terwijl het letterblok (193..209) prima binnen het scherm past.
    # binnen_scherm() rekent wel met de bovenkant.
    layoutregels.binnen_scherm(tekeningen, M)
    for c in tekeningen:
        if c[0] in ("fill_rect", "draw_rect"):
            x, y, w, h = c[1], c[2], c[3], c[4]
            assert y + h <= M.SCREEN_H, f"Rectangle {c} exceeds screen height at y+h={y+h}"

def _les(**kw):
    r = ["les", "10:30", "12:00", "3-4", "natuurkunde", "206", "Bos (BOS)",
         "normaal", "", "", ""]
    for k, v in kw.items():
        r[getattr(M, "L_" + k.upper())] = v
    return tuple(r)

RIJ = _les()

def test_de_lesregel_gebruikt_de_54px_badge_en_tekstkolom_118(tekeningen):
    M.lesregel(42, _les())
    v = vlakken(tekeningen)
    assert ("fill_rect", 0, 42, 319, 36) in v          # band
    assert ("fill_rect", 0, 42, 4, 36) in v            # accentbalk
    assert ("fill_rect", 60, 44, 54, 20) in v          # badge, 54 breed
    t = teksten(tekeningen)
    assert ("draw_text", 6, 62, "10:30") in t
    assert ("draw_text", 6, 78, "12:00") in t
    assert ("draw_text", 118, 62, "natuurkunde") in t
    assert ("draw_text", 118, 78, "Bos (BOS)") in t

def test_de_badge_is_gemaakt_op_het_breedste_label_dat_de_generator_geeft():
    # rooster.js zet er "${van}-${tot}" in, dus "10-11" (5 tekens, 50 px) is
    # een echt uurlabel. De badge moet dat kunnen dragen, niet alleen "3-4".
    assert M.text_width("10-11") <= M.BADGE_W
    # en de tekstkolommen beginnen achter de badge, met 4 px lucht
    assert M.TEKST_X == M.BADGE_X + M.BADGE_W + 4
    assert M.DETAIL_TEKST_X == M.DETAIL_BADGE_X + M.BADGE_W + 4

def test_de_badgetekst_staat_gecentreerd_in_54px(tekeningen):
    M.lesregel(42, _les(uur="10-11"))
    assert ("draw_text", 60 + (54 - 50) // 2, 64, "10-11") in teksten(tekeningen)
    tekeningen.clear()
    M.lesregel(42, _les(uur="3-4"))
    assert ("draw_text", 60 + (54 - 30) // 2, 64, "3-4") in teksten(tekeningen)

def test_de_badge_kapt_een_label_af_dat_niet_in_zijn_binnenmaat_past(tekeningen):
    # Een vak met een vaste maat dat zijn eigen inhoud niet begrenst, begrenst
    # niets: het gecentreerde label moet binnen de badge blijven, wat de data
    # ook aanlevert.
    M.lesregel(42, _les(uur="10-11-12"))
    label = [c for c in teksten(tekeningen) if c[2] == 64][0]
    assert label[1] >= M.BADGE_X, label
    assert label[1] + M.text_width(label[3]) <= M.BADGE_X + M.BADGE_W, label

def test_de_badge_van_het_lesdetail_kapt_datzelfde_label_af(tekeningen):
    origineel = M.DAGEN
    rij = ("les", "10:30", "12:00", "10-11-12", "natuurkunde", "206",
           "Bos (BOS)", "normaal", "", "", "")
    M.DAGEN = _stel_dagen_in(rij)
    try:
        M.toon_lesdetail(0, 0)
    finally:
        M.DAGEN = origineel
    label = [c for c in teksten(tekeningen) if c[2] == 44 and c[1] < 60][0]
    assert label[1] >= M.DETAIL_BADGE_X, label
    assert label[1] + M.text_width(label[3]) <= M.DETAIL_BADGE_X + M.BADGE_W, \
        label

def test_single_digit_badge_keeps_the_same_column(tekeningen):
    M.lesregel(42, _les(uur="1"))
    assert ("draw_text", 60 + (54 - 10) // 2, 64, "1") in teksten(tekeningen)

def test_cancelled_lesson_is_white_grey_and_struck_through(tekeningen):
    M.lesregel(42, _les(status="vervallen", chip="VERVALT"))
    v = vlakken(tekeningen)
    assert ("fill_rect", 0, 42, 319, 36) in v
    doorhaling = [c for c in v if c[4] == 1 and c[2] == 52]
    assert doorhaling and doorhaling[0][1] == 118

def test_changed_lesson_has_an_orange_accent_bar(tekeningen):
    M.lesregel(42, _les(status="gewijzigd", chip="GEWIJZIGD"))
    kleuren = [c for c in tekeningen if c[0] == "set_color"]
    assert ("set_color",) + M.ORANJE in kleuren

def test_chip_width_uses_10px_advance(tekeningen):
    assert M.chip_breedte("HW") == 28
    assert M.chip_breedte("TOETS") == 58
    assert M.chip_breedte("GEWIJZIGD") == 98
    M.lesregel(42, _les(chip="TOETS"))
    assert ("fill_rect", 313 - 58, 50, 58, 20) in vlakken(tekeningen)

def test_selected_row_gets_the_selection_band_and_frame(tekeningen):
    M.lesregel(42, _les(), geselecteerd=True)
    assert ("fill_rect", 0, 42, 319, 36) in vlakken(tekeningen)
    randen = [c for c in tekeningen if c[0] == "draw_rect"]
    assert randen

def test_gap_row_draws_rules_not_a_band(tekeningen):
    M.gatregel(42, ("gat", "09:45", "10:30", "", "", "", "", "normaal", "", "", ""))
    v = vlakken(tekeningen)
    assert not [c for c in v if c[3] == 319 and c[4] == 36]
    assert ("fill_rect", 8, 60, 64, 1) in v
    assert ("draw_text", 80, 70, "tussenuur 09:45-10:30") in teksten(tekeningen)

def test_de_tijd_loopt_niet_meer_onder_de_badge_door(tekeningen):
    M.lesregel(42, RIJ)
    tijd = [c for c in tekeningen if c[0] == "draw_text" and c[3] == RIJ[M.L_BEGIN]][0]
    einde = tijd[1] + M.text_width(tijd[3])
    assert einde <= M.BADGE_X, "de begintijd loopt tot %d, de badge begint op %d" % (
        einde, M.BADGE_X)

def test_de_twee_tekstregels_van_een_lesregel_overlappen_niet(tekeningen):
    M.vlak(0, 0, 319, 209, M.PAGINA)
    M.lesregel(42, RIJ)
    layoutregels.geen_tekstoverlap(tekeningen, M)
    layoutregels.binnen_scherm(tekeningen, M)
    layoutregels.tekst_op_andere_kleur(tekeningen, M)
    layoutregels.binnen_zijn_blok(tekeningen, M)

def test_elke_chip_omsluit_zijn_eigen_tekst(tekeningen):
    for chip in ("HW", "TOETS", "GEWIJZIGD", "VERVALT"):
        tekeningen.clear()
        M.vlak(0, 0, 319, 209, M.PAGINA)
        rij = list(RIJ)
        rij[M.L_CHIP] = chip
        M.lesregel(42, tuple(rij))
        layoutregels.tekst_op_andere_kleur(tekeningen, M)
        layoutregels.binnen_scherm(tekeningen, M)
        layoutregels.binnen_zijn_blok(tekeningen, M)

def test_de_badge_omsluit_ook_een_dubbeluur(tekeningen):
    # "10-11" en niet "3-4": rooster.js zet er "${van}-${tot}" in, dus dit is
    # het breedste label dat de generator kan maken. "3-4" is juist de enige
    # dubbeluurwaarde die ook in een te smalle badge nog paste.
    M.vlak(0, 0, 319, 209, M.PAGINA)
    rij = list(RIJ)
    rij[M.L_UUR] = "10-11"
    M.lesregel(42, tuple(rij))
    layoutregels.tekst_op_andere_kleur(tekeningen, M)
    layoutregels.binnen_zijn_blok(tekeningen, M)

def test_de_vierde_regel_vangt_de_badge_die_zijn_label_liet_ontsnappen(tekeningen):
    # tekst_op_andere_kleur pakt het laatste vlak dat het letterblok volledig
    # bedekt. Voor een label dat naast zijn badge valt is dat de band van de
    # rij en niet de badge die het miste, dus een label half op zijn chip en
    # half ernaast komt daar ongemerkt doorheen. binnen_zijn_blok kijkt naar
    # gedeeltelijke overlap en ziet het wel.
    oud_w, oud_x = M.BADGE_W, M.TEKST_X
    M.BADGE_W, M.TEKST_X = 36, 100          # de geometrie van voor deze fix
    try:
        M.vlak(0, 0, 319, 209, M.PAGINA)
        M.lesregel(42, _les(uur="10-11"))
    finally:
        M.BADGE_W, M.TEKST_X = oud_w, oud_x
    fout = None
    try:
        layoutregels.binnen_zijn_blok(tekeningen, M)
    except AssertionError as e:
        fout = str(e)
    assert fout and "10-11" in fout, fout

def test_de_vierde_regel_ziet_wat_de_eerste_drie_missen(tekeningen):
    # "9-10" is het geval dat de reviewer aanwees: 2 px buiten een badge van
    # 36 px. Alle drie de oude regels vinden hier niets - de witte tekst staat
    # keurig op de bleke band en is daar simpelweg onzichtbaar.
    oud_w, oud_x = M.BADGE_W, M.TEKST_X
    M.BADGE_W, M.TEKST_X = 36, 100
    try:
        M.vlak(0, 0, 319, 209, M.PAGINA)
        M.lesregel(42, _les(uur="9-10"))
    finally:
        M.BADGE_W, M.TEKST_X = oud_w, oud_x
    layoutregels.binnen_scherm(tekeningen, M)
    layoutregels.geen_tekstoverlap(tekeningen, M)
    layoutregels.tekst_op_andere_kleur(tekeningen, M)
    fout = None
    try:
        layoutregels.binnen_zijn_blok(tekeningen, M)
    except AssertionError as e:
        fout = str(e)
    assert fout and "9-10" in fout, fout

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
    # 19 tekens: het volle budget van de tekstkolom (313 - 118 = 195 px)
    onderwerp = "abcdefghijklmnopqrs"
    M.lesregel(42, _les(vak=onderwerp, lokaal=""))
    assert onderwerp in [c[3] for c in teksten(tekeningen)]

def test_teacher_name_never_crosses_the_right_edge(tekeningen):
    M.lesregel(42, _les(docent="van der Meulen-Jansen (VDM)"))
    for c in teksten(tekeningen):
        x, s = c[1], c[3]
        assert x + M.text_width(s) <= M.RIGHT, c

def test_today_gets_the_vandaag_header(tekeningen):
    M.toon_dag(0, 0, 0)
    assert ("draw_text", 6, 21, "VANDAAG") in teksten(tekeningen)

def test_other_days_get_the_rooster_header(tekeningen):
    M.toon_dag(1, 0, 0)
    assert ("draw_text", 6, 21, "ROOSTER") in teksten(tekeningen)

def test_day_screen_places_rows_on_the_design_pitch(tekeningen):
    # Rij 1 van de fixture is een tussenuur en tekent geen band, dus de
    # banden staan op 42, 118 en 156 - niet op 42, 80, 118.
    M.toon_dag(0, 0, 0)
    banden = [c for c in vlakken(tekeningen) if c[3] == 319 and c[4] == 36]
    assert [c[2] for c in banden][:3] == [42, 118, 156]
    assert ("draw_text", 80, 108, "tussenuur 09:45-10:30") in teksten(tekeningen)

def test_empty_day_shows_the_notice_block(tekeningen):
    M.toon_dag(2, 0, 0)
    assert ("fill_rect", 24, 96, 271, 40) in vlakken(tekeningen)
    t = [c[3] for c in teksten(tekeningen)]
    assert "geen lessen op deze dag" in t

def test_empty_day_notice_uses_no_orange(tekeningen):
    # Het ontwerp verbiedt dramatiseren van een lege dag: de mededeling en de
    # (afwezige) lijst gebruiken nooit oranje. De contextbalk erboven mag dat
    # wel - zie test_empty_day_context_bar_still_shows_staleness_marker.
    M.toon_dag(2, 0, 0)
    kleuren = kleuren_in_gebied(tekeningen, 40, 192)
    assert M.ORANJE not in kleuren

def test_empty_day_context_bar_still_shows_staleness_marker(tekeningen):
    # Het oranje vinkje zegt niets over de dag, maar alles over de data: een
    # verouderde sync moet ook op een lege dag zichtbaar blijven, want "geen
    # lessen vandaag" uit een oude sync is precies wat een leerling moet
    # wantrouwen.
    origineel = M.GESYNCT_UREN
    M.GESYNCT_UREN = 24
    try:
        M.toon_dag(2, 0, 0)
    finally:
        M.GESYNCT_UREN = origineel
    assert ("fill_rect", 169, 26, 6, 6) in vlakken(tekeningen)
    assert ("draw_text", 181, 41, M.GESYNCT) in teksten(tekeningen)

def test_scroll_past_the_end_of_the_list_is_clamped(tekeningen):
    # Dag 0 heeft 6 rijen; met ZICHTBAAR=4 is scroll=2 de hoogst geldige
    # waarde. Een hogere scroll mag de lijst niet in lege ruimte laten
    # doorschuiven (minder rijen dan er zichtbaar zouden moeten zijn).
    M.toon_dag(0, 0, 5)
    banden = [c for c in vlakken(tekeningen) if c[3] == 319 and c[4] == 36]
    assert [c[2] for c in banden] == [42, 80, 118, 156]

def test_negative_scroll_is_clamped_to_zero(tekeningen):
    M.toon_dag(0, 0, -3)
    banden = [c for c in vlakken(tekeningen) if c[3] == 319 and c[4] == 36]
    assert [c[2] for c in banden][:3] == [42, 118, 156]

def test_selected_row_within_the_window_gets_the_selection_frame(tekeningen):
    # selectie=2 is de natuurkunde-les (rij-index 2), zichtbaar bij scroll=0.
    M.toon_dag(0, 2, 0)
    randen = [c for c in tekeningen if c[0] == "draw_rect"]
    assert ("draw_rect", 0, 118, 317, 34) in randen

def test_selection_outside_the_window_draws_no_selection_frame(tekeningen):
    # selectie=5 (geschiedenis) valt buiten het zichtbare venster bij
    # scroll=0. Dan mag er geen enkele rij als geselecteerd getekend worden -
    # de verkeerde rij markeren zou misleidend zijn.
    M.toon_dag(0, 5, 0)
    randen = [c for c in tekeningen if c[0] == "draw_rect"]
    assert randen == []
    kleuren = [c[1:] for c in tekeningen if c[0] == "set_color"]
    assert M.SELECTIE not in kleuren

def test_het_roosterscherm_toont_vier_rijen_die_op_de_voetbalk_eindigen(tekeningen):
    M.toon_dag(0)
    banden = [c for c in tekeningen if c[0] == "fill_rect" and c[3] == 319 and c[4] == 36]
    assert len(banden) <= M.ZICHTBAAR
    for c in banden:
        assert c[2] + c[4] <= 192

def test_de_meer_indicator_van_het_roosterscherm_is_vervangen_door_de_scrollbaan(tekeningen):
    # Met vier zichtbare rijen eindigt de lijst op 191 en is er geen ruimte
    # meer voor een tekstregel; de scrollbaan neemt die rol over.
    # Let op: een kale "meer" in s zou hier vals positief slaan op de
    # afgekapte docentnaam "Vermeer." in de fixture, dus de check kijkt naar
    # het exacte, vervallen formaat "v N lessen meer".
    M.toon_dag(0, 0, 0)
    assert not [c for c in tekeningen if c[0] == "draw_text"
                and c[3].startswith("v ") and "lessen meer" in c[3]]
    assert [c for c in tekeningen if c[0] == "fill_rect" and c[1] == M.SCROLL_X]

# --- lesdetail, vakkenlijst, cijfers ---

def test_detail_uses_the_wide_badge_and_x68_text(tekeningen):
    M.toon_lesdetail(0, 2)
    v = vlakken(tekeningen)
    assert ("fill_rect", 0, 22, 319, 54) in v
    assert ("fill_rect", 10, 24, 54, 20) in v
    assert ("draw_text", 68, 44, "natuurkunde") in teksten(tekeningen)

def test_detail_wraps_homework_at_30_characters(tekeningen):
    M.toon_lesdetail(0, 2)
    blok = [c for c in teksten(tekeningen) if c[2] >= 101 and c[1] == 6]
    assert blok
    for c in blok:
        assert M.fits(c[3], 307)

def test_detail_without_homework_says_so(tekeningen):
    M.toon_lesdetail(1, 0)
    assert "geen huiswerk of toets" in [c[3] for c in teksten(tekeningen)]

def test_het_lesdetail_houdt_zich_aan_de_vier_regels(tekeningen):
    for i in range(len(M.DAGEN)):
        rijen = M.DAGEN[i][3]
        for j in range(len(rijen)):
            if rijen[j][M.L_SOORT] != "les":
                continue
            for scroll in range(0, 8):
                tekeningen.clear()
                M.toon_lesdetail(i, j, scroll)
                layoutregels.binnen_scherm(tekeningen, M)
                layoutregels.geen_tekstoverlap(tekeningen, M)
                layoutregels.tekst_op_andere_kleur(tekeningen, M)
                layoutregels.binnen_zijn_blok(tekeningen, M)

def test_de_omschrijving_staat_altijd_op_dezelfde_plek(tekeningen):
    # kort huiswerk en lang huiswerk mogen de omschrijving niet verplaatsen
    origineel = M.DAGEN[0][3][2]
    tops = []
    try:
        for lengte in (3, 40):
            tekeningen.clear()
            rij = list(origineel)
            rij[M.L_TEKST] = " ".join(["woord"] * lengte)
            rij[M.L_OMS] = "SO H1-H3"
            M.DAGEN[0][3][2] = tuple(rij)
            M.toon_lesdetail(0, 2, 0)
            gevonden = [c[2] - M.TEKST_ANKER for c in tekeningen
                        if c[0] == "draw_text" and c[3] == "omschrijving"]
            tops.append(gevonden)
    finally:
        M.DAGEN[0][3][2] = origineel
    assert tops[0] == tops[1] == [160]

def test_zonder_omschrijving_mag_de_bloktekst_zes_regels_gebruiken(tekeningen):
    origineel = M.DAGEN[0][3][2]
    try:
        rij = list(origineel)
        rij[M.L_TEKST] = " ".join(["woord"] * 40)
        rij[M.L_OMS] = ""
        M.DAGEN[0][3][2] = tuple(rij)
        M.toon_lesdetail(0, 2, 0)
        tops = sorted(c[2] - M.TEKST_ANKER for c in tekeningen
                      if c[0] == "draw_text" and c[2] - M.TEKST_ANKER >= 96)
    finally:
        M.DAGEN[0][3][2] = origineel
    assert tops[:6] == [96, 112, 128, 144, 160, 176]

def test_subject_list_uses_pitch_24(tekeningen):
    M.toon_vakken(0, 0)
    banden = [c for c in vlakken(tekeningen) if c[3] == 319 and c[4] == 22]
    assert [c[2] for c in banden][:3] == [42, 66, 90]

def test_failing_average_is_orange(tekeningen):
    M.toon_vakken(0, 0)
    assert ("set_color",) + M.ORANJE in [c for c in tekeningen if c[0] == "set_color"]

def test_a_ten_is_not_marked_as_failing():
    assert M.is_onvoldoende("5,1")
    assert not M.is_onvoldoende("10,0")
    assert not M.is_onvoldoende("5,5")
    assert not M.is_onvoldoende("vr")
    assert not M.is_onvoldoende("")

def test_missing_average_shows_geen(tekeningen):
    M.toon_vakken(0, 0)
    assert "geen" in [c[3] for c in teksten(tekeningen)]

def test_grade_rows_place_the_block_at_269(tekeningen):
    M.toon_cijfers(0, 0)
    assert ("fill_rect", 269, 50, 44, 20) in vlakken(tekeningen)

def test_non_numeric_grade_is_grey(tekeningen):
    M.toon_cijfers(2, 0)
    assert ("set_color",) + M.GEDEMPT in [c for c in tekeningen if c[0] == "set_color"]

def test_een_tien_past_in_het_cijferblok(tekeningen):
    breedte = M.text_width("10,0")
    assert breedte <= M.CIJFER_W
    x = M.CIJFER_X + (M.CIJFER_W - breedte) // 2
    assert x >= M.CIJFER_X
    assert x + breedte <= M.CIJFER_X + M.CIJFER_W
    assert M.CIJFER_X + M.CIJFER_W <= M.SCROLL_X

def test_het_cijferblok_kapt_een_te_lange_tekstwaardering_af(tekeningen):
    # "vr" past, maar een tekstwaardering van zes tekens is 60 px in een blok
    # van 44 en tekende tot x=321 - voorbij de schermrand. cijfer was de enige
    # tekst op deze rij die niet door truncate ging; oms en meta wel.
    origineel = M.VAKKEN
    M.VAKKEN = [("wiskunde D", "7,0", [
        ("Inhaalmoment", "vrijst", "01-06 - P1 - vrijstelling", "tekst"),
    ])]
    try:
        M.toon_cijfers(0, 0)
    finally:
        M.VAKKEN = origineel
    blok = [c for c in teksten(tekeningen) if c[2] == 70][0]
    assert blok[1] >= M.CIJFER_X, blok
    assert blok[1] + M.text_width(blok[3]) <= M.CIJFER_X + M.CIJFER_W, blok

def test_de_lege_vakkenlijst_houdt_zijn_mededeling_binnen_de_kaart(tekeningen):
    # "nog geen cijfers in " + PERIODE groeit mee met het aantal perioden en
    # was aan geen enkel budget gebonden.
    origineel_v, origineel_p = M.VAKKEN, M.PERIODE
    M.VAKKEN, M.PERIODE = [], "P1 · P2 · P3 · P4"
    try:
        M.toon_vakken(0, 0)
    finally:
        M.VAKKEN, M.PERIODE = origineel_v, origineel_p
    kaart = [c for c in vlakken(tekeningen) if c[4] == 40][0]
    rechterrand = kaart[1] + kaart[3]
    for c in teksten(tekeningen):
        if c[2] - M.TEKST_ANKER >= 96 and c[1] >= kaart[1]:
            assert c[1] + M.text_width(c[3]) <= rechterrand, c

# --- randgevallen: niets buiten het scherm, niets over de buur ---
#
# Dit project heeft drie keer eerder code gemerged die buiten het 319x209
# oppervlak tekende, elke keer met een groene testsuite. Onderstaande tests
# toetsen de eigenschap in plaats van een pixel, met opzettelijk lange
# tekst zodat een echte overschrijding zichtbaar zou worden.

def _stel_dagen_in(rij):
    return [("2026-09-01", "di 01-09", "vandaag", [rij])]

def test_detail_stays_within_the_screen_and_columns_do_not_collide(tekeningen):
    origineel = M.DAGEN
    rij = ("les", "07:05", "23:55", "3-4",
           "wiskunde D versneld traject bovenbouw internationale variant",
           "A1.23 bovenbouwvleugel", "van der Meulen-Jansen-Bakker (VDM)",
           "gewijzigd", "GEWIJZIGD",
           "lees hoofdstuk 1 tot en met 9 helemaal door en maak alle opgaven " * 3,
           "een erg lange omschrijving die makkelijk over de rand zou kunnen lopen")
    M.DAGEN = _stel_dagen_in(rij)
    try:
        M.toon_lesdetail(0, 0)
    finally:
        M.DAGEN = origineel

    for c in tekeningen:
        if c[0] in ("fill_rect", "draw_rect"):
            x, y, w, h = c[1], c[2], c[3], c[4]
            assert x + w <= M.SCREEN_W, f"{c} loopt over de rechterrand"
            assert y + h <= M.SCREEN_H, f"{c} loopt over de onderrand"
    # Voor tekst is een losse "y <= SCREEN_H"-vergelijking na de ankerregel
    # onjuist: draw_text-y is top+18, dus de voetbalk (top=193) meldt zich op
    # 211 terwijl het letterblok (193..209) prima binnen het scherm past.
    # binnen_scherm() rekent wel met de bovenkant.
    layoutregels.binnen_scherm(tekeningen, M)

    # vaknaam mag niet onder/over de tijd lopen (beide op top=26); de
    # badge-tekst deelt diezelfde regel maar staat altijd links van x=68.
    regel26 = [(c[1], c[3]) for c in teksten(tekeningen)
               if c[2] - M.TEKST_ANKER == 26 and c[1] >= 68]
    assert len(regel26) == 2
    (x1, s1), (x2, s2) = sorted(regel26)
    assert x1 + M.text_width(s1) <= x2, "vaknaam botst met de tijd"

    # docent mag niet onder de chip lopen
    docent = [c for c in teksten(tekeningen)
              if c[2] - M.TEKST_ANKER == 58 and c[1] == 68][0]
    chip_rect = [c for c in vlakken(tekeningen)
                 if c[2] == 56 and c[4] == M.CHIP_H][0]
    assert docent[1] + M.text_width(docent[3]) <= chip_rect[1], \
        "docentnaam botst met de chip"

    # de huiswerk/omschrijving-kolom (x=6, tussen de scheidingslijn op y=93
    # en de voetbalk op y=192) mag niet in de voetbalk terechtkomen
    kolom = [c for c in teksten(tekeningen)
             if c[1] == 6 and 93 < c[2] - M.TEKST_ANKER < 192]
    assert kolom
    for c in kolom:
        top = c[2] - M.TEKST_ANKER
        assert top + M.TEKST_H <= 192, f"{c} loopt in de voetbalk"

def test_subject_list_stays_within_the_screen_and_name_never_hits_average(tekeningen):
    origineel = M.VAKKEN
    M.VAKKEN = [
        ("wiskunde D versneld programma internationale variant bovenbouw", "10,0", []),
        ("aardrijkskunde en geschiedenis gecombineerd blok", "5,4", []),
        ("natuurkunde", "5,1", []),
        ("scheikunde", "", []),
        ("biologie voor de bovenbouw met uitgebreide beschrijving", "6,3", []),
        ("Frans", "7,0", []),
        ("Duits", "8,0", []),
    ]
    try:
        M.toon_vakken(0, 0)
    finally:
        M.VAKKEN = origineel

    for c in tekeningen:
        if c[0] in ("fill_rect", "draw_rect"):
            x, y, w, h = c[1], c[2], c[3], c[4]
            assert x + w <= M.SCREEN_W, f"{c} loopt over de rechterrand"
            assert y + h <= M.SCREEN_H, f"{c} loopt over de onderrand"
    # Voor tekst is een losse "y <= SCREEN_H"-vergelijking na de ankerregel
    # onjuist: draw_text-y is top+18, dus de voetbalk (top=193) meldt zich op
    # 211 terwijl het letterblok (193..209) prima binnen het scherm past.
    # binnen_scherm() rekent wel met de bovenkant.
    layoutregels.binnen_scherm(tekeningen, M)

    for y in (42, 66, 90, 114, 138, 162):
        regel = [c for c in teksten(tekeningen) if c[2] == y + 21]
        naam = [c for c in regel if c[1] == 14][0]
        rest = [c for c in regel if c[1] != 14]
        assert rest, "geen gemiddelde/geen-tekst gevonden op deze regel"
        for r in rest:
            assert naam[1] + M.text_width(naam[3]) <= r[1], \
                "vaknaam botst met het gemiddelde"

    # 7 vakken, 6 zichtbaar: de scrollbar (niet een onderschrift) signaleert
    # dat er meer is.
    assert ("fill_rect", 315, 42, 4, 150) in vlakken(tekeningen)

def test_subject_list_shows_six_rows(tekeningen):
    origineel = M.VAKKEN
    M.VAKKEN = [("vak %d" % i, "", []) for i in range(8)]
    try:
        M.toon_vakken(0, 0)
    finally:
        M.VAKKEN = origineel
    # kop() tekent zelf ook een 319x22-band (op y=0); die staat na de rijen
    # in de tekenlijst (zie de omwisseling hierboven), dus [:6] pakt precies
    # de zes vakregels.
    banden = [c for c in vlakken(tekeningen) if c[3] == 319 and c[4] == 22]
    assert [c[2] for c in banden][:6] == [42, 66, 90, 114, 138, 162]

def test_subject_list_scroll_past_the_end_is_clamped(tekeningen):
    origineel = M.VAKKEN
    M.VAKKEN = [("vak %d" % i, "", []) for i in range(8)]
    try:
        M.toon_vakken(0, 50)
        na_te_ver = [c for c in vlakken(tekeningen)
                     if c[3] == 319 and c[4] == 22]
        tekeningen.clear()
        M.toon_vakken(0, -5)
        na_negatief = [c for c in vlakken(tekeningen)
                       if c[3] == 319 and c[4] == 22]
    finally:
        M.VAKKEN = origineel
    assert [c[2] for c in na_te_ver][:6] == [42, 66, 90, 114, 138, 162]
    assert [c[2] for c in na_negatief][:6] == [42, 66, 90, 114, 138, 162]

def test_grade_rows_stay_within_the_screen_and_description_never_hits_the_block(tekeningen):
    origineel = M.VAKKEN
    M.VAKKEN = [
        ("wiskunde D", "7,0", [
            ("Een heel erg lange beschrijving van deze specifieke toets die de "
             "rand nadert", "10,0",
             "12-06 - P1 - een lange metatekst die ook bijna over de rand loopt",
             "normaal"),
            ("Tweede toets", "4,0", "26-06 - P1 - telt mee", "onvoldoende"),
            ("Vrijstelling", "vr", "01-06 - P1 - vrijstelling", "tekst"),
        ]),
    ]
    try:
        M.toon_cijfers(0, 0)
    finally:
        M.VAKKEN = origineel

    for c in tekeningen:
        if c[0] in ("fill_rect", "draw_rect"):
            x, y, w, h = c[1], c[2], c[3], c[4]
            assert x + w <= M.SCREEN_W, f"{c} loopt over de rechterrand"
            assert y + h <= M.SCREEN_H, f"{c} loopt over de onderrand"
    # Voor tekst is een losse "y <= SCREEN_H"-vergelijking na de ankerregel
    # onjuist: draw_text-y is top+18, dus de voetbalk (top=193) meldt zich op
    # 211 terwijl het letterblok (193..209) prima binnen het scherm past.
    # binnen_scherm() rekent wel met de bovenkant.
    layoutregels.binnen_scherm(tekeningen, M)

    for y in (42, 80, 118):
        regel = [c for c in teksten(tekeningen)
                 if c[1] == 14 and c[2] in (y + 20, y + 36)]
        assert regel
        for c in regel:
            assert c[1] + M.text_width(c[3]) <= M.CIJFER_X, \
                "omschrijving/meta botst met het cijferblok"

def test_grade_screen_title_never_hits_the_average(tekeningen):
    # Eén woord zonder spaties, zodat truncate() niet op een woordgrens kan
    # afbreken en het volledige budget benut - precies het scenario waarin
    # een vaste breedte voor de titel de rechts uitgelijnde "gem ..." tekst
    # zou kunnen raken.
    origineel = M.VAKKEN
    M.VAKKEN = [
        ("natuurwetenschappenexamenprogrammabovenbouwklassen", "10,0", [
            ("iets", "8,0", "meta", "normaal"),
        ]),
    ]
    try:
        M.toon_cijfers(0, 0)
    finally:
        M.VAKKEN = origineel

    titel = [c for c in teksten(tekeningen) if c[1] == 6 and c[2] == 21][0]
    rechts = [c for c in teksten(tekeningen) if c[2] == 21 and c[1] != 6][0]
    assert titel[1] + M.text_width(titel[3]) <= rechts[1], \
        "titel botst met het rechts uitgelijnde gemiddelde"

def test_description_anchors_stay_fixed_regardless_of_body_length(tekeningen):
    # Een lang huiswerk (meer dan 4 gewikkelde regels) mag het
    # omschrijving-blok niet verplaatsen: het label en de tekst horen altijd
    # op top=160/176, ongeacht hoeveel regels het lichaam nodig heeft. Met
    # een omschrijving erbij is het lichaam tot vier regels beperkt (96 t/m
    # 144), want 160 en 176 zijn voor de omschrijving gereserveerd.
    origineel = M.DAGEN
    lang_huiswerk = ("lees hoofdstuk 1 tot en met 9 helemaal door en maak "
                      "alle opgaven van de herhalingstoets grondig ") * 3
    rij = ("les", "10:30", "12:00", "3-4", "natuurkunde", "206", "Bos (BOS)",
           "normaal", "TOETS", lang_huiswerk, "SO H1-H3")
    M.DAGEN = [("2026-09-01", "di 01-09", "vandaag", [rij])]
    try:
        M.toon_lesdetail(0, 0)
    finally:
        M.DAGEN = origineel

    assert len(M.wrap(lang_huiswerk, 307)) > 4, \
        "testtekst moet meer dan 4 regels wikkelen om het scenario te testen"
    t = teksten(tekeningen)
    assert ("draw_text", 6, 178, "omschrijving") in t
    beschrijving = [c for c in t if c[1] == 6 and c[2] == 194][0]
    assert beschrijving[3] == M.truncate("SO H1-H3", 307)
    # de vier zichtbare regels blijven op hun eigen vaste rooster
    lichaam = sorted(c[2] - M.TEKST_ANKER for c in t
                     if c[1] == 6 and 96 <= c[2] - M.TEKST_ANKER <= 144)
    assert lichaam == [96, 112, 128, 144]
    # en de overloop wordt gemeld op de sectiebalk, niet op een anker dat de
    # omschrijving zou overschrijven
    assert ("draw_text", M.right_x("v meer"), 95, "v meer") in t

def test_detail_scroll_past_the_end_is_clamped(tekeningen):
    origineel = M.DAGEN
    lang_huiswerk = ("lees hoofdstuk 1 tot en met 9 helemaal door en maak "
                      "alle opgaven van de herhalingstoets grondig ") * 3
    # geen omschrijving: het lichaam mag hier alle zes regels gebruiken.
    rij = ("les", "10:30", "12:00", "3-4", "natuurkunde", "206", "Bos (BOS)",
           "normaal", "", lang_huiswerk, "")
    M.DAGEN = [("2026-09-01", "di 01-09", "vandaag", [rij])]
    alle_regels = M.wrap(lang_huiswerk, 307)
    try:
        M.toon_lesdetail(0, 0, scroll=999)
        te_ver = [c[3] for c in teksten(tekeningen)
                  if c[1] == 6 and 96 <= c[2] - M.TEKST_ANKER <= 176]
        tekeningen.clear()
        M.toon_lesdetail(0, 0, scroll=-9)
        negatief = [c[3] for c in teksten(tekeningen)
                    if c[1] == 6 and 96 <= c[2] - M.TEKST_ANKER <= 176]
    finally:
        M.DAGEN = origineel
    assert te_ver == alle_regels[max(0, len(alle_regels) - 6):]
    assert negatief == alle_regels[:6]

def test_grade_screen_scroll_past_the_end_is_clamped(tekeningen):
    origineel = M.VAKKEN
    M.VAKKEN = [
        ("wiskunde D", "7,0", [
            ("Toets %d" % i, "6,0", "meta", "normaal") for i in range(9)
        ]),
    ]
    try:
        M.toon_cijfers(0, 999)
        te_ver = [c for c in vlakken(tekeningen) if c[3] == 319 and c[4] == 36]
        tekeningen.clear()
        M.toon_cijfers(0, -9)
        negatief = [c for c in vlakken(tekeningen) if c[3] == 319 and c[4] == 36]
    finally:
        M.VAKKEN = origineel
    assert [c[2] for c in te_ver] == [42, 80, 118, 156]
    assert [c[2] for c in negatief] == [42, 80, 118, 156]

def test_geen_enkel_scherm_overtreedt_de_vier_regels(tekeningen):
    """Alle vijf de schermen, niet drie: de naam beloofde een veegtest over
    het hele scherm, maar toon_lesdetail en toon_geen_data zaten er niet in."""
    def controleer():
        layoutregels.binnen_scherm(tekeningen, M)
        layoutregels.geen_tekstoverlap(tekeningen, M)
        layoutregels.tekst_op_andere_kleur(tekeningen, M)
        layoutregels.binnen_zijn_blok(tekeningen, M)
        tekeningen.clear()

    for i in range(len(M.DAGEN)):
        rijen = M.DAGEN[i][3]
        for scroll in range(0, max(1, len(rijen))):
            for selectie in range(0, max(1, len(rijen))):
                M.toon_dag(i, selectie, scroll)
                controleer()
        for j in range(len(rijen)):
            if rijen[j][M.L_SOORT] != "les":
                continue
            for scroll in range(0, 8):
                M.toon_lesdetail(i, j, scroll)
                controleer()
    for scroll in range(0, max(1, len(M.VAKKEN))):
        for selectie in range(0, max(1, len(M.VAKKEN))):
            M.toon_vakken(selectie, scroll)
            controleer()
    for v in range(len(M.VAKKEN)):
        for scroll in range(0, max(1, len(M.VAKKEN[v][2]))):
            M.toon_cijfers(v, scroll)
            controleer()
    M.toon_geen_data()
    controleer()

# --- geen-data-scherm en hoofdlus ---

def test_missing_data_screen_says_what_to_do(tekeningen):
    M.toon_geen_data()
    t = [c[3] for c in teksten(tekeningen)]
    assert "geen gegevens gevonden" in t
    assert any("sync" in s for s in t)

def test_missing_data_screen_stays_within_the_screen(tekeningen):
    M.toon_geen_data()
    for c in tekeningen:
        if c[0] in ("fill_rect", "draw_rect"):
            x, y, w, h = c[1], c[2], c[3], c[4]
            assert x + w <= M.SCREEN_W, f"{c} loopt over de rechterrand"
            assert y + h <= M.SCREEN_H, f"{c} loopt over de onderrand"
    # Voor tekst is een losse "y <= SCREEN_H"-vergelijking na de ankerregel
    # onjuist: draw_text-y is top+18, dus de voetbalk (top=193) meldt zich op
    # 211 terwijl het letterblok (193..209) prima binnen het scherm past.
    # binnen_scherm() rekent wel met de bovenkant.
    layoutregels.binnen_scherm(tekeningen, M)

# --- hoofdlus (main) ---
#
# main() wordt niet automatisch gedraaid bij import (die staat achter
# if __name__ == "__main__": onderaan het bestand); een test roept M.main()
# rechtstreeks aan en voedt hem een eindige reeks toetscodes door M.wait_key
# tijdelijk te vervangen. Zonder een eindige reeks blijft de hoofdlus hangen
# net als op het apparaat - dat is precies de reden voor de guard.

def _toetsen(*codes):
    rij = list(codes)
    def volgende():
        return rij.pop(0)
    return volgende

def _beeldjes(calls):
    """Splitst de opnames in beeldjes: alles tot aan elke show_draw.

    Geeft (beeldjes, rest) terug; `rest` is het tekenwerk na de laatste
    show_draw en hoort leeg te zijn, want main() flusht elk beeld voordat
    hij op een toets wacht.
    """
    beeldjes, huidig = [], []
    for c in calls:
        if c[0] == "show_draw":
            beeldjes.append(huidig)
            huidig = []
        else:
            huidig.append(c)
    return beeldjes, huidig

def _titels(beeldjes):
    """De koptitel (draw_text op 6,21 - top=3) van elk beeldje, in volgorde."""
    uit = []
    for b in beeldjes:
        kop = [c[3] for c in b if c[0] == "draw_text" and c[1] == 6 and c[2] == 21]
        uit.append(kop[0] if kop else None)
    return uit

def test_main_returns_immediately_when_there_is_no_data(tekeningen):
    origineel_dagen, origineel_key = M.DAGEN, M.wait_key
    M.DAGEN = []
    M.wait_key = _toetsen(0)      # main() mag maar één keer wait_key aanroepen
    try:
        M.main()
    finally:
        M.DAGEN, M.wait_key = origineel_dagen, origineel_key
    t = [c[3] for c in teksten(tekeningen)]
    assert "geen gegevens gevonden" in t

def test_main_starts_on_the_dag_screen_and_clear_exits(tekeningen):
    origineel = M.wait_key
    M.wait_key = _toetsen(M.K_CLEAR)
    try:
        M.main()
    finally:
        M.wait_key = origineel
    assert ("draw_text", 6, 21, "VANDAAG") in teksten(tekeningen)

def test_main_right_arrow_clamps_at_the_last_day(tekeningen):
    # DAGEN heeft 3 dagen (index 0..2); vijf keer rechts moet blijven
    # steken op de laatste (het weekend, dag-index 2). Twee keer CLEAR:
    # de eerste springt vanaf het weekend terug naar vandaag, de tweede
    # sluit de app af.
    origineel = M.wait_key
    M.wait_key = _toetsen(M.K_RECHTS, M.K_RECHTS, M.K_RECHTS,
                          M.K_RECHTS, M.K_RECHTS, M.K_CLEAR, M.K_CLEAR)
    try:
        M.main()
    finally:
        M.wait_key = origineel
    assert ("draw_text", 6, 41, "weekend") in teksten(tekeningen)

def test_main_enter_on_a_lesson_opens_detail_and_clear_returns_to_dag(tekeningen):
    # selectie 0 -> 2 (één keer omlaag, want rij 1 is een tussenuur en die
    # wordt overgeslagen) landt op de natuurkundeles; ENTER opent het
    # lesdetail, CLEAR gaat terug, CLEAR sluit af.
    origineel = M.wait_key
    M.wait_key = _toetsen(M.K_OMLAAG, M.K_ENTER,
                          M.K_CLEAR, M.K_CLEAR)
    try:
        M.main()
    finally:
        M.wait_key = origineel
    assert ("draw_text", 68, 44, "natuurkunde") in teksten(tekeningen)

def test_main_selection_never_lands_on_a_gap_row(tekeningen):
    # rij-index 1 op dag 0 is een tussenuur ("gat"). gatregel() tekent geen
    # selectiekader, dus zou de selectie daarop landen dan verdwijnt de
    # cursor van het scherm. Na elke pijl omlaag hoort er dus nog steeds
    # een draw_rect (het selectiekader) op het beeld te staan - ook meteen
    # na de eerste, waar de oude code op het tussenuur bleef staan.
    origineel = M.wait_key
    M.wait_key = _toetsen(M.K_OMLAAG, M.K_OMLAAG, M.K_OMLAAG,
                          M.K_OMLAAG, M.K_OMLAAG, M.K_CLEAR)
    try:
        M.main()
    finally:
        M.wait_key = origineel
    beeldjes, _ = _beeldjes(tekeningen)
    assert len(beeldjes) == 6
    for n, b in enumerate(beeldjes):
        assert any(c[0] == "draw_rect" for c in b), \
            "beeldje %d heeft geen selectiekader" % n

def test_main_enter_on_a_gap_row_does_nothing(tekeningen):
    # De pijlen kunnen niet meer op een tussenuur landen, dus deze bewaking
    # wordt rechtstreeks getest: ENTER op een gat-rij opent geen lesdetail.
    # De vangrail blijft staan voor data waarin de eerste rij een gat is.
    origineel_dagen, origineel_key = M.DAGEN, M.wait_key
    M.DAGEN = [("2026-09-01", "di 01-09", "vandaag", [
        ("gat", "09:00", "09:45", "", "", "", "", "normaal", "", "", ""),
    ])]
    M.wait_key = _toetsen(M.K_ENTER, M.K_CLEAR)
    try:
        M.main()
    finally:
        M.DAGEN, M.wait_key = origineel_dagen, origineel_key
    labels = [c[3] for c in teksten(tekeningen)]
    assert not any(s.startswith("LESUUR") for s in labels)

def test_main_key_2_and_enter_walk_to_cijfers_and_clear_chain_returns_to_dag(tekeningen):
    # 2 -> vakken, ENTER -> cijfers (vak 0, wiskunde B), daarna sluit de
    # CLEAR-keten via vakken terug naar dag en tenslotte de app af.
    origineel = M.wait_key
    M.wait_key = _toetsen(M.K_2, M.K_ENTER, M.K_CLEAR,
                          M.K_CLEAR, M.K_CLEAR)
    try:
        M.main()
    finally:
        M.wait_key = origineel
    # Niet alleen "elk scherm is een keer getekend": de volgorde van de
    # beeldjes is de test. Zou de CLEAR-keten vanaf cijfers rechtstreeks
    # naar dag springen in plaats van via vakken, dan komen dezelfde
    # schermen voorbij maar in een andere volgorde - en dat moet rood zijn.
    beeldjes, rest = _beeldjes(tekeningen)
    assert _titels(beeldjes) == ["VANDAAG", "VAKKEN", "WISKUNDE B",
                                 "VAKKEN", "VANDAAG"]
    assert rest == [], "na het laatste beeld is er nog getekend zonder flush"

def test_main_key_1_jumps_directly_back_to_dag(tekeningen):
    origineel = M.wait_key
    M.wait_key = _toetsen(M.K_2, M.K_1, M.K_CLEAR)
    try:
        M.main()
    finally:
        M.wait_key = origineel
    t = teksten(tekeningen)
    namen = [c[3] for c in t if c[3] in ("VANDAAG", "VAKKEN")]
    assert namen[-1] == "VANDAAG"

def test_main_detail_down_arrow_scrolls_the_homework(tekeningen):
    # Het detailscherm wordt getekend als toon_lesdetail(dag, selectie,
    # detail_scroll): de pijlen horen dus detail_scroll te verzetten en niet
    # vak_scroll, anders is huiswerk voorbij regel 5 onbereikbaar.
    origineel_dagen, origineel_key = M.DAGEN, M.wait_key
    lang_huiswerk = ("lees hoofdstuk 1 tot en met 9 helemaal door en maak "
                     "alle opgaven van de herhalingstoets grondig ") * 3
    rij = ("les", "10:30", "12:00", "3-4", "natuurkunde", "206", "Bos (BOS)",
           "normaal", "HW", lang_huiswerk, "")
    M.DAGEN = [("2026-09-01", "di 01-09", "vandaag", [rij])]
    alle_regels = M.wrap(lang_huiswerk, 307)
    M.wait_key = _toetsen(M.K_ENTER, M.K_OMLAAG, M.K_OMHOOG,
                          M.K_CLEAR, M.K_CLEAR)
    try:
        M.main()
    finally:
        M.DAGEN, M.wait_key = origineel_dagen, origineel_key

    assert len(alle_regels) > 6, "testtekst moet meer dan 6 regels wikkelen"
    beeldjes, _ = _beeldjes(tekeningen)
    # dag, detail(scroll 0), detail(scroll 1), detail(scroll 0), dag
    assert len(beeldjes) == 5
    lichaam = [[c[3] for c in b
                if c[0] == "draw_text" and c[1] == 6
                and 96 <= c[2] - M.TEKST_ANKER <= 176]
               for b in beeldjes]
    assert lichaam[1] == alle_regels[0:6]
    assert lichaam[2] == alle_regels[1:7], "omlaag scrolt het huiswerk niet"
    assert alle_regels[6] not in lichaam[1], "regel 7 was al zonder scrollen zichtbaar"
    assert lichaam[3] == alle_regels[0:6], "omhoog scrolt niet terug"

def test_main_clear_from_detail_keeps_the_day_scroll_position(tekeningen):
    # Dag 0 heeft 6 rijen (5 lessen + 1 tussenuur) en ZICHTBAAR is 5: de
    # laatste lesregel (rij-index 5, geschiedenis) komt pas in beeld bij
    # scroll=1. `scroll` en het detailscherm deelden vroeger één variabele:
    # ENTER en de pijlen op het detailscherm overschreven dan de 1 met 0, en
    # bij terugkeer met CLEAR viel de selectie (nog steeds rij 5) buiten het
    # zichtbare venster - geen selectiekader, terwijl de gebruiker niets aan
    # de lijst had veranderd. Vier keer omlaag zet de selectie op rij 5
    # (rij-index 1 is een tussenuur en telt niet mee), ENTER opent hem, één
    # keer omlaag scrolt het huiswerk, en CLEAR hoort exact op de plek terug
    # te komen waar de gebruiker gebleven was.
    origineel = M.wait_key
    M.wait_key = _toetsen(M.K_OMLAAG, M.K_OMLAAG, M.K_OMLAAG, M.K_OMLAAG,
                          M.K_ENTER, M.K_OMLAAG, M.K_CLEAR, M.K_CLEAR)
    try:
        M.main()
    finally:
        M.wait_key = origineel
    beeldjes, _ = _beeldjes(tekeningen)
    dagscherm_na_terugkeer = beeldjes[-1]
    assert any(c[0] == "draw_rect" for c in dagscherm_na_terugkeer), \
        "geen selectiekader na CLEAR terug vanaf het detailscherm"

def test_main_detail_scroll_still_works_with_its_own_variable(tekeningen):
    # Keerzijde van de vorige test: detail_scroll moet nog steeds doen
    # waarvoor hij bestaat, anders is hij alleen maar toegevoegd en ongebruikt.
    origineel_dagen, origineel_key = M.DAGEN, M.wait_key
    lang_huiswerk = ("lees hoofdstuk 1 tot en met 9 helemaal door en maak "
                     "alle opgaven van de herhalingstoets grondig ") * 3
    rij = ("les", "10:30", "12:00", "3-4", "natuurkunde", "206", "Bos (BOS)",
           "normaal", "HW", lang_huiswerk, "")
    M.DAGEN = [("2026-09-01", "di 01-09", "vandaag", [rij])]
    alle_regels = M.wrap(lang_huiswerk, 307)
    M.wait_key = _toetsen(M.K_ENTER, M.K_OMLAAG, M.K_CLEAR, M.K_CLEAR)
    try:
        M.main()
    finally:
        M.DAGEN, M.wait_key = origineel_dagen, origineel_key

    beeldjes, _ = _beeldjes(tekeningen)
    # dag, detail(detail_scroll 0), detail(detail_scroll 1), dag
    assert len(beeldjes) == 4
    lichaam = [[c[3] for c in b
                if c[0] == "draw_text" and c[1] == 6
                and 96 <= c[2] - M.TEKST_ANKER <= 176]
               for b in beeldjes]
    assert lichaam[1] == alle_regels[0:6]
    assert lichaam[2] == alle_regels[1:7], "detail_scroll scrollt het huiswerk niet"

def test_main_detail_arrows_walk_between_lessons(tekeningen):
    # De voetbalk van het detailscherm belooft "<> les": links en rechts
    # bladeren door de lessen van dezelfde dag, slaan het tussenuur over en
    # blijven staan op de eerste en de laatste les.
    origineel = M.wait_key
    M.wait_key = _toetsen(M.K_ENTER,
                          M.K_RECHTS, M.K_LINKS,      # heen en weer terug
                          M.K_LINKS,                  # klemt op de eerste les
                          M.K_RECHTS, M.K_RECHTS, M.K_RECHTS, M.K_RECHTS,
                          M.K_RECHTS,                 # klemt op de laatste les
                          M.K_CLEAR, M.K_CLEAR)
    try:
        M.main()
    finally:
        M.wait_key = origineel

    beeldjes, _ = _beeldjes(tekeningen)
    vakken_per_beeld = []
    for b in beeldjes:
        n = [c[3] for c in b if c[0] == "draw_text" and c[1] == 68 and c[2] == 44]
        vakken_per_beeld.append(n[0] if n else None)
    # beeld 0 en het laatste zijn het dagscherm; daartussen de lesdetails
    assert vakken_per_beeld == [
        None,                                       # dagscherm
        "wiskunde B", "natuurkunde",                # rechts, en links terug
        "wiskunde B", "wiskunde B",                 # links klemt op de eerste
        "natuurkunde", "nederlands", "engels", "geschiedenis",
        "geschiedenis",                             # rechts klemt op de laatste
        None,                                       # weer het dagscherm
    ]
    # het tussenuur (rij 1) heeft een leeg lesuur en een lege vaknaam: daar
    # mag geen enkel detailbeeld op zijn beland
    assert "LESUUR " not in _titels(beeldjes)
    assert "" not in vakken_per_beeld

def test_main_clear_on_another_day_returns_to_today_before_exiting(tekeningen):
    # Elke voetbalk buiten vandaag belooft "CLR vandaag". Eén keer rechts,
    # dan CLEAR: terug naar vandaag, niet afsluiten. Pas de tweede CLEAR
    # (vanaf vandaag) sluit de app af.
    origineel = M.wait_key
    M.wait_key = _toetsen(M.K_RECHTS, M.K_CLEAR, M.K_CLEAR)
    try:
        M.main()
    finally:
        M.wait_key = origineel

    beeldjes, rest = _beeldjes(tekeningen)
    assert _titels(beeldjes) == ["VANDAAG", "ROOSTER", "VANDAAG"], \
        "CLEAR op een andere dag moet eerst naar vandaag, niet afsluiten"
    assert rest == []

def test_main_clear_returning_to_today_also_resets_the_selection(tekeningen):
    # Dag 1 heeft twee lessen; staat de selectie daar op rij 1, dan hoort
    # de sprong terug naar vandaag weer op de eerste lesregel te beginnen.
    origineel = M.wait_key
    M.wait_key = _toetsen(M.K_RECHTS, M.K_OMLAAG, M.K_CLEAR, M.K_CLEAR)
    try:
        M.main()
    finally:
        M.wait_key = origineel
    beeldjes, _ = _beeldjes(tekeningen)
    laatste = beeldjes[-1]
    kaders = [c for c in laatste if c[0] == "draw_rect"]
    assert kaders == [("draw_rect", 0, M.LIJST_Y, 317, 34)]

def test_main_key_2_resets_the_subject_selection(tekeningen):
    # 2 is de directe sprong naar de vakkenlijst; die begint altijd bovenaan,
    # ook als je er de vorige keer doorheen gescrold was.
    origineel = M.wait_key
    M.wait_key = _toetsen(M.K_2, M.K_OMLAAG, M.K_1, M.K_2, M.K_CLEAR, M.K_CLEAR)
    try:
        M.main()
    finally:
        M.wait_key = origineel

    beeldjes, _ = _beeldjes(tekeningen)
    assert _titels(beeldjes) == ["VANDAAG", "VAKKEN", "VAKKEN", "VANDAAG",
                                 "VAKKEN", "VANDAAG"]
    # beeld 2: na omlaag staat de selectie op de tweede vakregel (pitch 24)
    assert ("draw_rect", 0, M.LIJST_Y + 24, 317, 20) in beeldjes[2]
    # beeld 4: na 1 en opnieuw 2 staat hij weer op de eerste
    assert ("draw_rect", 0, M.LIJST_Y, 317, 20) in beeldjes[4]

def test_main_flushes_every_frame_exactly_once(tekeningen):
    # main() bezit de presentatie: elke tekenfunctie tekent alleen, main()
    # flusht. Elk beeldje hoort dus precies één show_draw te hebben en geen
    # enkel beeldje mag leeg zijn.
    origineel = M.wait_key
    M.wait_key = _toetsen(M.K_2, M.K_ENTER, M.K_1, M.K_OMLAAG, M.K_ENTER,
                          M.K_RECHTS, M.K_CLEAR, M.K_RECHTS, M.K_CLEAR,
                          M.K_CLEAR)
    try:
        M.main()
    finally:
        M.wait_key = origineel

    beeldjes, rest = _beeldjes(tekeningen)
    flushes = [c for c in tekeningen if c[0] == "show_draw"]
    assert len(beeldjes) == 10 == len(flushes), "één flush per toetsdruk"
    assert rest == [], "er is getekend na de laatste flush"
    for n, b in enumerate(beeldjes):
        assert b, "beeldje %d tekent niets" % n
        assert any(c[0] == "draw_text" for c in b)

def test_missing_data_screen_does_not_flush_itself(tekeningen):
    # toon_geen_data() is een tekenfunctie als alle andere: geen show_draw.
    M.toon_geen_data()
    assert not [c for c in tekeningen if c[0] == "show_draw"]

def test_main_flushes_the_missing_data_screen_once(tekeningen):
    origineel_dagen, origineel_key = M.DAGEN, M.wait_key
    M.DAGEN = []
    M.wait_key = _toetsen(0)
    try:
        M.main()
    finally:
        M.DAGEN, M.wait_key = origineel_dagen, origineel_key
    beeldjes, rest = _beeldjes(tekeningen)
    assert len(beeldjes) == 1 and beeldjes[0] and rest == []
