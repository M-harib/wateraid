"""Synthetic inputs only: these are not answers or fixtures for the source pack."""
import asyncio
import json

import pytest

from core import Core, FakeLLM, SourceRef, Status, Unit
from core.checks.callmatch import Activity, CallRule, callmatch
from tools.proposal import ProposalAssistant
from tools.proposal.checklist import parse_row

from tools.proposal.config import CHECKLIST_CATEGORIES, TABLE, dispatch
from tools.proposal.evidence import InvalidOutput, cite_whole_unit, cited_percentage, grounding_candidate_hints, grounding_focus_units, relevant_units, top_relevant_units, unit_id
from tools.proposal.evidence import cite
from tools.proposal.quality import numeric_quality


def unit(doc, content, page=1, sheet=None, cells=None):
    return Unit(doc, page, SourceRef(doc, version="synthetic test", page=None if sheet else page, sheet=sheet, cells=cells), content)


def ev(u, quote=None):
    return {"unit_id": unit_id(u), "quote": quote or u.text}


def test_relevant_units_keeps_best_pages_from_every_requested_document():
    units = [
        unit("01", "General application instructions.", page=1),
        unit("01", "The cost-share minimum contribution is described here.", page=2),
        unit("01", "Unrelated eligibility detail.", page=3),
        unit("03", "Agreement cover page.", page=1),
        unit("03", "Applicant contribution toward eligible costs.", page=2),
        unit("03", "Unrelated reporting clause.", page=3),
    ]
    selected = relevant_units(units, "cost share contribution", per_doc=1)
    assert [unit_id(item) for item in selected] == ["01:p2", "03:p2"]


def test_relevant_units_validates_limit_and_has_stable_zero_match_fallback():
    units = [unit("01", "First page.", page=1), unit("01", "Second page.", page=2)]
    assert [unit_id(item) for item in relevant_units(units, "no matching vocabulary", per_doc=1)] == ["01:p1"]
    with pytest.raises(ValueError, match="positive integer"):
        relevant_units(units, "anything", per_doc=0)


def test_relevant_units_accepts_document_specific_limits():
    units = [unit("01", "construction", page=1), unit("01", "construction", page=2),
             unit("04", "construction", page=1), unit("04", "construction", page=2)]
    selected = relevant_units(units, "construction", per_doc={"01": 1, "04": 2})
    assert [unit_id(item) for item in selected] == ["01:p1", "04:p1", "04:p2"]


def test_top_relevant_units_ranks_across_documents():
    units = [unit("01", "General eligibility guidance."),
             unit("02", "The delivery location is North District."),
             unit("03", "General agreement terms.")]
    selected = top_relevant_units(units, "Where is the delivery location?", limit=1)
    assert [unit_id(item) for item in selected] == ["02:p1"]


def test_grounding_focus_prefers_substantiation_signals_without_pack_answers():
    units = [unit("02", "Reach increased by 12%.", page=1),
             unit("02", "Studies show attendance improved significantly by 8%.", page=2),
             unit("04", "A neutral report section.", page=1)]
    selected = grounding_focus_units(units)
    assert [unit_id(item) for item in selected] == ["02:p2"]


async def assistant(units, response):
    core = Core("nonexistent-test-assets")
    await core.units.load(units)
    return ProposalAssistant(core, FakeLLM(response if callable(response) else json.dumps(response)))


@pytest.mark.parametrize("activity,expected", [
    (Activity("new_construction", "Build a new clinic"), "not_met"),
    (Activity("refurbishment", "Repair an existing clinic", 12), "met"),
    (Activity("refurbishment", "Extend a clinic", 31), "not_met"),
    (Activity("refurbishment", "Unknown footprint"), "unclear"),
    (Activity("unknown", "Unclassified"), "unclear"),
])
def test_callmatch(activity, expected):
    result = callmatch(CallRule(False, 18), activity)
    assert result.result["status"] == expected
    assert result.inputs["activity"]["description"] == activity.description


