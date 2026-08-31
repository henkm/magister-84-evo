import pytest
from evosend import payload as p

def test_cbor_small_int_is_one_byte():
    assert p.cbor(0) == b"\x00"
    assert p.cbor(15) == b"\x0f"

def test_cbor_int_widths():
    assert p.cbor(200) == bytes([0x18, 200])
    assert p.cbor(300) == bytes([0x19, 1, 44])

def test_cbor_text_and_bytes():
    assert p.cbor("name") == b"\x64name"
    assert p.cbor(b"\x01\x02") == b"\x42\x01\x02"

def test_name_maps_to_private_use_area():
    assert p.name_to_tichars("A") == chr(59392)
    assert p.name_to_tichars("0") == chr(58369)
    assert p.name_to_tichars("MAGDATA")[1] == chr(59392)

def test_name_rejects_unsupported_characters():
    with pytest.raises(ValueError):
        p.name_to_tichars("mag-data")

def test_tokbytes_are_utf16le_with_nul_terminator():
    b = p.name_to_tokbytes("A")
    assert b == bytes([0x00, 0xE8, 0x00, 0x00])

def test_container_header_and_padding():
    c = p.build_container("MAGDATA", b"x = 1\n")
    assert c[:4] == bytes([19, 1, 0, 0])
    assert len(c) == int.from_bytes(c[4:8], "little")
    assert int.from_bytes(c[8:12], "little") == len("MAGDATA")
    assert c[12:19] == b"MAGDATA"

def test_payload_ends_with_its_own_checksum():
    full = p.build_payload("MAGDATA", b"x = 1\n")
    assert full[-2:] == p.payload_checksum(full[:-2])
    assert full[0] == 0xBF

def test_validate_name_uppercases_and_rejects_bad_names():
    assert p.validate_name("magdata") == "MAGDATA"
    with pytest.raises(ValueError):
        p.validate_name("")
    with pytest.raises(ValueError):
        p.validate_name("TELANGENAAM")
    with pytest.raises(ValueError):
        p.validate_name("1STE")

def test_transfer_url_carries_encoded_name_and_type():
    url = p.transfer_url("MAGDATA")
    assert url.startswith("hh01/xfr/var?name=%EE")
    assert "&type=15&memtarget=0&policy=1" in url
