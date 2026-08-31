import MAGISTER as M


def test_fixture_is_loadable_and_shaped():
    assert M.data_ok()
    assert len(M.DAGEN) >= 3
    datum, kop, bijschrift, rijen = M.DAGEN[0]
    assert kop.startswith("di ") or kop.startswith("ma ")
    assert len(rijen[0]) == 11


def test_dag_index_finds_today_and_clamps():
    assert M.dag_index(M.DAGEN[1][0]) == 1
    assert M.dag_index("1999-01-01") == 0


def test_every_row_has_a_known_soort_and_status():
    for _, _, _, rijen in M.DAGEN:
        for r in rijen:
            assert r[M.L_SOORT] in ("les", "gat")
            assert r[M.L_STATUS] in ("normaal", "vervallen", "gewijzigd")
            assert r[M.L_CHIP] in ("", "HW", "TOETS", "GEWIJZIGD", "VERVALT")


def test_subject_names_fit_the_lesson_row():
    for _, _, _, rijen in M.DAGEN:
        for r in rijen:
            if r[M.L_SOORT] == "les":
                assert M.fits(r[M.L_VAK], 313 - 96)
