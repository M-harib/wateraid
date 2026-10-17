"""Pack-specific expected extractions live ONLY in eval; FakeLLM is not a live quality score."""
import ast
import json
from pathlib import Path

from core import FakeLLM, Status
from core.format import locator_label
from core.verify import normalize
from tools.proposal import ProposalAssistant
from tools.proposal.evidence import unit_id
from tests.eval.scorer import load_gold, score


def pack_extraction(core, topic):
    def quote(doc, page, text):
        unit = next(u for u in core.units.by_doc(doc) if u.ref.page == page)
        return {"unit_id": unit_id(unit), "quote": text}
    if topic == "cost_share_vs_call":
        return {
            "agreement": quote("03", 2, "The Organization shall contribute a minimum of nine point five percent (9.5%), in cash and/or in kind from Canadian sources, towards the total value of the Eligible Direct Costs"),
            "call": quote("01", 5, "Cost share: The applicant provides at least 10 percent of the total eligible direct project costs over the life of the project in cash and/or in kind."),
            "context": []}
    if topic == "construction_vs_call":
        return {"rules": [{"evidence": quote("01", 5, "Global Affairs Canada will not consider projects that include new construction."), "new_construction_allowed": False}],
                "activities": [
                    {"evidence": quote("02", 2, "Where a school has no usable sanitation at all, Taps for Rights will construct a new gender-sensitive latrine block with a dedicated menstrual hygiene room and an on-site tap"), "kind": "new_construction"},
                    {"evidence": quote("04", 6, "At five replacement schools in Nimbara that had no usable toilets, the project constructed new four-stance latrine blocks with a menstrual hygiene room."), "kind": "new_construction"}], "context": []}
    return {"claims": [
        {"evidence": quote("02", 3, "Studies show that girls in our target districts miss up to 20% of school days because of menstruation."), "reason": "The study is not identified in the supplied proposal.", "support": []},
        {"evidence": quote("04", 2, "Girls' school attendance during menstruation has improved significantly in targeted schools."), "reason": "No attendance measurement supports this claim in the supplied report.", "support": []}],
        "searched_units": [unit_id(u) for doc in ["02", "04"] for u in core.units.by_doc(doc)]}


async def test_pack_quotes_math_and_shared_scorer(core):
    def respond(tier, system, user):
        payload = json.loads(user)
        result = pack_extraction(core, payload["task"])
        if payload["task"] == "unsupported_claims":
            doc = payload["reviewed_document"]
            result = {"claims": [claim for claim in result["claims"] if claim["evidence"]["unit_id"].startswith(doc + ":")],
                      "searched_units": [u["unit_id"] for u in payload["source_units"]]}
        return json.dumps(result)
    tool = ProposalAssistant(core, FakeLLM(respond))
    for gold in [g for g in load_gold() if g["id"] in {"Q5", "Q21", "Q23"}]:
        finding = await tool.finding(gold["question"])
        assert score(finding, gold) in {"correct_conflict_with_resolver", "correct_with_citation"}
        assert all(e.verified for e in finding.evidence)
        # The shared scorer doesn't enforce must_cite on conflicts. Enforce it here too.
        labels = [locator_label(e.ref) for e in finding.evidence]
        for citation in gold["must_cite"]:
            doc, location = citation.split(":", 1)
            assert any(label.startswith(doc) and location in label for label in labels)
        if gold.get("expected_computed"):
            assert finding.computed.result == gold["expected_computed"]
        for fragment in gold.get("expected_claim_fragments", []):
            assert normalize(fragment) in normalize(finding.claim)


async def test_real_reviewer_corpus_excludes_every_other_budget_sheet(core):
    tool = ProposalAssistant(core)
    units = tool._units(("02", "06"))
    reviewer = [u for u in units if u.doc_id == "06"]
    assert reviewer and all(u.ref.sheet == "GAC Review Questions" for u in reviewer)
    assert len(reviewer) == 9
    assert all("EXAMPLE ONLY" not in u.text for u in units)


def test_product_cannot_import_evaluation_or_compliance():
    for root in [Path("core"), Path("tools")]:
        for path in root.rglob("*.py"):
            tree = ast.parse(path.read_text(encoding="utf-8"))
            for node in ast.walk(tree):
                imports = [alias.name for alias in node.names] if isinstance(node, ast.Import) else [node.module or ""] if isinstance(node, ast.ImportFrom) else []
                assert not any(name.startswith(("tests", "eval")) for name in imports), path
                if "proposal" in path.parts:
                    assert not any(name.startswith("tools.compliance") for name in imports), path
