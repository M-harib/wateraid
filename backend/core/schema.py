"""The data contract shared by ingest, tools, and the API/FE — keep changes additive."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field, is_dataclass
from datetime import date
from enum import Enum


class Status(str, Enum):
    confirmed = "confirmed"
    conflict = "conflict"
    not_found = "not_found"
    needs_review = "needs_review"


class Resolver(str, Enum):
    water_care = "water_care_staff"
    gac = "gac"


@dataclass(frozen=True)
class SourceRef:
    """Where a quote lives. PDF -> page; Excel -> sheet + cells; radar -> url."""
    doc_id: str
    version: str | None = None
    page: int | None = None          # PDF: 1-based physical page
    sheet: str | None = None         # Excel
    cells: str | None = None         # Excel: e.g. "A5:L5"
    section: str | None = None       # human/section label if known
    url: str | None = None           # radar only
    retrieved_at: str | None = None  # radar only, ISO date


@dataclass
class Evidence:
    ref: SourceRef
    quote: str
    verified: bool = False           # set only by the quote verifier


@dataclass
class Conflict:
    question: str
    resolver: Resolver
    precedence_note: str | None = None  # context only; never closes the conflict


@dataclass
class Computed:
    """Result of code-side math, kept beside the claim so it's auditable."""
    inputs: dict
    result: object


@dataclass
class Finding:
    id: str
    stable_key: str                  # topic + evidence locations; survives reruns
    tool: str                        # "compliance" | "proposal" | ...
    topic: str
    claim: str
    status: Status
    evidence: list[Evidence] = field(default_factory=list)
    conflict: Conflict | None = None
    computed: Computed | None = None
    urgency: int | None = None       # rule-based score; higher = more urgent
    due: date | None = None
    searched: list[str] = field(default_factory=list)  # doc_ids searched, for not_found

    def to_dict(self) -> dict:
        return to_dict(self)


@dataclass
class Obligation:
    id: str
    category: str
    description: str
    rule: str                        # verbatim rule text
    anchor: str                      # what the deadline counts from
    offset_days: int | None = None
    due: date | None = None          # computed in code, never by the model
    recurring: bool = False
    evidence: list[Evidence] = field(default_factory=list)


# --- ingest output -------------------------------------------------------------

@dataclass
class Unit:
    """One retrievable chunk: a PDF page or an Excel row, with its locator."""
    doc_id: str
    index: int                       # ordinal within the doc
    ref: SourceRef
    text: str


# --- registry ------------------------------------------------------------------

@dataclass
class DocRecord:
    doc_id: str
    title: str
    kind: str                        # "pdf" | "excel" | "reference" | "absent"
    version: str | None = None       # human-declared; the model never guesses
    path: str | None = None
    present: bool = True             # False = referenced but not in the pack
    in_corpus: bool = True           # False = exists but excluded from ingest
    governs: str | None = None       # what an absent doc governs
    note: str | None = None


# --- serialization -------------------------------------------------------------

def to_dict(obj):
    """JSON-ready: dataclass -> dict, Enum -> value, date -> ISO, recursive."""
    if is_dataclass(obj) and not isinstance(obj, type):
        return {k: to_dict(v) for k, v in asdict(obj).items()}
    if isinstance(obj, Enum):
        return obj.value
    if isinstance(obj, date):
        return obj.isoformat()
    if isinstance(obj, (list, tuple)):
        return [to_dict(v) for v in obj]
    if isinstance(obj, dict):
        return {k: to_dict(v) for k, v in obj.items()}
    return obj
