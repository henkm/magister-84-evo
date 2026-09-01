"""Kopieert calc/MAGISTER.py naar de extensie.

De extensie stuurt bij elke sync de app mee. Ze leest die uit haar eigen
pakket, dus er moet een kopie in extension/calc/ staan. Dit script maakt die
kopie; tests/test_app_sync.py bewaakt dat hij niet achterloopt.

Draaien: python3 -m tools.sync_app
"""
import os
import shutil

WORTEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRON = os.path.join(WORTEL, "calc", "MAGISTER.py")
DOEL = os.path.join(WORTEL, "extension", "calc", "MAGISTER.py")


def sync():
    os.makedirs(os.path.dirname(DOEL), exist_ok=True)
    shutil.copyfile(BRON, DOEL)
    return DOEL


if __name__ == "__main__":
    print("gekopieerd naar: " + sync())
