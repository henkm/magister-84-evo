"""Genereert de pictogrammen van de extensie. Geen afhankelijkheden.

Het ontwerp staat op een raster van 16 x 16 cellen, zodat elke uitvoermaat een
geheel aantal pixels per cel krijgt (16, 32, 48 en 128 delen allemaal door 16).
Daardoor blijft het blokkerig en scherp op elke maat, zonder schaalartefacten.

Draaien: python3 -m tools.icons
"""
import os
import struct
import zlib

WORTEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAP = os.path.join(WORTEL, "extension", "icons")

GRAFIET = (38, 44, 56)
WIT = (245, 247, 250)
SCHERM = (46, 160, 120)

RASTER = 16
MATEN = (16, 32, 48, 128)

# Een rekenmachine: kastje, venster, toetsen. Hetzelfde motief als het
# menu-item dat de extensie in de Magister-sidebar hangt, maar blokkerig
# in plaats van lijnwerk, want op 16 px is lijnwerk pap.
#
# Bewust geen letter en geen huisstijlkleur van iemand anders: dit is een
# eigen hulpstuk, geen product van de school of van Texas Instruments.
KAST = (3, 12, 1, 14)      # x van, x tot en met, y van, y tot en met
VENSTER = (4, 11, 3, 5)
TOETS_X = ((4, 5), (7, 8), (10, 11))
TOETS_Y = ((8, 9), (11, 12))


def _vul(uit, vak, kleur):
    x0, x1, y0, y1 = vak
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            uit[(x, y)] = kleur


def cellen():
    """Het volledige raster als {(x, y): kleur}."""
    uit = {}
    for y in range(RASTER):
        for x in range(RASTER):
            uit[(x, y)] = GRAFIET
    _vul(uit, KAST, WIT)
    _vul(uit, VENSTER, SCHERM)
    for xs in TOETS_X:
        for ys in TOETS_Y:
            _vul(uit, (xs[0], xs[1], ys[0], ys[1]), GRAFIET)
    return uit


def rijen(maat):
    """De pixelrijen voor een vierkant van `maat` bij `maat`."""
    if maat % RASTER:
        raise ValueError("maat %d is geen veelvoud van %d" % (maat, RASTER))
    cel = maat // RASTER
    raster = cellen()
    uit = []
    for py in range(maat):
        rij = bytearray()
        for px in range(maat):
            r, g, b = raster[(px // cel, py // cel)]
            rij += bytes((r, g, b))
        uit.append(bytes(rij))
    return uit


def png(maat):
    ruw = b"".join(b"\x00" + rij for rij in rijen(maat))

    def blok(soort, data):
        kern = soort + data
        return (struct.pack(">I", len(data)) + kern
                + struct.pack(">I", zlib.crc32(kern) & 0xFFFFFFFF))

    return (b"\x89PNG\r\n\x1a\n"
            + blok(b"IHDR", struct.pack(">IIBBBBB", maat, maat, 8, 2, 0, 0, 0))
            + blok(b"IDAT", zlib.compress(ruw, 9))
            + blok(b"IEND", b""))


def schrijf():
    os.makedirs(MAP, exist_ok=True)
    paden = []
    for maat in MATEN:
        pad = os.path.join(MAP, "icon-%d.png" % maat)
        with open(pad, "wb") as f:
            f.write(png(maat))
        paden.append(pad)
    return paden


def voorbeeld():
    """ASCII-weergave van het raster, om het ontwerp te kunnen nakijken."""
    raster = cellen()
    teken = {GRAFIET: ".", WIT: "#", SCHERM: "o"}
    return "\n".join(
        "".join(teken[raster[(x, y)]] for x in range(RASTER))
        for y in range(RASTER))


if __name__ == "__main__":
    print(voorbeeld())
    for pad in schrijf():
        print("geschreven: " + pad)
