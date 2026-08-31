import pathlib
import sys

import pytest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "calc"))

import fake_ti  # noqa: E402

fake_ti.install()


@pytest.fixture
def tekeningen():
    fake_ti.reset()
    return fake_ti.calls
