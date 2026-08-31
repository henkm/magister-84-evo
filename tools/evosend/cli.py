"""Command-line entry point voor evosend."""
import argparse
import sys

from .port import DEFAULT_PORT
from .send import send_python


def main(argv=None):
    ap = argparse.ArgumentParser(
        prog="evosend", description="Stuurt een Python-programma naar een TI-84 Evo-T.")
    ap.add_argument("naam", help="programmanaam op de rekenmachine (A-Z, 0-9, max 8)")
    ap.add_argument("bestand", help="pad naar het .py-bestand")
    ap.add_argument("--poort", default=DEFAULT_PORT)
    args = ap.parse_args(argv)

    with open(args.bestand, "rb") as f:
        source = f.read()

    def toon(done, total):
        print("\r  %d/%d bytes" % (done, total), end="", file=sys.stderr)

    try:
        n = send_python(args.naam, source, args.poort, toon)
    except (TimeoutError, IOError, ValueError) as e:
        print("\nmislukt: %s" % e, file=sys.stderr)
        return 1
    print("\n%s: %d bytes verstuurd" % (args.naam.upper(), n))
    return 0
