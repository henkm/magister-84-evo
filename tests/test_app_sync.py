from tools import sync_app


def test_kopie_in_de_extensie_is_gelijk_aan_het_origineel():
    """Herstellen met: python3 -m tools.sync_app"""
    with open(sync_app.BRON, "rb") as f:
        origineel = f.read()
    with open(sync_app.DOEL, "rb") as f:
        kopie = f.read()
    assert kopie == origineel
