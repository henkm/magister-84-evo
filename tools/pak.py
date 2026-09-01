"""Bouwt de zip die je bij de Chrome Web Store uploadt.

Chrome pakt die zip uit zoals hij is: wat erin zit, staat straks op de computer
van iedere gebruiker. Daarom gaat er eerst een controle overheen, en daarom
noemt dit script op wat het heeft overgeslagen -- een .DS_Store die stilletjes
meelift is geen ramp, maar je hoort te weten dat hij er was.

De tijdstempels in de zip staan vast op 1980-01-01. Twee keer bouwen zonder
iets te wijzigen levert dan hetzelfde bestand op, en dat maakt zichtbaar of er
werkelijk iets veranderd is.

Draaien: python3 -m tools.pak
"""
import json
import os
import re
import sys
import zipfile

from tools import check_extension

WORTEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXTENSIE = os.path.join(WORTEL, "extension")
DIST = os.path.join(WORTEL, "dist")

# Werkbestanden van het besturingssysteem en van Python. Die horen niet in een
# pakket dat je verspreidt.
ROMMEL = ("__pycache__", "node_modules")

# De Web Store accepteert een tot vier getallen, elk hoogstens 65535.
VERSIE = re.compile(r"^\d{1,5}(\.\d{1,5}){0,3}$")


def bestanden(bron):
    """(meegenomen, overgeslagen), allebei gesorteerde relatieve paden."""
    mee, over = [], []
    for map_, mappen, namen in os.walk(bron):
        mappen.sort()
        for naam in namen:
            pad = os.path.relpath(os.path.join(map_, naam), bron)
            delen = pad.split(os.sep)
            if any(d.startswith(".") or d in ROMMEL for d in delen):
                over.append(pad)
            else:
                mee.append(pad)
    return sorted(mee), sorted(over)


def manifest(bron):
    with open(os.path.join(bron, "manifest.json"), encoding="utf-8") as f:
        return json.load(f)


def zipnaam(naam, versie):
    slak = re.sub(r"[^a-z0-9]+", "-", naam.lower()).strip("-")
    return "%s-%s.zip" % (slak or "extensie", versie)


def bouw(bron=EXTENSIE, dist=DIST):
    """Schrijft de zip en geeft (pad, meegenomen, overgeslagen) terug."""
    mee, over = bestanden(bron)
    if "manifest.json" not in mee:
        raise ValueError("geen manifest.json in %s" % bron)

    m = manifest(bron)
    versie = m.get("version", "")
    if not VERSIE.match(versie):
        raise ValueError("version %r is geen versie die de Web Store aanneemt "
                         "(een tot vier getallen, punt ertussen)" % versie)
    if any(int(d) > 65535 for d in versie.split(".")):
        raise ValueError("version %r: elk getal mag hoogstens 65535 zijn"
                         % versie)

    os.makedirs(dist, exist_ok=True)
    doel = os.path.join(dist, zipnaam(m.get("name", ""), versie))
    with zipfile.ZipFile(doel, "w", zipfile.ZIP_DEFLATED) as z:
        for pad in mee:
            info = zipfile.ZipInfo(pad.replace(os.sep, "/"),
                                   date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            with open(os.path.join(bron, pad), "rb") as f:
                z.writestr(info, f.read())
    return doel, mee, over


def main():
    fouten = check_extension.controleer()
    for fout in fouten:
        print("FOUT: " + fout)
    if fouten:
        print("%d probleem(en) in extension/ -- niets ingepakt"
              % len(fouten))
        return 1

    doel, mee, over = bouw()
    for pad in over:
        print("overgeslagen: " + pad)
    print("%d bestanden, %d kB" % (len(mee), os.path.getsize(doel) // 1024))
    print("geschreven: " + doel)
    return 0


if __name__ == "__main__":
    sys.exit(main())
