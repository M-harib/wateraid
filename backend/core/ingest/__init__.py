"""Async ingest of pack docs into Units, so both tools read one corpus."""
from __future__ import annotations

import asyncio

from ..schema import DocRecord, SourceRef, Unit


def _parse_pdf(doc_id: str, version: str | None, path: str) -> list[Unit]:
    from pypdf import PdfReader

    reader = PdfReader(path)
    units: list[Unit] = []
    for i, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if not text:
            continue
        ref = SourceRef(doc_id=doc_id, version=version, page=i)
        units.append(Unit(doc_id=doc_id, index=i, ref=ref, text=text))
    return units


def _parse_xlsx(doc_id: str, version: str | None, path: str) -> list[Unit]:
    import openpyxl
    from openpyxl.utils import get_column_letter

    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    units: list[Unit] = []
    idx = 0
    try:
        for ws in wb.worksheets:
            header: list[str] | None = None
            for r, row in enumerate(ws.iter_rows(), start=1):
                values = [("" if c.value is None else str(c.value)).strip() for c in row]
                if not any(values):
                    continue
                nonempty = [v for v in values if v]
                # first multi-column row is the header; merge it into later rows
                if header is None and len(nonempty) > 1:
                    header = values
                last_col = max((j for j, v in enumerate(values) if v), default=0)
                cells = f"A{r}:{get_column_letter(last_col + 1)}{r}"
                if header and header != values:
                    pairs = [f"{h}: {v}" for h, v in zip(header, values) if v]
                    text = " | ".join(pairs) if pairs else " | ".join(nonempty)
                else:
                    text = " | ".join(nonempty)
                idx += 1
                ref = SourceRef(doc_id=doc_id, version=version, sheet=ws.title, cells=cells)
                units.append(Unit(doc_id=doc_id, index=idx, ref=ref, text=text))
    finally:
        wb.close()
    return units


def _parse_csv(doc_id: str, version: str | None, path: str) -> list[Unit]:
    import csv

    from openpyxl.utils import get_column_letter

    with open(path, newline="", encoding="utf-8-sig", errors="replace") as fh:
        rows = list(csv.reader(fh))
    units: list[Unit] = []
    header: list[str] | None = None
    idx = 0
    for r, row in enumerate(rows, start=1):
        values = [(c or "").strip() for c in row]
        if not any(values):
            continue
        nonempty = [v for v in values if v]
        if header is None and len(nonempty) > 1:
            header = values
        ncols = max((j + 1 for j, v in enumerate(values) if v), default=1)
        cells = f"A{r}:{get_column_letter(ncols)}{r}"
        if header and header != values:
            pairs = [f"{h}: {v}" for h, v in zip(header, values) if v]
            text = " | ".join(pairs) if pairs else " | ".join(nonempty)
        else:
            text = " | ".join(nonempty)
        idx += 1
        ref = SourceRef(doc_id=doc_id, version=version, sheet="CSV", cells=cells)
        units.append(Unit(doc_id=doc_id, index=idx, ref=ref, text=text))
    return units


_PARSERS = {"pdf": _parse_pdf, "excel": _parse_xlsx, "csv": _parse_csv}
_EXT_KIND = {"pdf": "pdf", "xlsx": "excel", "xls": "excel", "csv": "csv"}


def kind_from_name(filename: str) -> str | None:
    """Map a filename extension to an ingest kind, or None if unsupported."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return _EXT_KIND.get(ext)


async def units_from_file(doc_id: str, path: str, kind: str, version: str | None = None) -> list[Unit]:
    """Parse one file into Units off the event loop. Raises ValueError on bad kind."""
    parser = _PARSERS.get(kind)
    if parser is None:
        raise ValueError(f"unsupported kind: {kind}")
    return await asyncio.to_thread(parser, doc_id, version, path)


async def ingest_doc(rec: DocRecord) -> list[Unit]:
    if not (rec.present and rec.in_corpus and rec.path):
        return []
    # ponytail: thread pool suits IO-bound parsing; ProcessPoolExecutor if CPU-bound.
    if rec.kind in _PARSERS:
        return await units_from_file(rec.doc_id, rec.path, rec.kind, rec.version)
    return []


async def ingest_all(records) -> list[Unit]:
    """Ingest every in-corpus doc concurrently; flatten to one Unit list."""
    batches = await asyncio.gather(*(ingest_doc(r) for r in records))
    return [u for batch in batches for u in batch]
