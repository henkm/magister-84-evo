"""CBOR-payload en programmacontainer voor de TI-84 Evo."""
import urllib.parse

TYPE_PYTHON = 15
TYPE_BASIC = 2


def cbor_head(major, n):
    r = major << 5
    if n < 24:
        return bytes([r | n])
    if n <= 255:
        return bytes([24 | r, n])
    if n <= 65535:
        return bytes([25 | r, (n >> 8) & 255, n & 255])
    return bytes([26 | r, (n >> 24) & 255, (n >> 16) & 255,
                  (n >> 8) & 255, n & 255])


def cbor(v):
    if isinstance(v, bool):
        raise TypeError("bool wordt niet ondersteund")
    if isinstance(v, int):
        return cbor_head(0, v)
    if isinstance(v, (bytes, bytearray)):
        return cbor_head(2, len(v)) + bytes(v)
    if isinstance(v, str):
        b = v.encode()
        return cbor_head(3, len(b)) + b
    raise TypeError("kan %s niet als CBOR coderen" % type(v))


def _kv(k, v):
    return cbor(k) + cbor(v)


def name_to_tichars(name):
    out = ""
    for ch in name:
        if "A" <= ch <= "Z":
            # 0xE800 (59392): private-use area offset for letters A-Z
            # See the transfer-protocol section in README.md
            out += chr(ord(ch) - 65 + 59392)
        elif "0" <= ch <= "9":
            # 0xE401 (58369): private-use area offset for digits 0-9
            # See the transfer-protocol section in README.md
            out += chr(ord(ch) - 48 + 58369)
        else:
            raise ValueError("naam %r bevat een teken dat niet kan: %r"
                             % (name, ch))
    return out


def name_to_uri(name):
    return urllib.parse.quote(name_to_tichars(name), safe="")


def name_to_tokbytes(name):
    out = bytearray()
    for ch in name_to_tichars(name):
        c = ord(ch)
        out += bytes([c & 255, (c >> 8) & 255])
    return bytes(out + b"\x00\x00")


def _u32le(n):
    return bytes([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255])


def build_container(name, source):
    if len(source) > 0xFFFF:
        raise ValueError("broncode is %d bytes, maar mag niet groter zijn dan %d bytes"
                         % (len(source), 0xFFFF))
    nb = name.encode()
    # 18: 17 bytes of fixed fields (4 header + 4 total size + 4 name len + 2 source len + 2 type + 1 null)
    # plus 1 byte of trailing padding added by the fill-to-total step below.
    # See the transfer-protocol section in README.md
    total = len(source) + len(nb) + 18
    out = (bytes([19, 1, 0, 0]) + _u32le(total) + _u32le(len(nb)) + nb
           + bytes([0]) + bytes([len(source) & 255, (len(source) >> 8) & 255])
           + bytes([0, 2]) + source)
    if len(out) < total:
        out += bytes(total - len(out))
    return out


def payload_checksum(data):
    # Excludes 3 words (6 bytes) from checksum if length is even, 1 word (2 bytes) if odd.
    # These values are from the spec capture; the common case (even) skips the final checksum itself.
    # See the transfer-protocol section in README.md
    words = max(0, (len(data) >> 1) - (3 if len(data) % 2 == 0 else 1))
    n = 0
    for i in range(words):
        n ^= data[2 * i] | (data[2 * i + 1] << 8)
    return bytes([(n >> 8) & 255, n & 255])


def build_payload(name, source, vartype=TYPE_PYTHON):
    container = build_container(name, source)
    nm = name_to_tokbytes(name)
    meta = (bytes([0xBF]) + _kv("type", vartype) + _kv("version", 1)
            + _kv("flags", 0) + cbor("name")
            + cbor_head(2, len(nm)) + nm + bytes([0xFF]))
    outer = (bytes([0xBF]) + cbor("metaData") + meta + _kv("version", 1)
             + _kv("size", len(container)) + cbor("data")
             + cbor_head(2, len(container)) + container + bytes([0xFF]))
    return outer + payload_checksum(outer)


def transfer_url(name, vartype=TYPE_PYTHON):
    return ("hh01/xfr/var?name=%s&type=%d&memtarget=0&policy=1"
            % (name_to_uri(name), vartype))


def validate_name(name):
    name = name.upper()
    if not 1 <= len(name) <= 8:
        raise ValueError("programmanaam moet 1 tot 8 tekens zijn: %r" % name)
    if not ("A" <= name[0] <= "Z"):
        raise ValueError("programmanaam moet met een letter beginnen: %r" % name)
    name_to_tichars(name)
    return name
