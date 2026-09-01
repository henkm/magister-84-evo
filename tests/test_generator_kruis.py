"""Node genereert MAGDATA, Python importeert het en tekent er de app mee.

Dit is de enige test die het datacontract tussen de twee kanten echt afdwingt.
Verandert een van beide zonder de ander, dan faalt hij hier.
"""
import json
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


# --- de twee tests hieronder bewaken de fixture, niet de code ---
#
# Twee van de regels hierboven waren leeg omdat de fixture te braaf was: geen
# vaknaam die de rechterrand haalde, geen teken boven ASCII 126 en nergens een
# dubbel aanhalingsteken. Beide tests slaagden toen ook met kapotte code. Wie
# de fixture inkort, moet dat hier merken -- niet pas op het apparaat.

def _alle_teksten(x):
    if isinstance(x, str):
        yield x
    elif isinstance(x, dict):
        for v in x.values():
            yield from _alle_teksten(v)
    elif isinstance(x, list):
        for v in x:
            yield from _alle_teksten(v)


def test_de_fixture_houdt_de_schermrandregel_scherp(app):
    """Er moet een les zonder chip zijn waarvan het vak van het scherm loopt.

    Een lesregel met een chip botst bij een lang vak eerst tegen die chip, en
    dan is het de overlapregel die aanslaat. Alleen een chiploze regel bereikt
    binnen_scherm(): daar is het vakbudget de hele kolom tot de rechterrand.
    """
    lang = []
    for _, _, _, rijen in app.DAGEN:
        for rij in rijen:
            if rij[app.L_SOORT] != "les" or rij[app.L_CHIP]:
                continue
            if app.TEKST_X + app.text_width(rij[app.L_VAK]) > app.SCREEN_W:
                lang.append(rij[app.L_VAK])
    assert lang, ("geen chiploze les met een vaknaam die voorbij de rechterrand "
                  "reikt: binnen_scherm() heeft niets meer te controleren")


def test_de_fixture_bevat_tekens_die_de_generator_moet_opruimen(magdata_bron):
    """De tekenscan hierboven kijkt alleen iets na als er iets te scannen is."""
    rauw = json.loads((WORTEL / "tests" / "fixtures" / "afspraken.json")
                      .read_text(encoding="utf-8"))
    waarden = list(_alle_teksten(rauw))
    assert any(ord(ch) > 126 for w in waarden for ch in w), \
        "de fixture heeft geen enkel teken buiten ASCII: veiligeTekst() " \
        "wordt door de tekenscan niet geraakt"
    assert any('"' in w for w in waarden), \
        "de fixture heeft nergens een dubbel aanhalingsteken: pyStr() wordt " \
        "door de tekenscan niet geraakt"
    # en de generator laat er in de uitvoer ook echt iets van zien
    assert '\\"' in magdata_bron, "geen ontsnapt aanhalingsteken in MAGDATA"

