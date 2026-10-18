"""The shared gate: validate a finding and run cheap -> repair -> escalate -> needs_review."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Awaitable, Callable

from .schema import Finding, Status


def validate(finding: Finding) -> str | None:
    """Failure reason if the finding isn't a clean terminal state (triggers repair/escalation), else None."""
    f = finding
    if not f.claim.strip():
        return "empty claim"
    if f.evidence and any(not e.verified for e in f.evidence):
        return "unverified quote"
    if f.status == Status.needs_review:
        return "needs_review"
    if f.status == Status.confirmed and not f.evidence:
        return "confirmed without evidence"
    if f.status == Status.conflict:
        if not f.conflict or not f.conflict.resolver:
            return "conflict without resolver"
        if len(f.evidence) < 2:
            return "conflict with <2 evidence"
    if f.status == Status.not_found and not f.searched:
        return "not_found without searched[]"
    return None


@dataclass
class RunResult:
    finding: Finding
    tier_used: str
    escalated: bool
    reason: str | None       # None = accepted; set = terminal needs_review


# draft(tier, reason) -> verified Finding
Draft = Callable[[str, str | None], Awaitable[Finding]]


async def run(start_tier: str, draft: Draft, *, max_escalations: int = 1) -> RunResult:
    tier = start_tier
    finding = await draft(tier, None)
    reason = validate(finding)

    if reason:  # cheap self-repair at the same tier (fixes formatting/sloppy quotes)
        finding = await draft(tier, reason)
        reason = validate(finding)

    escalated = False
    attempts = 0
    while reason and attempts < max_escalations:
        tier, escalated, attempts = "strong", True, attempts + 1
        finding = await draft(tier, reason)
        reason = validate(finding)

    if reason:  # exhausted — hand to a human
        finding.status = Status.needs_review

    return RunResult(finding=finding, tier_used=tier, escalated=escalated, reason=reason)
