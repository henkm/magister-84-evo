"""De schil van de extensie: manifest, paneel en de verwijzingen ertussen.

Taak 10 heeft geen echte functionele test - die vraagt een Magister-login en
een rekenmachine. Wat wel te toetsen is, staat hier: dat niets in de extensie
naar een bestand wijst dat er niet is, en dat het paneel niets bewaart of
logt wat er niet in hoort.
"""
import json
import os
import re
import shutil

from tools import check_extension

PANEEL = os.path.join(check_extension.EXTENSIE, "panel.js")
MANIFEST = os.path.join(check_extension.EXTENSIE, "manifest.json")

STORAGE_SET = re.compile(r"chrome\.storage\.local\.set\(\{([^}]*)\}")
SLEUTEL = re.compile(r"(\w+)\s*:")


def paneelbron():
    with open(PANEEL, encoding="utf-8") as f:
        return f.read()


def test_alle_verwijzingen_in_de_extensie_bestaan():
    """Herstellen met: python3 -m tools.check_extension"""
    assert check_extension.controleer() == []


def test_de_controle_ziet_een_kapot_importpad(tmp_path):
    """Zonder deze test is de test hierboven een lege belofte.

    Een verkeerd importpad is precies de fout die Chrome stil laat mislukken,
    dus de controle moet aantoonbaar aanslaan.
    """
    kopie = tmp_path / "extension"
    shutil.copytree(check_extension.EXTENSIE, kopie)
    paneel = kopie / "panel.js"
    paneel.write_text(
        paneel.read_text(encoding="utf-8").replace("./src/stroom.js",
                                                   "./src/stroomm.js"),
        encoding="utf-8")
    fouten = check_extension.controleer(str(kopie))
    assert any("stroomm.js" in fout for fout in fouten), fouten


def test_de_actie_heeft_geen_popup():
    """Een browser-action popup sluit zodra het apparaatvenster van Chrome de
    focus pakt; midden in een transfer breekt dat de verbinding af. Daarom
    opent service_worker.js een echt venster.
    """
    with open(MANIFEST, encoding="utf-8") as f:
        manifest = json.load(f)
    assert "default_popup" not in manifest["action"]


def test_het_paneel_bewaart_alleen_de_kindkeuze():
    """Het token blijft in de Authorization-header en gaat nergens anders heen."""
    sleutels = set()
    for blok in STORAGE_SET.findall(paneelbron()):
        sleutels.update(SLEUTEL.findall(blok))
    assert sleutels == {"kindId", "kindNaam", "laatsteSync"}


def test_het_paneel_logt_niets():
    """Geen console-regel kan dan per ongeluk een token meenemen."""
    assert "console." not in paneelbron()
