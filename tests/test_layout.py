import MAGISTER as M
import layoutregels


def test_advance_is_measured_not_assumed():
    assert M.ADVANCE == 10
    assert M.text_width("ABC") == 30

def test_full_line_is_32_characters():
    assert M.MAX_TEKENS == 32
    assert M.SCREEN_W == 319
    assert M.text_width("X" * M.MAX_TEKENS) == 320

def test_right_align_formula():
    assert M.right_x("7,2") == 313 - 30

def test_truncate_cuts_on_word_boundary_and_marks_it():
    assert M.truncate("natuurkunde en techniek", 150) == "natuurkunde en."
    assert M.truncate("wiskunde B", 150) == "wiskunde B"

def test_truncate_falls_back_to_hard_cut_for_one_long_word():
    assert M.truncate("aardrijkskundeles", 50) == "aard."

def test_wrap_breaks_on_words():
    regels = M.wrap("leer hoofdstuk 1 tot en met 3 voor de toets", 100)
    assert regels == ["leer", "hoofdstuk", "1 tot en", "met 3 voor", "de toets"]
    assert all(M.fits(r, 100) for r in regels)

def test_truncate_result_always_fits():
    # Invariant: truncate always returns something that fits within px
    # Cover edge cases: budget below one char, exact char width, exact text width, empty, spaces
    test_cases = [
        # (text, budget)
        # Normal cases
        ("natuurkunde en techniek", 150),
        ("wiskunde B", 150),
        ("aardrijkskundeles", 50),
        ("een lang stuk tekst voor de toets", 120),
        ("korte", 200),
        # Edge cases: budget below one character width
        ("hello", 5),
        ("hello", 1),
        ("test", 0),
        # Budget exactly one character width
        ("hello", 10),
        ("abc", 10),
        # Budget exactly equals text width
        ("test", 40),  # 4 chars * 10 = 40
        ("hello", 50),  # 5 chars * 10 = 50
        # Empty and whitespace strings
        ("", 100),
        ("   ", 50),
        ("   ", 10),
        ("   ", 5),
    ]
    for text, px in test_cases:
        result = M.truncate(text, px)
        assert M.fits(result, px), f"truncate('{text}', {px}) = '{result}' ({M.text_width(result)} px) does not fit in {px} px"


def test_wrap_result_always_fits():
    # Invariant: every line from wrap fits within budget
    # Cover edge cases: words longer than budget, budget below one char, empty string
    test_cases = [
        # (text, budget)
        # Normal cases
        ("leer hoofdstuk 1 tot en met 3 voor de toets", 100),
        ("hello world test string", 50),
        # Words longer than budget
        ("superlongwordthatexceedsbudget hello", 50),
        ("verylongcompoundword here", 30),
        ("onewor dthatdoesnotfit other", 20),
        # Budget exactly one character width
        ("hello", 10),
        ("a b c d e", 10),
        # Budget below one character width
        ("hello", 5),
        ("test", 0),
        # Empty and whitespace strings
        ("", 100),
        ("   ", 50),
    ]
    for text, px in test_cases:
        result = M.wrap(text, px)
        for line in result:
            assert M.fits(line, px), f"wrap('{text}', {px}) produced line '{line}' ({M.text_width(line)} px) that does not fit in {px} px"


def test_de_ankerregel_is_gemeten_niet_gekozen():
    # Op het apparaat gemeten: draw_text(x, y) zet het letterblok op
    # [y-18, y-3]. Deze drie getallen veranderen nooit om een test te redden.
    assert M.TEKST_ANKER == 18
    assert M.TEKST_H == 16
    assert M.LINE == 16


def test_tekst_zet_het_blok_op_de_gevraagde_bovenkant(tekeningen):
    M.tekst(5, 40, "A", M.DONKER)
    assert ("draw_text", 5, 58) == tuple(tekeningen[-1][:3])


def test_de_kop_valt_binnen_zijn_eigen_band(tekeningen):
    M.kop("VANDAAG", "di 01-09")
    assert ("fill_rect", 0, 0, 319, 22) in tekeningen
    # De rechteritem staat rechts uitgelijnd; die assertie ging verloren toen
    # test_kop_matches_the_design_grid werd vervangen.
    assert ("draw_text", 6, 21, "VANDAAG") in tekeningen
    assert ("draw_text", M.right_x("di 01-09"), 21, "di 01-09") in tekeningen
    for c in tekeningen:
        if c[0] == "draw_text":
            top = c[2] - M.TEKST_ANKER
            assert top == 3
            assert top + M.TEKST_H <= 22


def test_de_contextbalk_valt_binnen_zijn_eigen_band(tekeningen):
    M.contextbalk("6 lessen", "gesynct 07:41")
    assert ("fill_rect", 0, 22, 319, 17) in tekeningen
    for c in tekeningen:
        if c[0] == "draw_text":
            top = c[2] - M.TEKST_ANKER
            assert top == 23
            assert top + M.TEKST_H <= 39


