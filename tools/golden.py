"""Schrijft tests/golden/protocol.json uit de Python-implementatie.

De Python-kant is end-to-end tegen het echte apparaat geverifieerd. Dit bestand
is daarom de waarheid waaraan de JavaScript-kant zich moet houden. Een vector
aanpassen om JavaScript groen te krijgen is nooit de oplossing.

Draaien: python3 -m tools.golden
"""
import json
import os

from tools.evosend import kermit, payload

WORTEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAD = os.path.join(WORTEL, "tests", "golden", "protocol.json")


def _h(b):
    return bytes(b).hex()


def _parse_rij(rauw):
    typ, data = kermit.parse_packet(rauw)
    return {"rauw": _h(rauw), "type": typ, "data": _h(data)}


def bouw():
    pakketten = [
        (0, "S", b""),
        (1, "F", payload.transfer_url("MAGDATA").encode()),
        (2, "A", b'""B81' + bytes([32 + 5]) + b"18343@ "),
        (3, "D", b"x" * 10),
        (4, "D", b"y" * 77),          # n = 80: nog net een kort pakket
        (5, "D", b"z" * 78),          # n = 81: dus een lang pakket
        (6, "D", bytes(range(32, 127))),
        (7, "Z", b""),
        (8, "B", b""),
        (63, "D", b"w" * 200),        # hoogste volgnummer
    ]
    escape_in = [b"", bytes(range(256)), b"###", b"~~~", b"#~#~",
                 b"\x00\x1f\x7f\xff", b"gewoon"]
    chunk_in = [
        (kermit.escape(bytes(range(256))), 0, 10),
        (kermit.escape(bytes(range(256))), 0, 1),
        (kermit.escape(b"~#~#~#"), 0, 3),
        (kermit.escape(b"\x00" * 50), 0, 7),
        (b"abcdef", 2, 3),
        (b"", 0, 10),
        (b"abc", 0, 100),
    ]
    parse_in = [
        kermit.encode_packet(3, "Y", b""),             # kort, zonder data
        kermit.encode_packet(1, "Y", b"ok"),           # kort, met data
        kermit.encode_packet(2, "D", b"y" * 77),       # n = 80: nog net kort
        kermit.encode_packet(4, "D", b"z" * 78),       # n = 81: lang, kop van 7
        kermit.encode_packet(5, "D", b"w" * 200),      # ruim over de grens
        kermit.encode_packet(6, "E", b"geen ruimte"),  # kort E met fouttekst
        kermit.encode_packet(7, "E", b"fout: " + b"x" * 100),   # lang E
        kermit.encode_packet(8, "E", b"schijf vol: \xe9\xe8"),  # niet-ASCII
        # rommel voor de startbyte: de resten van een vorig antwoord
        b"\x00\x00\x0d\x0a" + kermit.encode_packet(9, "Y", b"ok"),
        b"\x00\x00\x0a" + kermit.encode_packet(10, "D", b"q" * 120),
    ]

    namen = ["A", "Z", "A0", "MAGISTER", "MAGDATA", "TEST1234"]
    bronnen = [b"", b"print('hoi')\n", b"x" * 300, bytes(range(256))]

    return {
        "checksum": [
            {"data": _h(d), "uit": kermit.checksum(d)}
            for d in [b"", b"\x00", b"ABC", bytes(range(64)), b"\xff" * 10]
        ],
        "encode_packet": [
            {"seq": s, "type": t, "data": _h(d),
             "uit": _h(kermit.encode_packet(s, t, d))}
            for s, t, d in pakketten
        ],
        "escape": [
            {"in": _h(d), "uit": _h(kermit.escape(d))} for d in escape_in
        ],
        "chunk_end": [
            {"buf": _h(b), "start": s, "limit": l,
             "uit": kermit.chunk_end(b, s, l)}
            for b, s, l in chunk_in
        ],
        "parse_packet": [_parse_rij(r) for r in parse_in],
        "cbor_int": [
            {"waarde": n, "uit": _h(payload.cbor(n))}
            for n in [0, 1, 23, 24, 255, 256, 65535, 65536, 16777215]
        ],
        "cbor_str": [
            {"waarde": s, "uit": _h(payload.cbor(s))}
            for s in ["", "a", "name", "metaData", "version", "size", "data"]
        ],
        "name_to_uri": [
            {"naam": n, "uit": payload.name_to_uri(n)} for n in namen
        ],
        "name_to_tokbytes": [
            {"naam": n, "uit": _h(payload.name_to_tokbytes(n))} for n in namen
        ],
        "build_container": [
            {"naam": n, "bron": _h(b), "uit": _h(payload.build_container(n, b))}
            for n in ["TEST", "MAGDATA"] for b in bronnen
        ],
        "payload_checksum": [
            {"data": _h(d), "uit": _h(payload.payload_checksum(d))}
            for d in [b"", b"\x01", b"\x01\x02", bytes(range(20)),
                      bytes(range(21))]
        ],
        "build_payload": [
            {"naam": n, "bron": _h(b), "uit": _h(payload.build_payload(n, b))}
            for n in ["TEST", "MAGDATA"] for b in bronnen
        ],
        "transfer_url": [
            {"naam": n, "uit": payload.transfer_url(n)} for n in namen
        ],
    }


def schrijf():
    os.makedirs(os.path.dirname(PAD), exist_ok=True)
    tekst = json.dumps(bouw(), indent=1, sort_keys=True) + "\n"
    with open(PAD, "w") as f:
        f.write(tekst)
    return tekst


if __name__ == "__main__":
    schrijf()
    print("geschreven: " + PAD)
