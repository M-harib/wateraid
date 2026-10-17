"""Run proposal views without depending on the compliance HTTP application."""
import argparse
import asyncio
import json
import os
from pathlib import Path

from core import Core, OpenRouterLLM
from .service import ProposalAssistant


async def main() -> int:
    parser = argparse.ArgumentParser(description="Source-backed proposal checks; no generation or form filling.")
    parser.add_argument("--assets", default="assets")
    parser.add_argument("--question")
    parser.add_argument("--view", choices=["startup", "checklist", "reviewer", "quality"], default="startup")
    parser.add_argument("--output", type=Path, help="Write pipeline JSON to this path instead of stdout")
    args = parser.parse_args()
    core = await asyncio.to_thread(Core, args.assets)
    await core.load()
    key = os.getenv("OPENROUTER_API_KEY", "").strip()
    service = ProposalAssistant(core, OpenRouterLLM(api_key=key) if key else None)
    if args.question:
        result = await service.ask(args.question)
    elif args.view == "checklist":
        result = {"checklist": await service.checklist()}
    elif args.view == "reviewer":
        result = {"reviewer_questions": await service.reviewer_questions()}
    elif args.view == "quality":
        result = await service.ask("Review the logic model and indicator baseline and target quality.")
    else:
        result = await service.startup()
    # Include operational failures even when a list view has no rows.
    failures = [f.to_dict() for f in core.findings.all()
                if f.computed and isinstance(f.computed.result, dict) and f.computed.result.get("error")]
    output = {"result": result, "failures": failures}
    serialized = json.dumps(output, ensure_ascii=False, indent=2)
    if args.output:
        await asyncio.to_thread(args.output.parent.mkdir, parents=True, exist_ok=True)
        await asyncio.to_thread(args.output.write_text, serialized, encoding="utf-8")
    else:
        print(serialized)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
