"""Code-side PMF numeric checks on the shared, cited row units."""
import re

from core import Evidence, Unit, to_dict
from core.checks import check_target_baseline


def numeric_quality(units: list[Unit]) -> tuple[list[dict], list[Evidence]]:
    results, evidence = [], []
    for unit in units:
        fields = dict(part.split(": ", 1) for part in unit.text.split(" | ") if ": " in part)
        baseline = next((v for k, v in fields.items() if k.lower() == "baseline"), None)
        target = next((v for k, v in fields.items() if k.lower().startswith("target")), None)
        if not any(k.lower() == "indicator" for k in fields):
            continue
        percentages = lambda value: [float(x) for x in re.findall(r"(\d+(?:\.\d+)?)\s*%", value or "")]
        def scalar(value):
            return float(value) if value is not None and re.fullmatch(r"\d+(?:\.\d+)?", value.strip()) else None
        targets = percentages(target)
        target_value = targets[0] if len(targets) == 1 else scalar(target)
        baselines = percentages(baseline) if targets else []
        if not baselines and scalar(baseline) is not None:
            # Do not compare a bare count with a percentage target.
            baselines = [scalar(baseline)] if not targets else []
        checks = [check_target_baseline(value, target_value) for value in baselines or [None]]
        flagged = target_value is None or not baseline or any(c.result["target_below_baseline"] for c in checks)
        results.append({"ref": to_dict(unit.ref), "indicator": fields.get("Code"),
                        "baseline_raw": baseline, "target_raw": target,
                        "baseline_missing": not bool(baseline),
                        "comparison_available": bool(baselines) and target_value is not None,
                        "checks": to_dict(checks), "flagged": flagged})
        if flagged:
            evidence.append(Evidence(unit.ref, unit.text, True))
    return results, evidence
