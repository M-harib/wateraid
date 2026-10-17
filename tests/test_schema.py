"""The contract serializes to JSON-ready dicts (enums -> value, dates -> ISO)."""
from __future__ import annotations

import json
from datetime import date

from core import Conflict, Evidence, Finding, Resolver, SourceRef, Status, to_dict


def test_finding_to_dict_is_json_serializable():
    f = Finding(
        id="f1", stable_key="k1", tool="compliance", topic="final report due",
        claim="The agreement is internally inconsistent on the due date.",
        status=Status.conflict,
        evidence=[Evidence(ref=SourceRef("03", page=16, section="App.D 4.12"),
                           quote="at least 60 days before the expiry", verified=True)],
        conflict=Conflict(question="When is the final report due?", resolver=Resolver.gac),
        due=date(2023, 6, 29),
    )
    d = f.to_dict()
    # enums and dates became primitives
    assert d["status"] == "conflict"
    assert d["conflict"]["resolver"] == "gac"
    assert d["due"] == "2023-06-29"
    assert d["evidence"][0]["ref"]["page"] == 16
    # and the whole thing is JSON-encodable for the API
    json.dumps(d)


def test_to_dict_handles_nested_and_primitives():
    assert to_dict([Status.confirmed, date(2022, 6, 30)]) == ["confirmed", "2022-06-30"]
    assert to_dict({"n": 1, "s": "x"}) == {"n": 1, "s": "x"}
