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
