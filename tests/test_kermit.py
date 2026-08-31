from evosend import kermit as k

SEND_INIT_HEX = "01302053" "7e302040" "2d235931" "7e2e2235" "4d3e0d"

def test_send_init_is_the_known_good_packet():
    assert k.SEND_INIT == bytes.fromhex(SEND_INIT_HEX)

def test_checksum_matches_send_init_body():
    body = k.SEND_INIT[1:-2]
    assert k.checksum(body) == k.SEND_INIT[-2]

def test_short_packet_layout():
    p = k.encode_packet(1, "Y", b"ok")
    assert p[0] == 1 and p[-1] == 13
    assert p[1] == k.tochar(2 + 2 + 1)
    assert p[2] == k.tochar(1)
    assert p[3] == ord("Y")
    assert p[4:6] == b"ok"
    assert p[-2] == k.checksum(p[1:-2])

def test_long_packet_used_for_F_even_when_short():
    p = k.encode_packet(1, "F", b"x")
    assert p[1] == 32

def test_escape_control_and_prefix_characters():
    assert k.escape(bytes([0])) == bytes([35, 64])
    assert k.escape(b"#") == b"##"
    assert k.escape(b"~") == b"#~"
    assert k.escape(b"A") == b"A"

def test_chunk_end_never_splits_an_escape_pair():
    buf = b"A" * 9 + bytes([35, 64])
    assert k.chunk_end(buf, 0, 10) == 9

def test_parse_packet_reads_type_and_data():
    typ, data = k.parse_packet(k.encode_packet(3, "Y", b"hoi"))
    assert (typ, data) == ("Y", b"hoi")

def test_chunk_end_guarantees_forward_progress():
    # If limit is too small for the escape unit at start, consume it anyway
    assert k.chunk_end(bytes([35, 64]), 0, 1) == 2

def test_encode_packet_S_returns_send_init():
    # The "S" type is a short-circuit that returns SEND_INIT unchanged
    assert k.encode_packet(0, "S") == k.SEND_INIT

def test_parse_packet_on_long_packet():
    # Long packets use the extended format (p[1] == 32)
    p = k.encode_packet(1, "F", b"hallo")
    typ, data = k.parse_packet(p)
    assert (typ, data) == ("F", b"hallo")

def test_parse_packet_raises_on_missing_start_byte():
    # Packet with no SOH should raise ValueError
    try:
        k.parse_packet(b"no start byte here")
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "geen startbyte" in str(e)
