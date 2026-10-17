"""What's in the pack, referenced-but-absent, or reference-only — so the tool abstains instead of inventing."""
from __future__ import annotations

from pathlib import Path

from .schema import DocRecord

# Human-declared version labels for the pack files, keyed by doc_id (numeric prefix).
_PACK = {
    "00": ("Start Here (participant guide)", "pdf", "A6 pack"),
    "01": ("Funding call — Partnerships for Her Voice, Her Choice", "pdf", "GAC 2018 call"),
    "02": ("Preliminary proposal — Taps for Rights", "pdf", "April 2018"),
    "03": ("Contribution Agreement — Taps for Rights", "pdf", "consolidated (all amendments)"),
    "04": ("Year 3 Annual Results Report", "pdf", "dated 27 May 2022"),
    "05": ("Logic Model and PMF", "excel", "PIP version, December 2019"),
    "06": ("Budget template", "excel", "GAC-style, categories only"),
}

# Referenced by the agreement/call but NOT in the pack -> abstain with metadata.
_ABSENT = [
    DocRecord(
        "GTC", "General Terms and Conditions (Contribution Agreement)", "absent",
        version="version in force on Effective Date 2019-06-21", present=False, in_corpus=False,
        governs="M&E (Art.13), Financial Records & Audit (Art.14), Default & Remedies (Art.16), "
                "IP (Art.19), Subcontracts/Procurement (Art.10/11), Amendment (Art.3)",
        note="Incorporated by reference (03 Art.1.2); ranked above appendices (03 Art.1.3). Do not fetch.",
    ),
    DocRecord(
        "PIP", "Project Implementation Plan", "absent",
        version="December 2019", present=False, in_corpus=False,
        governs="Theory of change, gender strategy, EMP, full indicator set (e.g. 1000.2), budget by line",
        note="Due 180 days after signature (03 App.D 4.1). File 05 is its PMF only.",
    ),
    DocRecord(
        "LOCAL_PARTNERS", "Local Partners – Information form", "absent",
        present=False, in_corpus=False,
        governs="Local partner eligibility detail",
        note="Required by call (01 p.5); 'not included in this pack' (02 §C).",
    ),
    DocRecord(
        "REPORTING_FORMS", "Reporting Forms A–D", "absent",
        present=False, in_corpus=False,
        governs="Financial report form layouts (Form A/B/C/D)",
        note="Referenced in 03 App.D §3 and Art.1.3(d).",
    ),
]

# Present in assets/ but reference-only context — excluded from the compliance corpus.
_REFERENCE = {
    "ESDC-EMP5670_Print": ("ESDC EAF Small Projects grant application (blank template)", "2026"),
    "ESDC-EMP5671": ("ESDC generic Grant Application for Funding (blank template)", "2026-02-004"),
}


def doc_id_from_path(path: Path) -> str:
    """Numeric prefix ("03") when present, else the full stem."""
    head = path.stem.split("_", 1)[0]
    return head if head.isdigit() else path.stem


def build_registry(assets_dir: str | Path) -> dict[str, DocRecord]:
    assets = Path(assets_dir)
    reg: dict[str, DocRecord] = {}
    for p in sorted(assets.glob("*")):
        if p.suffix.lower() not in {".pdf", ".xlsx", ".xls"}:
            continue
        did = doc_id_from_path(p)
        if did in _PACK:
            title, kind, ver = _PACK[did]
            reg[did] = DocRecord(did, title, kind, version=ver, path=str(p))
        elif p.stem in _REFERENCE:
            title, ver = _REFERENCE[p.stem]
            reg[p.stem] = DocRecord(
                p.stem, title, "reference", version=ver, path=str(p), in_corpus=False,
                note="Reference context only (grant application structure); not a compliance source.",
            )
    for rec in _ABSENT:
        reg[rec.doc_id] = rec
    return reg
