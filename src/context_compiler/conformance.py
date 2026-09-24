"""Canonical compiler-v1 conformance matrix: 14 fixtures x 3 budgets.

Runs entirely from this package's own conformance fixtures plus the
frozen policy. No project-context checkout needed. Expectations come
from the frozen manifest's structural `expected` matrix
(success/failure reason per case) — never from oracle truth files,
which are not shipped here.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from context_compiler.domain import ContextRequest
from context_compiler.engine import CompileOutput, compile_context
from context_compiler.fixtures import (
    load_candidate_file,
    load_fixture_set,
    load_request_file,
)
from context_compiler.policy import CompilerPolicy
from context_compiler.validation import validate_bundle, validate_result

CONFORMANCE_ROOT = Path(__file__).resolve().parent / "conformance_data"
POLICY_FILE = CONFORMANCE_ROOT / "compiler-policy-v1.json"
MANIFEST_FILE = CONFORMANCE_ROOT / "manifest.json"
BUDGETS = ("tight", "medium", "roomy")


@dataclass(frozen=True)
class CaseOutcome:
    fixture: str
    budget: str
    success: bool
    reason: str | None
    admitted_ids: tuple[str, ...]
    bundle_tokens: int | None
    bundle_hash: str | None
    validation_problems: tuple[str, ...]


@dataclass(frozen=True)
class ConformanceReport:
    cases: int
    success_cases: int
    expected_failure_cases: int
    semantic_mismatches: int
    serialization_mismatches: int
    budget_violations: int
    details: tuple[str, ...]

    @property
    def passed(self) -> bool:
        return (
            self.semantic_mismatches == 0
            and self.serialization_mismatches == 0
            and self.budget_violations == 0
        )


def _manifest() -> dict:
    return json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))


def _policy() -> CompilerPolicy:
    return CompilerPolicy.from_dict(
        json.loads(POLICY_FILE.read_text(encoding="utf-8"))
    )


def run_case(
    fixture: str, budget: str, manifest: dict, policy: CompilerPolicy
) -> tuple[CaseOutcome, dict]:
    fixture_set = load_fixture_set(CONFORMANCE_ROOT)
    candidates = load_candidate_file(fixture_set[fixture]["candidates"])
    base = load_request_file(fixture_set[fixture]["request"])
    request = ContextRequest(
        request_id=f"{base.request_id}-{budget}",
        task_id=base.task_id,
        usable_token_budget=manifest["budgets"][fixture][budget],
        created_at=base.created_at,
        active_scope=base.active_scope,
        required_ids=base.required_ids,
        policy_version=base.policy_version,
    )
    output: CompileOutput = compile_context(request, candidates, policy)
    problems = list(validate_result(output.result, request, candidates))
    admitted: tuple[str, ...] = ()
    tokens: int | None = None
    digest: str | None = None
    if output.result.success:
        assert output.bundle is not None
        problems.extend(validate_bundle(output.bundle, request, candidates, policy))
        admitted = tuple(item.id for item in output.bundle.items)
        tokens = output.result.bundle_tokens
        digest = output.result.bundle_hash
    expected = manifest["expected"][fixture][budget]
    outcome = CaseOutcome(
        fixture=fixture,
        budget=budget,
        success=output.result.success,
        reason=(
            output.result.failure.reason.value if output.result.failure else None
        ),
        admitted_ids=admitted,
        bundle_tokens=tokens,
        bundle_hash=digest,
        validation_problems=tuple(problems),
    )
    return outcome, expected


def run_conformance() -> ConformanceReport:
    manifest = _manifest()
    policy = _policy()
    fixture_set = load_fixture_set(CONFORMANCE_ROOT)
    details: list[str] = []
    semantic = 0
    serial = 0
    budget_bad = 0
    success_cases = 0
    failure_cases = 0
    cases = 0
    for fixture in sorted(fixture_set):
        for budget in BUDGETS:
            cases += 1
            outcome, expected = run_case(fixture, budget, manifest, policy)
            if outcome.success != expected["success"] or (
                not outcome.success and outcome.reason != expected["reason"]
            ):
                semantic += 1
                details.append(
                    f"{fixture}/{budget}: got success={outcome.success} "
                    f"reason={outcome.reason}, expected {expected}"
                )
            if outcome.validation_problems:
                serial += 1
                details.append(
                    f"{fixture}/{budget}: validation {list(outcome.validation_problems)}"
                )
            if (
                outcome.success
                and outcome.bundle_tokens is not None
                and outcome.bundle_tokens
                > manifest["budgets"][fixture][budget]
            ):
                budget_bad += 1
                details.append(f"{fixture}/{budget}: over budget")
            if outcome.success:
                success_cases += 1
            else:
                failure_cases += 1
    return ConformanceReport(
        cases=cases,
        success_cases=success_cases,
        expected_failure_cases=failure_cases,
        semantic_mismatches=semantic,
        serialization_mismatches=serial,
        budget_violations=budget_bad,
        details=tuple(details),
    )


def format_report(report: ConformanceReport) -> str:
    lines = [
        "Context Compiler conformance",
        "",
        "fixtures: 14",
        "budgets: 3",
        f"cases: {report.cases}",
        "",
        f"success cases: {report.success_cases}",
        f"expected failure cases: {report.expected_failure_cases}",
        "",
        f"semantic mismatches: {report.semantic_mismatches}",
        f"serialization mismatches: {report.serialization_mismatches}",
        f"budget violations: {report.budget_violations}",
        "",
        "PASS" if report.passed else "FAIL",
    ]
    lines.extend(report.details)
    return "\n".join(lines) + "\n"