@pytest.mark.parametrize("value", [-1, float("nan"), float("inf"), True])
def test_callmatch_rejects_bad_numbers(value):
    with pytest.raises(ValueError):
        callmatch(CallRule(False, value), Activity("refurbishment", "Repair"))


@pytest.mark.parametrize("status", ["met", "not_met", "unclear", "not_addressed"])
def test_checklist_status_and_evidence(status):
    call, proposal = unit("01", "Applicants must describe local delivery."), unit("02", "Section C: delivery through a local office.")
    raw = {"category": "local_partners", "requirement": "Describe delivery", "call": ev(call),
           "proposal": [] if status == "not_addressed" else [ev(proposal)], "status": status,
           "reason": "Not addressed in searched proposal." if status == "not_addressed" else "Synthetic comparison for review.",
           "searched_units": [unit_id(proposal)]}
    row = parse_row(raw, row_id="test", units={unit_id(u): u for u in [call, proposal]}, absent_ids=set())
    assert row.status == status
    assert {e.ref.doc_id for e in row.evidence} == ({"01"} if status == "not_addressed" else {"01", "02"})
    assert all(e.verified for e in row.evidence)


def raw_row(call_unit, proposal_unit, **changes):
    return {"category": "eligibility", "requirement": "Legal status", "call": ev(call_unit),
            "proposal": [ev(proposal_unit)], "status": "met", "reason": "Applicant states its status.",
            "searched_units": [unit_id(proposal_unit)], **changes}


@pytest.mark.parametrize("change", [{"status": "invented"},
    {"searched_units": ["02:p999"]}, {"status": "not_addressed"}, {"absent_sources": ["FAKE"]},
    {"call": {"unit_id": "01:p1", "quote": "Invented evidence"}}])
def test_checklist_rejects_unsupported_verdicts(change):
    a, b = unit("01", "Applicants must be incorporated."), unit("02", "We are incorporated.")
    with pytest.raises(InvalidOutput):
        parse_row(raw_row(a, b, **change), row_id="test", units={unit_id(u): u for u in [a, b]}, absent_ids=set())


def test_absent_form_cannot_be_met():
    a, b = unit("01", "Include the partner form."), unit("02", "Partners named; form not included.")
    row = parse_row(raw_row(a, b, absent_sources=["LOCAL_PARTNERS"]), row_id="test",
                    units={unit_id(u): u for u in [a, b]}, absent_ids={"LOCAL_PARTNERS"})
    assert row.status == "unclear" and "not in the documents" in row.reason.lower()


def test_bad_proposal_quote_downgrades_instead_of_erasing_checklist():
    call, proposal = unit("01", "Applicants must explain delivery."), unit("02", "Section C explains delivery.")
    raw = raw_row(call, proposal, proposal=[ev(proposal, "Section C ... delivery")])
    row = parse_row(raw, row_id="test", units={unit_id(u): u for u in [call, proposal]}, absent_ids=set())
    assert row.status == "unclear" and {e.ref.doc_id for e in row.evidence} == {"01"}


def test_checklist_records_all_supplied_proposal_units_as_search_scope():
    call = unit("01", "Applicants must explain delivery.")
    first = unit("02", "Section A: delivery model.", page=1)
    second = unit("02", "Section B: other details.", page=2)
    raw = raw_row(call, first, status="unclear", searched_units=[unit_id(first)])
    row = parse_row(raw, row_id="test", units={unit_id(u): u for u in [call, first, second]}, absent_ids=set())
    assert row.searched == [unit_id(first), unit_id(second)]


async def test_cost_share_conflict_and_resolver_use_code():
    a, b = unit("03", "The applicant contributes at least 7% of eligible direct costs."), unit("01", "Applicants must contribute at least 12 percent of eligible direct costs.")
    tool = await assistant([a, b], {"agreement": ev(a), "call": ev(b)})
    finding = await tool.finding("Does the minimum contribution meet the cost-share requirement?")
    assert finding.status == Status.conflict and finding.conflict.resolver.value == "gac"
    assert finding.computed.result == {"meets_call": False, "gap": 5.0}
    assert {e.ref.doc_id for e in finding.evidence} == {"01", "03"}
    assert all(e.verified for e in finding.evidence)


