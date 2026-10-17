"""Async proposal views over Core's units, verifier, pipeline and finding store."""
from __future__ import annotations

import asyncio
import json
from dataclasses import asdict
from urllib.error import HTTPError

from core import Core, Computed, Conflict, Finding, LLM, Resolver, Status, Unit, run, to_dict
from core.checks import check_cost_share, score_urgency
from core.checks.callmatch import Activity, CallRule, callmatch

from .checklist import parse_row
from .config import AS_OF, CHECKLIST_CATEGORIES, CONTEXT_UNITS_PER_DOC, STARTUP_QUESTIONS, dispatch
from .evidence import InvalidOutput, array, cite, cite_whole_unit, cited_percentage, context, fingerprint, grounding_candidate_hints, object_value, parse, relevant_units, text, unit_id
from .prompts import SYSTEM, TASKS
from .quality import numeric_quality

PROMPT_VERSION = "proposal-v4"
GROUNDING_CONTEXT_CHARS = 12_000


class ProposalAssistant:
    def __init__(self, core: Core, llm: LLM | None = None) -> None:
        self.core, self.llm = core, llm
        self._locks: dict[str, asyncio.Lock] = {}
        # Some provider plans rate-limit simultaneous long-context completions. Serializing
        # the two document-specific grounding calls is slower but materially more reliable.
        self._requests = asyncio.Semaphore(1)

    def _units(self, docs: tuple[str, ...]) -> list[Unit]:
        # File 06 contributes reviewer questions only: exclude formulas, budget examples and values.
        return [unit for doc in docs for unit in self.core.units.by_doc(doc)
                if doc != "06" or (unit.ref.sheet == "GAC Review Questions"
                                   and "Typical question from GAC:" in unit.text
                                   and "EXAMPLE ONLY" not in unit.text.upper())]

    def _key(self, topic: str, units: list[Unit], question: str) -> str:
        absent = [asdict(doc) for doc in self.core.absent()]
        models = getattr(self.llm, "models", None)
        digest = fingerprint(units, [PROMPT_VERSION, SYSTEM, TASKS, question, AS_OF.isoformat(), absent, models])
        return f"proposal:{topic}:{digest}"

    def _finding(self, key: str, topic: str, claim: str, status: Status, **kwargs) -> Finding:
        return Finding(id=key, stable_key=key, tool="proposal", topic=topic, claim=claim, status=status, **kwargs)

    async def _model(self, topic: str, question: str, units: list[Unit], tier: str, repair: str | None, extra=None) -> dict:
        if self.llm is None:
            raise RuntimeError("No model configured")
        groups = [units]
        if topic == "unsupported_claims":
            # Independent, bounded passes make the whole-corpus search obligation explicit
            # without exceeding provider prompt limits. Code verifies that every supplied
            # unit was reported as searched before accepting the combined judgment.
            groups = []
            for doc in sorted({unit.doc_id for unit in units}):
                batch: list[Unit] = []
                size = 0
                for unit in (item for item in units if item.doc_id == doc):
                    if batch and size + len(unit.text) > GROUNDING_CONTEXT_CHARS:
                        groups.append(batch)
                        batch, size = [], 0
                    batch.append(unit)
                    size += len(unit.text)
                if batch:
                    groups.append(batch)

        async def complete(group: list[Unit]) -> dict:
            group_extra = extra
            if topic == "unsupported_claims" and isinstance(extra, dict):
                ids = {unit_id(unit) for unit in group}
                group_extra = {**extra, "candidate_hints": [hint for hint in extra.get("candidate_hints", [])
                                                             if hint.get("unit_id") in ids]}
            payload = {"task": topic, "instructions": TASKS[topic], "question": question,
                       "as_of": AS_OF.isoformat(), "source_units": context(group),
                       "reviewed_document": group[0].doc_id if group else None,
                       "absent_sources": [to_dict(doc) for doc in self.core.absent()],
                       "repair": repair, "extra": group_extra}
            async with self._requests:
                response = await asyncio.wait_for(self.llm.complete(tier=tier, system=SYSTEM,
                    user=json.dumps(payload, ensure_ascii=False), json_mode=True), timeout=90)
            return parse(response)

        results = await asyncio.gather(*(complete(group) for group in groups))
        if topic == "unsupported_claims":
            return {"claims": [claim for result in results for claim in array(result.get("claims"), "claims")],
                    "searched_units": [uid for result in results for uid in array(result.get("searched_units"), "searched_units")]}
        return results[0]

    async def _execute(self, topic: str, question: str, docs: tuple[str, ...], tier: str, builder, *, extra=None) -> Finding:
        units = self._units(docs)
        if topic in CONTEXT_UNITS_PER_DOC:
            retrieval_query = " ".join((question, topic.replace("_", " "), *self._intent_terms(topic)))
            units = relevant_units(units, retrieval_query, per_doc=CONTEXT_UNITS_PER_DOC[topic])
        key = self._key(topic, units, question)
        async with self._locks.setdefault(key, asyncio.Lock()):
            cached = self.core.findings.by_key(key)
            if cached and not (cached.computed and cached.computed.result.get("error")):
                return cached
            missing = [doc for doc in docs if not self.core.units.by_doc(doc)]
            if missing or self.llm is None:
                reason = f"Source units unavailable: {', '.join(missing)}." if missing else "No model configured. Source-backed analysis has not run."
                finding = self._finding(key, topic, reason, Status.needs_review,
                    computed=Computed({}, {"error": "missing_sources" if missing else "model_unavailable"}))
                await self.core.findings.add(finding)
                return finding
            lookup = {unit_id(u): u for u in units}
            diagnostics: list[str] = []
            reviewed_draft: Finding | None = None

            async def draft(at_tier: str, repair: str | None) -> Finding:
                nonlocal reviewed_draft
                error_code = "analysis_incomplete"
                # The shared gate treats every needs_review as a repair request. A validated
                # qualitative judgment is intentionally for people; don't replace it with a
                # less complete second model answer just to turn it into 'confirmed'.
                if repair == "needs_review" and reviewed_draft is not None:
                    return reviewed_draft
                try:
                    raw = await self._model(topic, question, units, at_tier,
                                            diagnostics[-1] if diagnostics else repair, extra)
                    if "not_found" in raw:
                        # A model's absence assertion alone is not an accepted search result.
                        raise InvalidOutput("Insufficient evidence: " + text(raw["not_found"], "not_found"))
                    finding = builder(raw, lookup, key)
                    self.core.verify(finding)
                    finding.urgency = score_urgency(finding, AS_OF)
                    if finding.status == Status.needs_review and all(e.verified for e in finding.evidence):
                        reviewed_draft = finding
                    return finding
                except (InvalidOutput, ValueError, TypeError, KeyError) as exc:
                    diagnostics.append(f"Invalid extraction: {exc}")
                except HTTPError as exc:
                    if exc.code in {401, 402, 403}:
                        diagnostics.append(
                            "Analysis provider rejected the request. Check server-side model credentials or credits."
                        )
                        error_code = "provider_rejected"
                    elif exc.code == 429:
                        diagnostics.append("Analysis provider is temporarily rate limited. Try again shortly.")
                        error_code = "provider_rate_limited"
                    else:
                        diagnostics.append("Analysis service unavailable or timed out.")
                except (OSError, RuntimeError, TimeoutError):
                    # Do not return transport bodies, credentials or provider details to the UI.
                    diagnostics.append("Analysis service unavailable or timed out.")
                return self._finding(key, topic, diagnostics[-1], Status.needs_review,
                    searched=sorted({u.doc_id for u in units}),
                    computed=Computed({}, {"error": error_code}))

            result = await run(tier, draft, max_escalations=0 if tier == "strong" else 1)
            await self.core.findings.add(result.finding)
            return result.finding

    @staticmethod
    def _intent_terms(topic: str) -> tuple[str, ...]:
        # Kept local to the proposal dispatch policy so retrieval contains no pack facts.
        from .config import KEYWORDS
        return KEYWORDS.get(topic, ())

    async def finding(self, question: str) -> Finding:
        question = text(question, "question")
        if len(question) > 4000:
            raise ValueError("Question exceeds 4000 characters")
        # A direct request about an absent form cannot be answered from a named partner alone.
        normalized = " ".join(question.lower().replace("-", " ").split())
        for doc in self.core.absent():
            aliases = [doc.title.lower(), doc.doc_id.lower().replace("_", " ")]
            if doc.doc_id == "LOCAL_PARTNERS":
                aliases = ["local partners form", "local partners information form", "local partners information"]
            if any(alias in normalized for alias in aliases):
                key = self._key("absent_source", [], question)
                finding = self._finding(key, "absent_source",
                    f"{doc.title} is not in the documents. Its contents or completeness cannot be assessed. "
                    "Naming partners in a proposal does not establish the form's completeness.",
                    Status.not_found, searched=["registry"],
                    computed=Computed({"source": doc.doc_id}, {"absent_sources": [to_dict(doc)]}))
                await self.core.findings.add(finding)
                return finding
        intent = dispatch(question)
        extra = None
        if intent.name == "logic_model_quality":
            checks, _ = numeric_quality(self._units(intent.docs))
            extra = {"code_checks": checks}
        elif intent.name == "unsupported_claims":
            extra = {"candidate_hints": grounding_candidate_hints(self._units(intent.docs)),
                     "instruction": "Assess every hint; return unsupported candidates and any distinct candidates you identify."}
        return await self._execute(intent.name, question, intent.docs, intent.tier,
                                   getattr(self, "_" + intent.name), extra=extra)

    async def ask(self, question: str) -> dict:
        return (await self.finding(question)).to_dict()

    def _cost_share_vs_call(self, raw: dict, units: dict[str, Unit], key: str) -> Finding:
        agreement, call = cite(raw.get("agreement"), units, {"03"}), cite(raw.get("call"), units, {"01"})
        computation = check_cost_share(cited_percentage(agreement), cited_percentage(call))
        evidence = [agreement, call] + [cite(e, units, {"01", "03"}) for e in array(raw.get("context", []), "context")]
        values = computation.inputs
        gap = not computation.result["meets_call"]
        claim = (f"The quoted agreement minimum is {values['agreement_pct']:g}% and the call minimum is "
                 f"{values['call_pct']:g}%. ")
        claim += (f"Code finds a {computation.result['gap']:g} percentage-point shortfall. "
                  "GAC must clarify the conflicting requirements; this does not resolve their precedence."
                  if gap else "The quoted minimum meets the call percentage in this comparison. Staff must review the cited cost bases and contribution terms.")
        return self._finding(key, "cost_share_vs_call", claim, Status.conflict if gap else Status.confirmed,
            evidence=evidence, computed=computation, searched=["01", "03"],
            conflict=Conflict("Which contribution requirement should staff apply?", Resolver.gac) if gap else None)

    def _construction_vs_call(self, raw: dict, units: dict[str, Unit], key: str) -> Finding:
        rules, activities = array(raw.get("rules"), "rules"), array(raw.get("activities"), "activities")
        if not rules or not activities:
            raise InvalidOutput("Construction comparison requires a call rule and actual activities")
        evidence, computations = [], []
        for rule in rules:
            rule = object_value(rule, "rule")
            ev = cite(rule.get("evidence"), units, {"01"})
            evidence.append(ev)
            maximum = None
            if rule.get("max_expansion_evidence"):
                try:
                    maximum_ev = cite(rule["max_expansion_evidence"], units, {"01"})
                    maximum = cited_percentage(maximum_ev)
                except InvalidOutput:
                    maximum_ev, maximum = None, None
                if maximum_ev:
                    evidence.append(maximum_ev)
            parsed_rule = CallRule(rule.get("new_construction_allowed"), maximum)
            for activity in activities:
                activity = object_value(activity, "activity")
                ev = cite(activity.get("evidence"), units, {"02", "04"})
                evidence.append(ev)
                expansion = None
                if activity.get("expansion_evidence"):
                    try:
                        expansion_ev = cite(activity["expansion_evidence"], units, {ev.ref.doc_id})
                        expansion = cited_percentage(expansion_ev)
                    except InvalidOutput:
                        expansion_ev, expansion = None, None
                    if expansion_ev:
                        evidence.append(expansion_ev)
                computations.append(callmatch(parsed_rule, Activity(text(activity.get("kind"), "kind"), ev.quote, expansion)))
        for raw_context in array(raw.get("context", []), "context"):
            try:
                evidence.append(cite(raw_context, units, {"01", "02", "03", "04"}))
            except InvalidOutput:
                # Context cannot establish the finding; malformed optional context is dropped.
                # Primary call rules and activities above remain strict and mandatory.
                continue
        mismatch = any(c.result["conflict"] for c in computations)
        uncertain = any(c.result["status"] == "unclear" for c in computations)
        status = Status.conflict if mismatch else Status.needs_review if uncertain else Status.confirmed
        claim = ("The cited proposed or reported activities conflict with the call's construction rules. "
                 "GAC must clarify scope and eligibility; agreement language does not automatically settle the call conflict."
                 if mismatch else "The cited activities were compared with the call. Staff must review any unclear classifications and remaining conditions.")
        return self._finding(key, "construction_vs_call", claim, status, evidence=evidence,
            conflict=Conflict("How should the call restriction and project construction scope be reconciled?", Resolver.gac) if mismatch else None,
            computed=Computed({"comparisons": [to_dict(c.inputs) for c in computations]},
                              {"comparisons": [to_dict(c.result) for c in computations]}), searched=["01", "02", "03", "04"])

    def _unsupported_claims(self, raw: dict, units: dict[str, Unit], key: str) -> Finding:
        searched = array(raw.get("searched_units"), "searched_units")
        if not all(isinstance(value, str) for value in searched) or set(searched) != set(units):
            raise InvalidOutput("Grounding assessment must account for every supplied proposal and report page")
        candidates, evidence, unsupported = [], [], []
        for item in array(raw.get("claims"), "claims"):
            item = object_value(item, "claim")
            ev = cite(item.get("evidence"), units, {"02", "04"})
            support = [cite(e, units, {"02", "04"}) for e in array(item.get("support"), "support")]
            if any(e.quote == ev.quote and e.ref == ev.ref for e in support):
                raise InvalidOutput("Repeating a claim is not substantiation")
            reason = text(item.get("reason"), "reason")
            candidates.append({"claim": to_dict(ev), "support": to_dict(support), "reason": reason,
                               "status": "support_identified" if support else "needs_substantiation"})
            evidence.extend([ev, *support])
            if not support:
                unsupported.append(f'"{ev.quote}" — {reason}')
        represented = {entry["claim"]["ref"]["doc_id"] for entry in candidates}
        missing_docs = {"02", "04"} - represented
        if missing_docs:
            raise InvalidOutput("Grounding candidates missing for reviewed document(s): " + ", ".join(sorted(missing_docs)))
        claim = ("Supporting evidence was not located in the supplied proposal/report for these claims: "
                 + "\n".join(unsupported) + "\nThis is a grounding judgment, not proof that the claims are false. Water Care staff should supply substantiation."
                 if unsupported else "No unsupported candidates were identified in this pass. This does not certify that every claim is substantiated.")
        return self._finding(key, "unsupported_claims", claim, Status.needs_review,
            evidence=evidence, searched=["02", "04"],
            computed=Computed({"searched_units": sorted(searched)}, {"claims": candidates, "resolver": Resolver.water_care.value}))

    def _logic_model_quality(self, raw: dict, units: dict[str, Unit], key: str) -> Finding:
        checks, evidence = numeric_quality(list(units.values()))
        issues = []
        for item in array(raw.get("issues"), "issues"):
            item = object_value(item, "issue")
            cited = [cite_whole_unit(e, units, {"05"}) for e in array(item.get("evidence"), "evidence")]
            if not cited:
                raise InvalidOutput("Quality judgment needs cited rows")
            reason = text(item.get("reason"), "reason")
            evidence.extend(cited)
            issues.append({"reason": reason, "evidence": to_dict(cited)})
        return self._finding(key, "logic_model_quality",
            "PMF numeric checks and qualitative outcome/indicator assessments are available for staff review. "
            "A target below baseline is a review flag, not necessarily an error for a decreasing indicator.",
            Status.needs_review, evidence=evidence, searched=["05"],
            computed=Computed({"as_of": AS_OF.isoformat()}, {"numeric_checks": checks, "quality_issues": issues}))

    async def checklist(self) -> list[dict]:
        def build(raw, units, key):
            rows = [parse_row(row, row_id=f"{key}:{i}", units=units,
                              absent_ids={doc.doc_id for doc in self.core.absent()})
                    for i, row in enumerate(array(raw.get("rows"), "rows"))]
            missing = set(CHECKLIST_CATEGORIES) - {row.category for row in rows}
            if missing:
                raise InvalidOutput("Missing checklist categories: " + ", ".join(sorted(missing)))
            # A named form's completeness must never pass simply because partners are named.
            for row in rows:
                rule_text = row.evidence[0].quote.lower()
                for absent in self.core.absent():
                    tokens = absent.title.lower().replace("–", " ").split()
                    relevant = absent.doc_id == "LOCAL_PARTNERS" and "local partners" in rule_text and "form" in rule_text
                    relevant |= len(tokens) > 2 and absent.title.lower() in rule_text
                    if relevant:
                        row.status = "unclear"
                        if absent.doc_id not in row.absent_sources:
                            row.absent_sources.append(absent.doc_id)
                        row.reason = f"{absent.title} is not in the documents; completeness cannot be established. " + row.reason
            return self._finding(key, "checklist", "Call-requirements checklist prepared for human review.", Status.confirmed,
                evidence=[e for row in rows for e in row.evidence], searched=["01", "02"],
                computed=Computed({"categories": list(CHECKLIST_CATEGORIES)}, {"rows": [row.to_dict() for row in rows]}))
        finding = await self._execute("checklist", "Check every call requirement against the preliminary proposal.",
            ("01", "02"), "mini", build, extra={"categories": CHECKLIST_CATEGORIES})
        return finding.computed.result.get("rows", []) if finding.computed else []

    async def reviewer_questions(self) -> list[dict]:
        def build(raw, units, key):
            expected = {uid for uid, unit in units.items() if unit.doc_id == "06"}
            seen, rows, evidence = set(), [], []
            for item in array(raw.get("mappings"), "mappings"):
                item = object_value(item, "mapping")
                uid = text(item.get("review_unit_id"), "review_unit_id")
                if uid not in expected or uid in seen:
                    raise InvalidOutput("Reviewer row must be a unique supplied question")
                seen.add(uid)
                question = cite({"unit_id": uid, "quote": units[uid].text}, units, {"06"})
                refs = [cite(e, units, {"02"}) for e in array(item.get("proposal"), "proposal")]
                rows.append({"question": to_dict(question), "proposal": to_dict(refs),
                             "status": "mapped" if refs else "not_addressed", "reason": text(item.get("reason"), "reason")})
                evidence.extend([question, *refs])
            if seen != expected or not expected:
                raise InvalidOutput("Every reviewer-question data row must be mapped or explicitly unaddressed")
            return self._finding(key, "reviewer_mapping", "Reviewer preparation questions mapped to proposal evidence.",
                Status.confirmed, evidence=evidence, searched=["02", "06"],
                computed=Computed({}, {"rows": rows}))
        finding = await self._execute("reviewer_mapping", "Map reviewer questions to proposal sections.", ("02", "06"), "mini", build)
        return finding.computed.result.get("rows", []) if finding.computed else []

    async def startup(self) -> dict:
        """Invoke after shared ingest in the app's async lifespan; safe to call repeatedly."""
        findings = [await self.ask(question) for question in STARTUP_QUESTIONS]
        checklist = await self.checklist()
        reviewer = await self.reviewer_questions()
        return {"findings": findings, "checklist": checklist, "reviewer_questions": reviewer}

    async def issues(self) -> list[dict]:
        return [f.to_dict() for f in self.core.findings.all() if f.tool == "proposal"]
