"""Controleert de schil van de extensie op verwijzingen die nergens heen gaan.

Chrome faalt hier stil: een typefout in een importpad laat het paneel leeg
achter, zonder melding en zonder dat een van beide testsuites er iets van
merkt. Dit script loopt daarom elke verwijzing na die op schijf moet bestaan:
het manifest, de pictogrammen, wat panel.html binnenhaalt, elk importpad in
de JavaScript en de app die het paneel bij een sync meestuurt.

Draaien: python3 -m tools.check_extension
"""
import json
import os
import re
import sys

WORTEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXTENSIE = os.path.join(WORTEL, "extension")

MATEN = ("16", "32", "48", "128")
APP = "calc/MAGISTER.py"

# Alleen verklaringen die aan het begin van een regel staan. Een woord
# "import" in lopende tekst binnen commentaar begint nooit zo.
IMPORTS = (
    re.compile(r"^[ \t]*import\s[^'\"]*?from\s*['\"]([^'\"]+)['\"]", re.M),
    re.compile(r"^[ \t]*import\s*['\"]([^'\"]+)['\"]", re.M),
    re.compile(r"^[ \t]*export\s[^'\"]*?from\s*['\"]([^'\"]+)['\"]", re.M),
)
GETURL = re.compile(r"chrome\.runtime\.getURL\(\s*['\"]([^'\"]+)['\"]")
BLOKCOMMENTAAR = re.compile(r"/\*.*?\*/", re.S)
VERWIJZING = re.compile(r"(?:href|src)\s*=\s*[\"']([^\"']+)[\"']")


def lees(pad):
    with open(pad, encoding="utf-8") as f:
        return f.read()


def js_bestanden(ext):
    """panel.js, service_worker.js en alles in src/."""
    uit = [os.path.join(ext, "panel.js"), os.path.join(ext, "service_worker.js")]
    src = os.path.join(ext, "src")
    if os.path.isdir(src):
        uit += [os.path.join(src, n) for n in sorted(os.listdir(src))
                if n.endswith(".js")]
    return uit


def controleer(ext=EXTENSIE):
    """Geeft een lijst met problemen; leeg betekent dat alles klopt."""
    fouten = []

    def moet_bestaan(pad, waarom):
        if not os.path.isfile(os.path.join(ext, pad)):
            fouten.append("%s: %s bestaat niet" % (waarom, pad))

    manifestpad = os.path.join(ext, "manifest.json")
    if not os.path.isfile(manifestpad):
        return ["manifest.json bestaat niet"]
    try:
        manifest = json.loads(lees(manifestpad))
    except ValueError as e:
        return ["manifest.json is geen geldige JSON: %s" % e]

    if manifest.get("manifest_version") != 3:
        fouten.append("manifest_version is %r, moet 3 zijn"
                      % (manifest.get("manifest_version"),))

    werker = (manifest.get("background") or {}).get("service_worker")
    if not werker:
        fouten.append("manifest noemt geen background.service_worker")
    else:
        moet_bestaan(werker, "manifest background.service_worker")

    pictogrammen = (
        ("action.default_icon", (manifest.get("action") or {}).get("default_icon")),
        ("icons", manifest.get("icons")),
    )
    for sleutel, iconen in pictogrammen:
        if not isinstance(iconen, dict):
            fouten.append("manifest mist %s" % sleutel)
            continue
        for maat in MATEN:
            if maat not in iconen:
                fouten.append("manifest %s mist maat %s" % (sleutel, maat))
            else:
                moet_bestaan(iconen[maat], "manifest %s[%s]" % (sleutel, maat))

    htmlpad = os.path.join(ext, "panel.html")
    if not os.path.isfile(htmlpad):
        fouten.append("panel.html bestaat niet")
    else:
        for verwijzing in VERWIJZING.findall(lees(htmlpad)):
            if "://" in verwijzing or verwijzing.startswith(("#", "data:")):
                continue
            moet_bestaan(verwijzing, "panel.html verwijst naar")

    for pad in js_bestanden(ext):
        naam = os.path.relpath(pad, ext)
        if not os.path.isfile(pad):
            fouten.append("%s bestaat niet" % naam)
            continue
        tekst = BLOKCOMMENTAAR.sub("", lees(pad))
        for regex in IMPORTS:
            for spec in regex.findall(tekst):
                if not spec.startswith("."):
                    fouten.append("%s importeert %r; een extensie kent geen "
                                  "kale modulenamen" % (naam, spec))
                    continue
                doel = os.path.normpath(
                    os.path.join(os.path.dirname(pad), spec))
                if not os.path.isfile(doel):
                    fouten.append("%s importeert %r, dat bestaat niet"
                                  % (naam, spec))
        for spec in GETURL.findall(tekst):
            moet_bestaan(spec, "%s haalt met chrome.runtime.getURL" % naam)

    moet_bestaan(APP, "de app die het paneel bij elke sync meestuurt")
    return fouten


def main():
    fouten = controleer()
    for fout in fouten:
        print("FOUT: " + fout)
    if fouten:
        print("%d probleem(en) in extension/" % len(fouten))
        return 1
    print("extension/: alle verwijzingen kloppen")
    return 0


if __name__ == "__main__":
    sys.exit(main())
