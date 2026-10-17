"""FE-facing display helpers."""
from __future__ import annotations

from .schema import SourceRef


def locator_label(ref: SourceRef) -> str:
    """Human-readable citation label, e.g. "03 · App.D 4.12 · p.16" or "05 · PMF · A5:L5"."""
    parts: list[str] = [ref.doc_id]
    if ref.section:
        parts.append(ref.section)
    if ref.sheet:
        parts.append(ref.sheet)
    if ref.cells:
        parts.append(ref.cells)
    if ref.page is not None:
        parts.append(f"p.{ref.page}")
    return " · ".join(parts)
