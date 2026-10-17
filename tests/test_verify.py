"""Quote verifier: normalization, containment, and the downgrade rule."""
from __future__ import annotations

from core import Evidence, Finding, SourceRef, Status, Unit
from core.verify import normalize, quote_in_text, verify_finding


def _unit(text: str) -> Unit:
    return Unit(doc_id="x", index=1, ref=SourceRef("x", page=1), text=text)


def test_normalize_whitespace_punctuation_case_smartquotes():
    # punctuation -> space, whitespace collapsed, casefolded, smart quotes unified
    assert normalize("  The   Agreement’s\nTerms. ") == "the agreement s terms"
    assert normalize("“Co-funding” — test") == "co funding test"
    # the same underlying text normalizes identically whatever the quote style
    assert normalize("ninety-five percent (95%)") == normalize("ninety five percent 95")


def test_quote_in_text_positive_across_linebreaks():
    assert quote_in_text("last signature", "date of the\nlast  signature of")


def test_quote_in_text_negative():
    assert not quote_in_text("this never appears", "some other text entirely")


def test_empty_quote_never_matches():
    assert not quote_in_text("   ", "anything at all")


def _finding(quote: str, text: str, status=Status.confirmed) -> tuple[Finding, dict]:
    ref = SourceRef("x", page=1)
    f = Finding(id="i", stable_key="k", tool="t", topic="o", claim="c", status=status,
                evidence=[Evidence(ref=ref, quote=quote)])
    return f, {(ref.doc_id, ref.page, ref.sheet, ref.cells): _unit(text)}


def test_verified_quote_keeps_confirmed():
    f, units = _finding("hello world", "well, hello world!")
    verify_finding(f, lambda r: units.get((r.doc_id, r.page, r.sheet, r.cells)))
    assert f.evidence[0].verified and f.status == Status.confirmed


def test_unverified_quote_downgrades_confirmed_to_needs_review():
    f, units = _finding("not in the text", "completely different")
    verify_finding(f, lambda r: units.get((r.doc_id, r.page, r.sheet, r.cells)))
    assert not f.evidence[0].verified and f.status == Status.needs_review


def test_conflict_status_not_downgraded_by_unverified():
    f, units = _finding("missing", "other", status=Status.conflict)
    verify_finding(f, lambda r: units.get((r.doc_id, r.page, r.sheet, r.cells)))
    assert f.status == Status.conflict  # only `confirmed` is downgraded


def test_missing_unit_marks_unverified():
    f, _ = _finding("x", "x")
    verify_finding(f, lambda r: None)  # unit not found
    assert not f.evidence[0].verified and f.status == Status.needs_review