async def test_cost_share_pass_is_not_forced_conflict():
    a, b = unit("03", "Applicant minimum is 16%."), unit("01", "Applicant minimum is 12%.")
    tool = await assistant([a, b], {"agreement": ev(a), "call": ev(b)})
    result = await tool.finding("cost share")
    assert result.status == Status.confirmed and result.conflict is None


async def test_construction_comparison_preserves_both_sources():
    rule, proposal = unit("01", "New construction is prohibited."), unit("02", "Section E: We will build a new clinic.")
    units = [rule, proposal, unit("03", "Construction costs are described."), unit("04", "A new clinic was built.")]
    response = {"rules": [{"evidence": ev(rule), "new_construction_allowed": False}],
                "activities": [{"evidence": ev(proposal), "kind": "new_construction"}], "context": []}
    result = await (await assistant(units, response)).finding("Does the construction conflict with the call?")
    assert result.status == Status.conflict
    assert result.conflict.resolver.value == "gac"
    assert result.computed.result["comparisons"][0]["conflict"]


async def test_uncited_claim_flag_is_not_falsehood_verdict():
    proposal, report = unit("02", "Students miss 17% of lessons. No study supplied."), unit("04", "Attendance improved markedly. No measurement supplied.")
    def response(tier, system, user):
        payload = json.loads(user)
        current = proposal if payload["reviewed_document"] == "02" else report
        return json.dumps({"claims": [{"evidence": ev(current), "reason": "No supporting study or measurement identified.", "support": []}],
                           "searched_units": [unit_id(current)]})
    result = await (await assistant([proposal, report], response)).finding("unsupported claims")
    assert result.status == Status.needs_review
    assert len(result.computed.result["claims"]) == 2
    assert "not proof" in result.claim and result.searched == ["02", "04"]
    assert all(e.verified for e in result.evidence)


async def test_partial_search_cannot_assert_unsupported():
    a, b = unit("02", "A claim."), unit("04", "A report.")
    def response(tier, system, user):
        payload = json.loads(user)
        current = a if payload["reviewed_document"] == "02" else b
        return json.dumps({"claims": [{"evidence": ev(current), "reason": "No proof", "support": []}],
                           "searched_units": [] if current is a else [unit_id(current)]})
    result = await (await assistant([a, b], response)).finding("unsupported claims")
    assert result.status == Status.needs_review and result.computed.result["error"]
    assert not result.evidence


async def test_grounding_requires_candidates_from_both_documents():
    a, b = unit("02", "Results increased by 22% without a source."), unit("04", "Performance improved significantly without a measure.")
    def response(tier, system, user):
        payload = json.loads(user)
        if payload["reviewed_document"] == "02":
            return json.dumps({"claims": [{"evidence": ev(a), "reason": "No source", "support": []}], "searched_units": [unit_id(a)]})
        return json.dumps({"claims": [], "searched_units": [unit_id(b)]})
    result = await (await assistant([a, b], response)).finding("unsupported claims")
    assert result.status == Status.needs_review and result.computed.result["error"]
    assert not result.evidence


async def test_grounding_batches_large_documents_without_skipping_units():
    units = [unit(doc, f"Claim improved without a measure {page}. " + "context " * 1700, page=page)
             for doc in ("02", "04") for page in (1, 2, 3)]
    calls = []

    def response(tier, system, user):
        payload = json.loads(user)
        supplied = payload["source_units"]
        calls.append(supplied)
        first = supplied[0]
        return json.dumps({
            "claims": [{"evidence": {"unit_id": first["unit_id"], "quote": "Claim improved without a measure"},
                        "reason": "No measurement identified.", "support": []}],
            "searched_units": [item["unit_id"] for item in supplied],
        })

    result = await (await assistant(units, response)).finding("unsupported claims")
    assert result.status == Status.needs_review
    assert len(calls) == 6
    assert {item["unit_id"] for call in calls for item in call} == {unit_id(item) for item in units}


