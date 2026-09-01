import json
import os

from tools import golden


def test_gouden_vectoren_zijn_vers():
    """Het gecommitte bestand moet gelijk zijn aan wat de Python-kant nu geeft.

    Loopt dit uiteen, dan is de Python-implementatie veranderd zonder dat de
    vectoren zijn bijgewerkt, en toetst de JavaScript-kant aan een oude waarheid.
    Herstellen met: python3 -m tools.golden
    """
    with open(golden.PAD) as f:
        opgeslagen = json.load(f)
    assert opgeslagen == json.loads(json.dumps(golden.bouw()))


def test_vectoren_dekken_alle_onderdelen():
    verwacht = {"checksum", "encode_packet", "escape", "chunk_end", "cbor_int",
                "cbor_str", "name_to_uri", "name_to_tokbytes",
                "build_container", "payload_checksum", "build_payload",
                "transfer_url"}
    assert set(golden.bouw()) == verwacht
    for naam, rijen in golden.bouw().items():
        assert len(rijen) >= 4, naam
