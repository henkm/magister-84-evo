"""tools/pak bouwt de zip voor de Web Store.

Wat in die zip zit, komt op de computer van iedere gebruiker terecht. Daarom
staat hier vast wat erin hoort en wat er beslist niet in hoort.
"""
import json
import os

import pytest

from tools import pak


def maak_boom(map_, versie="1.0.0", naam="Test Extensie", rommel=()):
    """Een minimale extensie, plus eventueel wat er niet in mag."""
    os.makedirs(os.path.join(map_, "src"), exist_ok=True)
    with open(os.path.join(map_, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump({"manifest_version": 3, "name": naam, "version": versie}, f)
    with open(os.path.join(map_, "src", "a.js"), "w", encoding="utf-8") as f:
        f.write("// a\n")
    for pad in rommel:
        vol = os.path.join(map_, pad)
        os.makedirs(os.path.dirname(vol), exist_ok=True)
        with open(vol, "w", encoding="utf-8") as f:
            f.write("hoort hier niet\n")
    return map_


def namen(pad):
    import zipfile
    with zipfile.ZipFile(pad) as z:
        return sorted(z.namelist())


def test_manifest_staat_in_de_wortel_van_de_zip(tmp_path):
    bron = maak_boom(str(tmp_path / "ext"))
    doel, _, _ = pak.bouw(bron, str(tmp_path / "dist"))
    assert namen(doel) == ["manifest.json", "src/a.js"], (
        "Chrome zoekt manifest.json in de wortel; zit de hele map er als "
        "laag omheen, dan weigert de store de upload")


def test_verborgen_bestanden_en_caches_blijven_buiten(tmp_path):
    bron = maak_boom(str(tmp_path / "ext"),
                     rommel=(".DS_Store", "src/__pycache__/a.pyc"))
    doel, mee, over = pak.bouw(bron, str(tmp_path / "dist"))
    assert namen(doel) == ["manifest.json", "src/a.js"]
    assert sorted(over) == [".DS_Store", os.path.join("src", "__pycache__",
                                                      "a.pyc")], (
        "overgeslagen bestanden moeten gemeld worden, niet stil verdwijnen")
    assert ".DS_Store" not in mee


def test_twee_keer_bouwen_geeft_hetzelfde_bestand(tmp_path):
    bron = maak_boom(str(tmp_path / "ext"))
    eerst, _, _ = pak.bouw(bron, str(tmp_path / "a"))
    daarna, _, _ = pak.bouw(bron, str(tmp_path / "b"))
    with open(eerst, "rb") as f1, open(daarna, "rb") as f2:
        assert f1.read() == f2.read(), (
            "vaste tijdstempels maken zichtbaar of er echt iets veranderd is")


def test_de_bestandsnaam_draagt_naam_en_versie(tmp_path):
    bron = maak_boom(str(tmp_path / "ext"), versie="2.3.4",
                     naam="Rooster naar je rekenmachine")
    doel, _, _ = pak.bouw(bron, str(tmp_path / "dist"))
    assert os.path.basename(doel) == "rooster-naar-je-rekenmachine-2.3.4.zip"


@pytest.mark.parametrize("versie", ["1.0-beta", "", "1.0.0.0.0", "70000.0.0",
                                    "v1.0.0"])
def test_een_versie_die_de_store_niet_aanneemt_wordt_geweigerd(tmp_path, versie):
    bron = maak_boom(str(tmp_path / "ext"), versie=versie)
    with pytest.raises(ValueError):
        pak.bouw(bron, str(tmp_path / "dist"))


def test_zonder_manifest_wordt_er_niets_ingepakt(tmp_path):
    bron = str(tmp_path / "ext")
    os.makedirs(bron)
    with open(os.path.join(bron, "los.js"), "w", encoding="utf-8") as f:
        f.write("// los\n")
    with pytest.raises(ValueError):
        pak.bouw(bron, str(tmp_path / "dist"))


def test_de_echte_extensie_gaat_er_compleet_in(tmp_path):
    doel, mee, _ = pak.bouw(dist=str(tmp_path / "dist"))
    inhoud = namen(doel)
    for moet in ("manifest.json", "panel.html", "panel.js", "content.js",
                 "service_worker.js", "src/token.js", "src/menu.js",
                 "calc/MAGISTER.py", "icons/icon-128.png"):
        assert moet in inhoud, "%s hoort in het pakket" % moet
    assert not [n for n in inhoud if "/." in n or n.startswith(".")]