async def test_bad_quotes_are_not_cached_as_answers_and_can_recover():
    a, b = unit("03", "Applicant minimum is 8%."), unit("01", "Applicant minimum is 13%.")
    tool = await assistant([a, b], {"agreement": ev(a, "Invented minimum 6%."), "call": ev(b)})
    bad = await tool.finding("cost share")
    assert bad.status == Status.needs_review and bad.computed.result["error"]
    tool.llm = FakeLLM(json.dumps({"agreement": ev(a), "call": ev(b)}))
    good = await tool.finding("cost share")
    assert good.status == Status.conflict


async def test_success_cached_concurrent_requests_and_changed_question():
    a, b = unit("03", "Applicant minimum is 8%."), unit("01", "Applicant minimum is 13%.")
    calls = []
    def responder(tier, system, user):
        calls.append(json.loads(user)["question"])
        return json.dumps({"agreement": ev(a), "call": ev(b)})
    tool = await assistant([a, b], responder)
    await asyncio.gather(tool.ask("cost share"), tool.ask("cost share"))
    assert len(calls) == 1
    await tool.ask("Explain whether the cost share meets the call requirement")
    assert len(calls) == 2
    a.text = "Revised: Applicant minimum is 8%."
    await tool.ask("cost share")
    assert len(calls) == 3


async def test_known_absent_form_abstains_without_model():
    tool = await assistant([], lambda *_: pytest.fail("Must not call a model for an absent form"))
    result = await tool.ask("Is the Local Partners form complete?")
    assert result["status"] == "not_found" and not result["evidence"]
    assert result["computed"]["result"]["absent_sources"][0]["doc_id"] == "LOCAL_PARTNERS"


async def test_generic_question_answers_from_verified_selected_sources():
    call = unit("01", "Applications must operate in the eligible country.")
    proposal = unit("02", "The project will operate in North District.")

    def response(tier, system, user):
        payload = json.loads(user)
        assert payload["task"] == "generic_qa"
        assert {item["ref"]["doc_id"] for item in payload["source_units"]} == {"02"}
        return json.dumps({"answer_status": "answered", "answer": "The project will operate in North District.",
                           "evidence": [ev(proposal)]})

    tool = await assistant([call, proposal], response)
    result = await tool.finding("Where will the project operate?", ["02"])
    assert result.status == Status.confirmed
    assert result.evidence[0].verified and result.evidence[0].ref.doc_id == "02"


async def test_chat_sample_uses_generic_extraction_with_code_checked_comparison():
    agreement = unit("03", "The applicant contributes at least 7% of eligible direct costs.")
    call = unit("01", "Applicants contribute at least 12% of eligible direct costs.")

    def response(tier, system, user):
        payload = json.loads(user)
        assert payload["task"] == "generic_qa"
        return json.dumps({
            "answer_status": "needs_review",
            "answer": "The sources state different minimum contribution percentages.",
            "evidence": [ev(agreement), ev(call)],
            "comparison": {"kind": "cost_share", "agreement": ev(agreement), "call": ev(call)},
        })

    result = await (await assistant([agreement, call], response)).chat_finding(
        "Please compare the applicant contribution requirements.", ["01", "03"])
    assert result.topic == "generic_qa" and result.status == Status.conflict
    assert result.computed.result["gap"] == 5
    assert result.conflict.resolver.value == "gac"
    assert all(item.verified for item in result.evidence)


async def test_generic_question_abstains_without_claiming_full_document_absence():
    proposal = unit("02", "Section A describes the applicant.")
    tool = await assistant([proposal], {"not_found": "The retrieved page does not support an answer.", "evidence": []})
    result = await tool.finding("Who approves travel?", ["02"])
    assert result.status == Status.not_found and result.searched == ["02"]
    assert "retrieved source pages" in result.claim.lower()


async def test_specialized_question_respects_narrower_selected_scope():
    proposal = unit("02", "The proposal describes a contribution.")

    def response(tier, system, user):
        payload = json.loads(user)
        assert payload["task"] == "generic_qa"
        return json.dumps({"answer_status": "answered", "answer": "A contribution is described.",
                           "evidence": [ev(proposal)]})

    result = await (await assistant([proposal], response)).finding("Does the cost share meet the call?", ["02"])
    assert result.topic == "generic_qa" and result.status == Status.confirmed


