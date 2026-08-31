"""Transfervolgorde: bouwt een payload en stuurt hem via Kermit-framing."""
from . import kermit, payload
from .port import DEFAULT_PORT, SerialPort

CHUNK = 2000


def send_python(name, source, port_path=DEFAULT_PORT, on_progress=None):
    name = payload.validate_name(name)
    if isinstance(source, str):
        source = source.encode()
    blob = payload.build_payload(name, source)
    escaped = kermit.escape(blob)
    url = payload.transfer_url(name)

    port = SerialPort(port_path)
    try:
        port.write(kermit.encode_packet(0, "S")); port.expect_ack()
        port.write(kermit.encode_packet(1, "F", url.encode())); port.expect_ack()
        size = str(len(blob))
        attrs = (b'""B81' + bytes([(len(size) + 32) & 255])
                 + size.encode() + b"@ ")
        port.write(kermit.encode_packet(2, "A", attrs)); port.expect_ack()

        seq, pos, total = 3, 0, len(escaped)
        while pos < total:
            end = kermit.chunk_end(escaped, pos, CHUNK)
            port.write(kermit.encode_packet(seq % 64, "D", escaped[pos:end]))
            port.expect_ack(15.0)
            seq += 1
            pos = end
            if on_progress:
                on_progress(pos, total)
        port.write(kermit.encode_packet(seq % 64, "Z")); port.expect_ack()
        port.write(kermit.encode_packet((seq + 1) % 64, "B")); port.expect_ack()
        return len(blob)
    finally:
        port.close()
