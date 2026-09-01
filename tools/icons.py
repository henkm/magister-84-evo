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

BLAUW = (11, 107, 181)
WIT = (255, 255, 255)
ORANJE = (245, 130, 11)

RASTER = 16
MATEN = (16, 32, 48, 128)

# De M: twee dikke stijlen met een ondiepe V ertussen. Per rij de cellen die
# wit worden.
M_CELLEN = {
    4:  [2, 3, 10, 11],
    5:  [2, 3, 4, 9, 10, 11],
    6:  [2, 3, 5, 8, 10, 11],
    7:  [2, 3, 6, 7, 10, 11],
    8:  [2, 3, 10, 11],
    9:  [2, 3, 10, 11],
    10: [2, 3, 10, 11],
    11: [2, 3, 10, 11],
}
# De oranje stip, rechtsonder naast de M.
STIP_CELLEN = [(13, 10), (14, 10), (13, 11), (14, 11)]


def cellen():
    """Het volledige raster als {(x, y): kleur}."""
    uit = {}
    for y in range(RASTER):
        for x in range(RASTER):
            uit[(x, y)] = BLAUW
    for y, xs in M_CELLEN.items():
        for x in xs:
            uit[(x, y)] = WIT
    for x, y in STIP_CELLEN:
        uit[(x, y)] = ORANJE
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
    teken = {BLAUW: ".", WIT: "#", ORANJE: "o"}
    return "\n".join(
        "".join(teken[raster[(x, y)]] for x in range(RASTER))
        for y in range(RASTER))


if __name__ == "__main__":
    print(voorbeeld())
    for pad in schrijf():
        print("geschreven: " + pad)