async def test_no_model_returns_honest_unavailable_state():
    tool = ProposalAssistant(Core("nonexistent-test-assets"))
    result = await tool.startup()
    assert result["checklist"] == [] and result["reviewer_questions"] == []
    assert all(f["status"] == "needs_review" for f in result["findings"])


def test_pmf_checks_ignore_age_numbers_and_keep_raw_values():
    row = unit("05", "Code: X.1 | Indicator: % reporting confidence | Baseline: Ages 10-14: 72%; Ages 15-19: 61% | Target: 45%", sheet="PMF", cells="A9:F9")
    missing = unit("05", "Code: X.2 | Indicator: Number of suppliers | Baseline: 0 | Target: To be determined", sheet="PMF", cells="A10:F10")
    checks, evidence = numeric_quality([row, missing])
    assert [c["inputs"]["baseline"] for c in checks[0]["checks"]] == [72, 61]
    assert checks[0]["flagged"] and checks[1]["checks"][0]["result"]["target_missing"]
    assert len(evidence) == 2


async def test_checklist_is_shared_store_view_and_absent_guard():
    call = unit("01", "Applicant must include Local Partners Information form and describe its proposed project.")
    proposal = unit("02", "Section C: Partners named. Form absent.")
    rows = [raw_row(call, proposal, category=category) for category in CHECKLIST_CATEGORIES]
    tool = await assistant([call, proposal], {"rows": rows})
    result = await tool.checklist()
    assert len(result) == len(CHECKLIST_CATEGORIES)
    assert all(row["status"] == "unclear" and row["absent_sources"] == ["LOCAL_PARTNERS"] for row in result)
    assert any(f.topic == "checklist" for f in tool.core.findings.all())


async def test_reviewer_mapping_includes_unaddressed_and_excludes_budget_examples():
    proposal = unit("02", "Section D: Project training.")
    question = unit("06", "Budget category: Training | Typical question from GAC: Explain training costs.", sheet="GAC Review Questions", cells="A8:C8")
    example = unit("06", "EXAMPLE ONLY: 999 dollars", sheet="Budget Detail", cells="A6:C6")
    def response(tier, system, user):
        payload = json.loads(user)
        assert all("999" not in u["text"] for u in payload["source_units"])
        return json.dumps({"mappings": [{"review_unit_id": unit_id(question), "proposal": [ev(proposal)], "reason": "Training section is relevant; no prices given."}]})
    result = await (await assistant([proposal, question, example], response)).reviewer_questions()
    assert len(result) == 1 and result[0]["proposal"][0]["ref"]["doc_id"] == "02"


def test_dispatch_has_expected_sources_and_tiers():
    assert dispatch("minimum contribution").name == "cost_share_vs_call"
    assert TABLE["construction_vs_call"].docs == ("01", "02", "03", "04")
    assert TABLE["unsupported_claims"].tier == "strong"
    assert TABLE["logic_model_quality"].tier == "mini"
    assert TABLE["generic_qa"].docs == ("01", "02", "05", "06")
    assert dispatch("Who manages project delivery?").name == "generic_qa"
    assert dispatch("What construction activities are proposed?").name == "generic_qa"
    assert dispatch("What is the indicator baseline?").name == "generic_qa"
    assert dispatch("What cost share does the proposal offer?").name == "generic_qa"
    assert dispatch("What claims does the proposal make?").name == "generic_qa"


def test_exact_quote_with_wrong_page_is_relocated_uniquely():
    wrong = unit("04", "Different text.", page=1)
    right = unit("04", "The measured outcome improved significantly.", page=2)
    evidence = cite({"unit_id": unit_id(wrong), "quote": right.text},
                    {unit_id(u): u for u in [wrong, right]}, {"04"})
    assert evidence.ref.page == 2 and evidence.verified


