"""Validate model references against supplied units before using any output."""
import hashlib
import json
import re

from core import Evidence, Unit, to_dict, verify_quote


class InvalidOutput(ValueError):
    pass


def unit_id(unit: Unit) -> str:
    ref = unit.ref
    return f"{unit.doc_id}:p{ref.page}" if ref.page else f"{unit.doc_id}:{ref.sheet}!{ref.cells}"


def text(value, name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise InvalidOutput(f"{name} must be non-empty text")
    return value.strip()


def array(value, name: str) -> list:
    if not isinstance(value, list):
        raise InvalidOutput(f"{name} must be a list")
    return value


def object_value(value, name: str) -> dict:
    if not isinstance(value, dict):
        raise InvalidOutput(f"{name} must be an object")
    return value


def parse(raw: str) -> dict:
    try:
        result = json.loads(raw, parse_constant=lambda v: (_ for _ in ()).throw(ValueError(v)))
    except (ValueError, TypeError) as exc:
        raise InvalidOutput("Response must be a finite JSON object") from exc
    return object_value(result, "response")


def cite(raw, units: dict[str, Unit], allowed: set[str] | None = None) -> Evidence:
    raw = object_value(raw, "evidence")
    supplied = text(raw.get("unit_id"), "unit_id")
    unit = units.get(supplied)
    if unit is None or (allowed is not None and unit.doc_id not in allowed):
        raise InvalidOutput(f"Evidence {supplied} is outside the allowed source set {sorted(allowed or [])}")
    quote = text(raw.get("quote"), "quote")
    if not verify_quote(quote, unit):
        matches = [candidate for candidate in units.values()
                   if (allowed is None or candidate.doc_id in allowed) and verify_quote(quote, candidate)]
        unique = {unit_id(candidate): candidate for candidate in matches}
        if len(unique) == 1:
            unit = next(iter(unique.values()))
        else:
            raise InvalidOutput(f"Quote does not appear uniquely in {unit_id(unit)} or another allowed unit: {quote!r}. Copy a shorter exact substring; do not complete a sentence across pages.")
    # The registry's ref/version is authoritative; ignore model-supplied versions/verified flags.
    return Evidence(ref=unit.ref, quote=quote, verified=True)


def cite_whole_unit(raw, units: dict[str, Unit], allowed: set[str] | None = None) -> Evidence:
    """Cite an authoritative table row by ID; the stored row supplies the quote."""
    raw = object_value(raw, "evidence")
    supplied = text(raw.get("unit_id"), "unit_id")
    unit = units.get(supplied)
    if unit is None or (allowed is not None and unit.doc_id not in allowed):
        raise InvalidOutput(f"Evidence {supplied} is outside the allowed source set {sorted(allowed or [])}")
    return Evidence(ref=unit.ref, quote=unit.text, verified=True)


def cited_percentage(evidence: Evidence) -> float:
    values = {float(v) for v in re.findall(r"(?<![\d.])(\d+(?:\.\d+)?)\s*(?:%|percent\b|per\s+cent\b)", evidence.quote, re.I)}
    if len(values) != 1 or not 0 <= next(iter(values)) <= 100:
        raise InvalidOutput("Quote must identify one unambiguous percentage")
    return values.pop()


def fingerprint(units: list[Unit], extra: object) -> str:
    value = {"units": [to_dict(u) for u in units], "context": extra}
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:24]


def context(units: list[Unit]) -> list[dict]:
    return [{"unit_id": unit_id(u), "ref": to_dict(u.ref), "text": u.text} for u in units]


def grounding_candidate_hints(units: list[Unit], limit_per_doc: int = 16) -> list[dict]:
    """Recall-oriented source spans for the model; these are candidates, never findings."""
    signals = re.compile(r"(?:\d+(?:\.\d+)?\s*%|\bpercent\b|\bsignificantly\b|\bimproved\b|"
                         r"\breduced\b|\bincreased\b|\bmore than\s+\d)", re.I)
    result, counts = [], {}
    for unit in units:
        for match in re.finditer(r"(?:^|(?<=[.!?]))\s*([^.!?]{20,500}(?:[.!?]|$))", unit.text, re.S):
            quote = match.group(1).strip()
            if not signals.search(quote) or counts.get(unit.doc_id, 0) >= limit_per_doc:
                continue
            result.append({"unit_id": unit_id(unit), "quote": quote})
            counts[unit.doc_id] = counts.get(unit.doc_id, 0) + 1
    return result
