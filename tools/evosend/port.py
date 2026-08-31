"""Seriële poortlaag voor de TI-84 Evo."""
import os
import select
import termios
import time

from . import kermit

DEFAULT_PORT = "/dev/cu.usbmodemRTX_DUMMY1"


class SerialPort:
    def __init__(self, path=DEFAULT_PORT):
        self.fd = os.open(path, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
        iflag, oflag, cflag, lflag, ispeed, ospeed, cc = termios.tcgetattr(self.fd)
        cc = list(cc)
        cc[termios.VMIN] = 0
        cc[termios.VTIME] = 0
        termios.tcsetattr(self.fd, termios.TCSANOW, [
            0, 0, termios.CS8 | termios.CREAD | termios.CLOCAL, 0,
            ispeed, ospeed, cc])
        termios.tcflush(self.fd, termios.TCIOFLUSH)
        self._buf = bytearray()

    def write(self, data, timeout=10.0):
        deadline = time.time() + timeout
        while data:
            try:
                n = os.write(self.fd, data)
            except BlockingIOError:
                rest = deadline - time.time()
                if rest <= 0:
                    raise TimeoutError(
                        "de rekenmachine leest de poort niet leeg; "
                        "staat hij aan en op het beginscherm?")
                select.select([], [self.fd], [], rest)
                continue
            data = data[n:]

    def _read_byte(self, deadline):
        while not self._buf:
            rest = deadline - time.time()
            if rest <= 0:
                raise TimeoutError("geen antwoord van de rekenmachine")
            r, _, _ = select.select([self.fd], [], [], rest)
            if r:
                chunk = os.read(self.fd, 4096)
                if chunk:
                    self._buf += chunk
        return self._buf.pop(0)

    def read_packet(self, timeout=8.0):
        deadline = time.time() + timeout
        acc = bytearray()
        while True:
            b = self._read_byte(deadline)
            acc.append(b)
            if b == kermit.CR:
                return kermit.parse_packet(bytes(acc))

    def expect_ack(self, timeout=8.0):
        typ, data = self.read_packet(timeout)
        if typ == "E":
            raise IOError("rekenmachine meldt een fout: %s"
                          % data.decode("latin1"))
        if typ != "Y":
            raise IOError("verwachtte ACK (Y), kreeg %r" % typ)

    def close(self):
        os.close(self.fd)