def test_de_voetbalk_valt_binnen_het_scherm(tekeningen):
    M.voetbalk("^v kies  ENTER open", "2 cijf")
    assert ("fill_rect", 0, 192, 319, 17) in tekeningen
    # De twee kolommen van de voetbalk: links op x=6, rechts op de vaste
    # x=257. Ook die assertie ging verloren met test_voetbalk_sits_at_192.
    assert ("draw_text", 6, 211, "^v kies  ENTER open") in tekeningen
    assert ("draw_text", 257, 211, "2 cijf") in tekeningen
    for c in tekeningen:
        if c[0] == "draw_text":
            top = c[2] - M.TEKST_ANKER
            assert top == 193
            assert top + M.TEKST_H <= M.SCREEN_H


def test_het_mededelingsblok_zet_twee_regels_op_zestien_pixels(tekeningen):
    M.mededeling("geen lessen op deze dag", "volgende lesdag: wo 02-09")
    tops = [c[2] - M.TEKST_ANKER for c in tekeningen if c[0] == "draw_text"]
    assert tops == [100, 116]
    assert tops[1] - tops[0] == M.LINE


def test_het_mededelingsblok_staat_verticaal_gecentreerd_in_zijn_kaart(tekeningen):
    # Het enige blok in de app waarvan de tekst niet in zijn kaart gecentreerd
    # stond: 40 px kaart om 32 px tekst, verdeeld als 6 boven en 2 onder.
    M.mededeling("geen lessen op deze dag", "volgende lesdag: wo 02-09")
    kaart = [c for c in tekeningen if c[0] == "fill_rect" and c[4] == 40][0]
    tops = [c[2] - M.TEKST_ANKER for c in tekeningen if c[0] == "draw_text"]
    boven = tops[0] - kaart[2]
    onder = (kaart[2] + kaart[4]) - (tops[-1] + M.TEKST_H)
    assert boven == onder, "boven %d px, onder %d px" % (boven, onder)


def test_het_mededelingsblok_kapt_beide_regels_af_op_zijn_binnenmaat(tekeningen):
    # Geen van beide regels had een budget; de kaart is 271 px breed en de
    # tekst begint op x=40, dus alles daarboven liep de kaart af.
    M.mededeling("w" * 40, "x" * 40)
    kaart = [c for c in tekeningen if c[0] == "fill_rect" and c[4] == 40][0]
    rechterrand = kaart[1] + kaart[3]
    regels = [c for c in tekeningen if c[0] == "draw_text"]
    assert len(regels) == 2
    for c in regels:
        assert c[1] + M.text_width(c[3]) <= rechterrand, c


def test_de_scrollbaan_ligt_naast_alles_en_binnen_het_scherm(tekeningen):
    M.scrollbar(0, 4, 12)
    for c in tekeningen:
        if c[0] == "fill_rect":
            assert c[1] == 315
            assert c[1] + c[3] <= M.SCREEN_W
            assert c[2] >= 42
            assert c[2] + c[4] <= 192


def test_het_vaste_frame_voldoet_aan_de_vier_regels(tekeningen):
    M.vlak(0, 0, 319, 209, M.PAGINA)
    M.kop("VANDAAG", "di 01-09")
    M.contextbalk("6 lessen", "gesynct 07:41")
    M.mededeling("geen lessen op deze dag", "volgende lesdag: wo 02-09")
    M.voetbalk("^v kies  ENTER open", "2 cijf")
    layoutregels.binnen_scherm(tekeningen, M)
    layoutregels.geen_tekstoverlap(tekeningen, M)
    layoutregels.tekst_op_andere_kleur(tekeningen, M)
    layoutregels.binnen_zijn_blok(tekeningen, M)


def test_de_regels_vangen_de_fouten_waarvoor_ze_bedoeld_zijn(tekeningen):
    # tekst die van het scherm loopt
    M.tekst(0, 200, "te laag", M.DONKER)
    try:
        layoutregels.binnen_scherm(tekeningen, M)
        raise AssertionError("binnen_scherm liet tekst buiten het scherm door")
    except AssertionError as e:
        assert "buiten" in str(e)

    tekeningen.clear()
    M.tekst(10, 40, "een", M.DONKER)
    M.tekst(10, 51, "twee", M.DONKER)      # 11 px: overlapt
    try:
        layoutregels.geen_tekstoverlap(tekeningen, M)
        raise AssertionError("geen_tekstoverlap liet overlappende tekst door")
    except AssertionError as e:
        assert "overlap" in str(e)

    tekeningen.clear()
    M.vlak(0, 0, 319, 209, M.WIT)
    M.tekst(10, 40, "wit op wit", M.WIT)
    try:
        layoutregels.tekst_op_andere_kleur(tekeningen, M)
        raise AssertionError("tekst_op_andere_kleur liet wit op wit door")
    except AssertionError as e:
        assert "kleur" in str(e)

    # tekst die half over de rand van zijn eigen blokje valt: de derde regel
    # ziet hier niets (het paginavlak eronder omsluit de tekst wel), de
    # vierde wel.
    tekeningen.clear()
    M.vlak(0, 0, 319, 209, M.PAGINA)
    M.vlak(60, 44, 36, 20, M.BLAUW)
    M.tekst(53, 46, "10-11", M.WIT)
    layoutregels.tekst_op_andere_kleur(tekeningen, M)
    fout = None
    try:
        layoutregels.binnen_zijn_blok(tekeningen, M)
    except AssertionError as e:
        fout = str(e)
    assert fout and "half over de rand" in fout, fout
