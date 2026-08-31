"""Kermit-framing voor de TI-84 Evo, herbouwd uit evo-send.min.js."""

SOH = 1
CR = 13
SEND_INIT = bytes.fromhex("01302053" "7e302040" "2d235931" "7e2e2235" "4d3e0d")


def tochar(n):
    return (n + 32) & 255


def checksum(data):
    s = sum(data)
    return (32 + ((s + ((192 & s) >> 6)) & 63)) & 255


def encode_packet(seq, typ, data=b""):
    if typ == "S":
        return SEND_INIT
    n = 2 + len(data) + 1
    if n <= 80 and typ != "F":
        body = bytes([tochar(n), tochar(seq), ord(typ)]) + data
        return bytes([SOH]) + body + bytes([checksum(body), CR])
    total = len(data) + 1
    head = bytes([32, tochar(seq), ord(typ),
                  tochar(total // 95), tochar(total % 95)])
    body = head + bytes([checksum(head)]) + data
    return bytes([SOH]) + body + bytes([checksum(body), CR])


def escape(data):
    out = bytearray()
    for b in data:
        if b < 32 or b == 127 or b == 255:
            out += bytes([35, 64 ^ b])
        elif b in (35, 126):
            out += bytes([35, b])
        else:
            out.append(b)
    return bytes(out)


def chunk_end(buf, start, limit):
    """Return the position where a chunk should end without splitting escape pairs.

    Deliberately diverges from evo-send.min.js's u() to guarantee forward progress:
    the reference commits to an escape unit once the pre-check passes and may overshoot
    the limit by up to two bytes, while this version defers a unit that would not fit.
    Safe because Kermit long packets are self-describing (they carry their own declared
    length), so chunk boundaries are free to vary.

    Invariant: returns at least start + (one full escape unit), unless buf is exhausted.
    """
    n, end = start, len(buf)
    while n < end:
        b = buf[n]
        next_n = n
        if b == 35:
            next_n = n + 2
        elif b == 126:
            next_n = n + 2
            if next_n < end and buf[next_n] == 35:
                next_n += 2
            else:
                next_n += 1
        else:
            next_n = n + 1

        if next_n - start > limit:
            # Escape unit doesn't fit, but we must advance to guarantee forward progress
            if n == start:
                # Consume the unit anyway so downstream loops don't spin forever
                n = min(next_n, end)
            break
        n = next_n

    return min(n, end)


def parse_packet(raw):
    start = 0 if raw[0] == SOH else raw.find(SOH)
    if start < 0:
        raise ValueError("geen startbyte in antwoord: %r" % raw)
    p = raw[start:]
    data = p[7:-2] if p[1] == 32 else p[4:-2]
    return chr(p[3]), bytes(data)
