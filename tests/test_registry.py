"""Registry: pack docs, known-absent sources, reference-only forms, doc_id rule."""
from __future__ import annotations

from pathlib import Path

from core.registry import build_registry, doc_id_from_path


def test_doc_id_numeric_prefix_else_stem():
    assert doc_id_from_path(Path("03_Contribution_Agreement.pdf")) == "03"
    assert doc_id_from_path(Path("ESDC-EMP5671.pdf")) == "ESDC-EMP5671"


def test_pack_files_present_and_in_corpus():
    reg = build_registry("assets")
    for did in ("00", "01", "02", "03", "04", "05", "06"):
        rec = reg[did]
        assert rec.present and rec.in_corpus
        assert rec.version, f"{did} missing a declared version"
    assert reg["05"].kind == "excel"
    assert reg["03"].kind == "pdf"


def test_esdc_forms_are_reference_only():
    reg = build_registry("assets")
    forms = [r for r in reg.values() if r.kind == "reference"]
    assert forms, "ESDC reference forms not registered"
    for r in forms:
        assert r.present and not r.in_corpus  # exists but excluded from the corpus


def test_absent_sources_registered():
    reg = build_registry("assets")
    for did in ("GTC", "PIP", "LOCAL_PARTNERS", "REPORTING_FORMS"):
        assert did in reg
        assert not reg[did].present and not reg[did].in_corpus
    assert "2019-06-21" in reg["GTC"].version  # pinnable metadata for Q12
