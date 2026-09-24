"""Explicit validation for successful bundles and compilation results.

Independent of the engine internals that "probably" produced a legal
result: every check below recomputes legality from the request,
candidates, policy, bundle, and trace. A successful bundle must pass
all of them; anything else is a validator problem list, never an
exception for normal infeasibility (use CompileFailure for that).
"""

from __future__ import annotations

from context_compiler.bundle import ContextBundle
from context_compiler.domain import (
    CompilationResult,
    ContextCandidate,
    ContextRequest,
    RequirementClass,
    TraceDecision,
)
from context_compiler.engine import eligibility
from context_compiler.policy import CompilerPolicy


def validate_bundle(
    bundle: ContextBundle,
    request: ContextRequest,
    candidates: list[ContextCandidate],
    policy: CompilerPolicy,
) -> list[str]:
    """Recompute success legality from explicit inputs. Empty = valid."""
    problems: list[str] = []
    by_id = {c.candidate_id: c for c in candidates}
    live_ids = [item.id for item in bundle.items]

    if list(bundle.layout_trace) != live_ids:
        problems.append("layout trace must equal item order exactly")

    total = bundle.rendered_token_total()
    if total > request.usable_token_budget:
        problems.append(
            f"rendered cost {total} exceeds budget {request.usable_token_budget}"
        )

    for item_id in live_ids:
        candidate = by_id.get(item_id)
        if candidate is None:
            problems.append(f"bundle item not a candidate: {item_id}")
            continue
        eligible, code, _ = eligibility(candidate)
        if not eligible:
            problems.append(f"admitted hard-ineligible candidate {item_id}: {code}")
        if candidate.form_rank < candidate.min_rank:
            problems.append(f"admitted candidate below floor: {item_id}")

    effective = {
        c.candidate_id: (
            RequirementClass.MANDATORY
            if c.candidate_id in set(request.required_ids)
            and c.requirement == RequirementClass.MANDATORY
            else (
                RequirementClass.REQUIRED
                if c.candidate_id in set(request.required_ids)
                else c.requirement
            )
        )
        for c in candidates
    }
    _ = policy
    for required_id in request.required_ids:
        if required_id not in live_ids:
            candidate = by_id.get(required_id)
            band = effective.get(required_id)
            if candidate is not None and band in (
                RequirementClass.MANDATORY,
                RequirementClass.REQUIRED,
            ):
                problems.append(f"explicitly required candidate absent: {required_id}")

    for item_id in live_ids:
        candidate = by_id.get(item_id)
        if candidate is None:
            continue
        for dep in candidate.depends_on:
            if dep not in live_ids:
                problems.append(f"unsatisfied dependency: {item_id} needs {dep}")

    groups: dict[str, list[str]] = {}
    for candidate in candidates:
        if candidate.group_id and candidate.group_required:
            groups.setdefault(candidate.group_id, []).append(candidate.candidate_id)
    for group_id, members in groups.items():
        present = [mid for mid in members if mid in live_ids]
        if present and len(present) != len(members):
            problems.append(f"required group partially admitted: {group_id}")

    seen_content: set[str] = set()
    for item_id in live_ids:
        candidate = by_id.get(item_id)
        if candidate is None:
            continue
        if candidate.content_identity in seen_content:
            problems.append(
                f"duplicate representation admitted: {candidate.content_identity}"
            )
        seen_content.add(candidate.content_identity)

    return problems


def validate_result(
    result: CompilationResult,
    request: ContextRequest,
    candidates: list[ContextCandidate],
) -> list[str]:
    """Validate a compilation result envelope. Empty = valid."""
    problems: list[str] = []
    traced = {entry.candidate_id for entry in result.trace.entries}
    considered = {c.candidate_id for c in candidates}
    if result.success:
        # Every considered candidate gets exactly one terminal entry.
        if traced != considered:
            problems.append(
                f"trace covers {len(traced)} of {len(considered)} considered candidates"
            )
    elif not traced <= considered:
        # Early failures trace only candidates considered so far, but
        # must never invent entries for unseen candidates.
        problems.append("trace references unconsidered candidates")
    for entry in result.trace.entries:
        if not isinstance(entry.decision, TraceDecision):
            problems.append(f"non-terminal trace decision: {entry.candidate_id}")
    if result.trace.request_id != request.request_id:
        problems.append("trace request mismatch")
    if result.success and result.failure is not None:
        problems.append("success carries a failure")
    if not result.success and result.failure is None:
        problems.append("failure carries no failure record")
    if not result.success and result.bundle_id is not None:
        problems.append("failure carries a bundle identity")
    return problems
