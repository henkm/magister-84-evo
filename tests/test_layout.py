import MAGISTER as M

def test_advance_is_measured_not_assumed():
    assert M.ADVANCE == 10
    assert M.text_width("ABC") == 30

def test_full_line_is_32_characters():
    assert M.fits("X" * 32, M.SCREEN_W)
    assert not M.fits("X" * 33, M.SCREEN_W)

def test_right_align_formula():
    assert M.right_x("7,2") == 313 - 30

def test_truncate_cuts_on_word_boundary_and_marks_it():
    assert M.truncate("natuurkunde en techniek", 150) == "natuurkunde."
    assert M.truncate("wiskunde B", 150) == "wiskunde B"

def test_truncate_falls_back_to_hard_cut_for_one_long_word():
    assert M.truncate("aardrijkskundeles", 50) == "aard."

def test_wrap_breaks_on_words():
    regels = M.wrap("leer hoofdstuk 1 tot en met 3 voor de toets", 100)
    assert regels == ["leer", "hoofdstuk", "1 tot en", "met 3 voor", "de toets"]
    assert all(M.fits(r, 100) for r in regels)
