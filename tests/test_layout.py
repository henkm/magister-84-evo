import MAGISTER as M

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
    test_cases = [
        ("natuurkunde en techniek", 150),
        ("wiskunde B", 150),
        ("aardrijkskundeles", 50),
        ("een lang stuk tekst voor de toets", 120),
        ("korte", 200),
    ]
    for text, px in test_cases:
        result = M.truncate(text, px)
        assert M.fits(result, px), f"truncate('{text}', {px}) = '{result}' ({M.text_width(result)} px) does not fit in {px} px"
