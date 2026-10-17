"""Opt-in live evaluation. Never imported by product code. Run with uv --env-file .env."""
import asyncio
import argparse
import json
import os

from core import Core, OpenRouterLLM, locator_label
from core.verify import normalize
from tests.eval.scorer import load_gold, score
from tools.proposal import ProposalAssistant


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ids", nargs="+", default=["Q5", "Q21", "Q23"])
    args = parser.parse_args()
    if not os.getenv("OPENROUTER_API_KEY", "").strip():
        raise SystemExit("Configure OPENROUTER_API_KEY locally before running live evaluation.")
    core = await asyncio.to_thread(Core, "assets")
    await core.load()
    tool = ProposalAssistant(core, OpenRouterLLM())
    results = []
    gold_entries = await asyncio.to_thread(load_gold)
    requested = set(args.ids)
    for gold in [g for g in gold_entries if g["id"] in requested]:
        finding = await tool.finding(gold["question"])
        labels = [locator_label(e.ref) for e in finding.evidence]
        citations_ok = all(any(label.startswith(want.split(":", 1)[0]) and want.split(":", 1)[1] in label for label in labels)
                           for want in gold.get("must_cite", []))
        computation_ok = not gold.get("expected_computed") or bool(finding.computed and finding.computed.result == gold["expected_computed"])
        claims_ok = all(normalize(fragment) in normalize(finding.claim) for fragment in gold.get("expected_claim_fragments", []))
        category = score(finding, gold)
        passed = category in {"correct_with_citation", "correct_conflict_with_resolver"} and citations_ok and computation_ok and claims_ok
        results.append({"id": gold["id"], "category": category, "citations_ok": citations_ok, "computation_ok": computation_ok,
                        "claims_ok": claims_ok, "passed": passed, "finding": finding.to_dict()})
        print(json.dumps({k: v for k, v in results[-1].items() if k != "finding"}), flush=True)
    print(json.dumps({"results": results}, ensure_ascii=False, indent=2))
    return 0 if all(result["passed"] for result in results) else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
