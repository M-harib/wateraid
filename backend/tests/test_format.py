"""Citation labels for the FE."""
from __future__ import annotations

from core import SourceRef, locator_label


def test_pdf_label():
    assert locator_label(SourceRef("03", section="App.D 4.12", page=16)) == "03 · App.D 4.12 · p.16"


def test_excel_label():
    assert locator_label(SourceRef("05", sheet="PMF", cells="A5:L5")) == "05 · PMF · A5:L5"


def test_minimal_label():
    assert locator_label(SourceRef("04")) == "04"