def test_quote_relocation_rejects_ambiguous_matches():
    wrong = unit("04", "Different text.", page=1)
    a = unit("04", "Repeated claim.", page=2)
    b = unit("04", "Repeated claim.", page=3)
    with pytest.raises(InvalidOutput):
        cite({"unit_id": unit_id(wrong), "quote": "Repeated claim."},
             {unit_id(u): u for u in [wrong, a, b]}, {"04"})


def test_grounding_hints_are_source_spans_not_findings():
    a = unit("02", "Attendance improved significantly. Another neutral sentence.")
    b = unit("04", "Reach increased by 19% without a cited measure.")
    hints = grounding_candidate_hints([a, b])
    assert {hint["unit_id"] for hint in hints} == {unit_id(a), unit_id(b)}
    assert all(any(hint["quote"] in source.text for source in [a, b]) for hint in hints)


def test_table_row_citation_uses_authoritative_stored_text():
    row = unit("05", "Code: X.1 | Indicator: full stored row | Baseline: 7 | Target: 9", sheet="PMF", cells="A6:F6")
    evidence = cite_whole_unit({"unit_id": unit_id(row), "quote": "model summary with omissions"},
                               {unit_id(row): row}, {"05"})
    assert evidence.quote == row.text and evidence.verified


async def test_source_outside_intent_cannot_be_cited():
    a, b, c = unit("03", "Minimum 7%."), unit("01", "Minimum 12%."), unit("02", "Minimum 9%.")
    tool = await assistant([a, b, c], {"agreement": ev(c), "call": ev(b)})
    result = await tool.finding("cost share")
    assert result.status == Status.needs_review and not result.evidence


@pytest.mark.parametrize("raw", ["not json", "[]", '{"value": NaN}'])
async def test_invalid_model_json_is_reviewable(raw):
    a, b = unit("03", "Minimum 7%."), unit("01", "Minimum 12%.")
    tool = await assistant([a, b], lambda *_: raw)
    result = await tool.finding("cost share")
    assert result.status == Status.needs_review and result.computed.result["error"]


def test_checklist_code_overrides_model_cost_share_status():
    call, proposal = unit("01", "Applicants contribute at least 14%."), unit("02", "Our contribution is 11%.")
    raw = raw_row(call, proposal, category="cost_share", status="met",
                  comparison={"kind": "cost_share", "proposal": ev(proposal), "call": ev(call)})
    row = parse_row(raw, row_id="test", units={unit_id(u): u for u in [call, proposal]}, absent_ids=set())
    assert row.status == "not_met" and row.computed.result["gap"] == 3


def test_checklist_duration_uses_dates_not_model_arithmetic():
    call = unit("01", "The project lasts at least one year and no more than four years.")
    proposal = unit("02", "Start 2024-02-29. End 2025-02-27.")
    raw = raw_row(call, proposal, category="duration", status="not_met", comparison={
        "kind": "duration", "rule": ev(call), "start": ev(proposal, "Start 2024-02-29"),
        "end": ev(proposal, "End 2025-02-27")})
    row = parse_row(raw, row_id="test", units={unit_id(u): u for u in [call, proposal]}, absent_ids=set())
    assert row.status == "met" and row.computed.result["duration_days"] == 365


async def test_model_transport_error_does_not_leak_details():
    class BrokenModel:
        async def complete(self, **kwargs):
            raise OSError("sensitive provider detail")
    a, b = unit("03", "Minimum 7%."), unit("01", "Minimum 12%.")
    tool = await assistant([a, b], {})
    tool.llm = BrokenModel()
    result = await tool.ask("cost share")
    assert "sensitive provider detail" not in json.dumps(result)
    assert result["status"] == "needs_review"


async def test_validation_repair_uses_actual_reason():
    a, b = unit("03", "Minimum 7%."), unit("01", "Minimum 12%.")
    calls = []
    def response(tier, system, user):
        data = json.loads(user)
        calls.append(data)
        if len(calls) == 1:
            return "{malformed"
        assert "JSON" in data["repair"]
        return json.dumps({"agreement": ev(a), "call": ev(b)})
    result = await (await assistant([a, b], response)).finding("cost share")
    assert result.status == Status.conflict and len(calls) == 2
