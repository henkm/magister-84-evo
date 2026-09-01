"""Node genereert MAGDATA, Python importeert het en tekent er de app mee.

Dit is de enige test die het datacontract tussen de twee kanten echt afdwingt.
Verandert een van beide zonder de ander, dan faalt hij hier.
"""
import pathlib
import shutil
import subprocess
import sys

import pytest

WORTEL = pathlib.Path(__file__).resolve().parent.parent


@pytest.fixture(scope="module")
def magdata_bron():
    uit = subprocess.run(
        ["node", "tests/js/genereer_fixture.js"],
        cwd=WORTEL, capture_output=True, text=True)
    assert uit.returncode == 0, uit.stderr
    return uit.stdout


@pytest.fixture
def app(tmp_path, magdata_bron):
    (tmp_path / "MAGDATA.py").write_text(magdata_bron)
    shutil.copyfile(WORTEL / "calc" / "MAGISTER.py", tmp_path / "MAGISTER.py")
    sys.path.insert(0, str(tmp_path))
    for naam in ("MAGISTER", "MAGDATA"):
        sys.modules.pop(naam, None)
    try:
        import MAGISTER
        yield MAGISTER
    finally:
        sys.path.remove(str(tmp_path))
        for naam in ("MAGISTER", "MAGDATA"):
            sys.modules.pop(naam, None)


def test_de_app_leest_de_gegenereerde_data(app):
    assert app.data_ok()
    assert app.LEERLING == "Fenna"
    assert app.GESYNCT == "gesynct 09:12"
    assert app.PERIODE == "P1 · P2"
    assert len(app.DAGEN) == 28


def test_elke_rij_heeft_het_afgesproken_aantal_velden(app):
    for datum, kop, bijschrift, rijen in app.DAGEN:
        assert isinstance(datum, str) and isinstance(kop, str)
        for rij in rijen:
            assert len(rij) == 11, rij
            assert rij[app.L_SOORT] in ("les", "gat")
            assert rij[app.L_STATUS] in ("normaal", "gewijzigd", "vervallen")
            assert rij[app.L_CHIP] in ("", "HW", "TOETS", "GEWIJZIGD", "VERVALT")
    for naam, gem, cijfers in app.VAKKEN:
        for c in cijfers:
            assert len(c) == 4, c
            assert c[3] in ("normaal", "onvoldoende", "tekst")


def test_precies_een_dag_heet_vandaag(app):
    assert [d[2] for d in app.DAGEN].count("vandaag") == 1


def test_alle_schermen_voldoen_aan_de_layoutregels(app, tekeningen):
    """Alle schermen, met alle echte data, tegen de vier regels van het raster.

    layoutregels is dezelfde module die de rekenmachinekant gebruikt: niets
    buiten het scherm, geen twee teksten over elkaar, geen tekst in dezelfde
    kleur als het vlak eronder, en geen tekst die half over de rand van het
    vlak eronder valt. Faalt dit, dan is er data waarmee de app kapot
    tekent -- versoepel de regels dan niet, maar kort de tekst in de generator
    of in de app af.
    """
    import layoutregels

    def controleer():
        layoutregels.binnen_scherm(tekeningen, app)
        layoutregels.geen_tekstoverlap(tekeningen, app)
        layoutregels.tekst_op_andere_kleur(tekeningen, app)
        layoutregels.binnen_zijn_blok(tekeningen, app)
        tekeningen.clear()

    for i in range(len(app.DAGEN)):
        rijen = app.DAGEN[i][3]
        for scroll in range(0, max(1, len(rijen))):
            for selectie in range(0, max(1, len(rijen))):
                app.toon_dag(i, selectie, scroll)
                controleer()
        for j in range(len(rijen)):
            if rijen[j][app.L_SOORT] != "les":
                continue
            for scroll in range(0, 4):
                app.toon_lesdetail(i, j, scroll)
                controleer()

    for scroll in range(0, max(1, len(app.VAKKEN))):
        for selectie in range(0, max(1, len(app.VAKKEN))):
            app.toon_vakken(selectie, scroll)
            controleer()
    for v in range(len(app.VAKKEN)):
        for scroll in range(0, max(1, len(app.VAKKEN[v][2]))):
            app.toon_cijfers(v, scroll)
            controleer()


def test_de_broncode_is_geldige_python_zonder_verrassingen(magdata_bron):
    compile(magdata_bron, "MAGDATA.py", "exec")
    # geen tekens die het schermlettertype niet kent
    for ch in magdata_bron:
        assert ch == "\n" or ch == "·" or 32 <= ord(ch) <= 126, repr(ch)
