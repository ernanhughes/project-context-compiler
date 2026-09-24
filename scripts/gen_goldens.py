"""Generate conformance/golden/python-v0.1.0/ from the Python reference.

Run with the Python 0.1.0 implementation importable (the tagged
reference). Captures every observable compiler output per case so the
TypeScript port can prove parity without regenerating expectations
from itself.
"""

from __future__ import annotations

import json
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "conformance" / "golden" / "python-v0.1.0"

REFERENCE_COMMIT = "bc2bd54e7565153b6e6d9da7187cda614e9d78fc"
BUDGETS = ("tight", "medium", "roomy")


def main() -> None:
    import context_compiler as cc
    from context_compiler.conformance import _manifest, _policy
    from context_compiler.domain import ContextRequest
    from context_compiler.fixtures import (
        load_candidate_file,
        load_fixture_set,
        load_request_file,
    )

    assert cc.__version__ == "0.1.0", cc.__version__
    manifest = _manifest()
    policy = _policy()
    fixture_set = load_fixture_set(
        Path(cc.__file__).parent / "conformance_data"
    )
    OUT.mkdir(parents=True, exist_ok=True)
    cases = []
    for fixture in sorted(fixture_set):
        candidates = load_candidate_file(fixture_set[fixture]["candidates"])
        base = load_request_file(fixture_set[fixture]["request"])
        for budget in BUDGETS:
            request = ContextRequest(
                request_id=f"{base.request_id}-{budget}",
                task_id=base.task_id,
                usable_token_budget=manifest["budgets"][fixture][budget],
                created_at=base.created_at,
                active_scope=base.active_scope,
                required_ids=base.required_ids,
                policy_version=base.policy_version,
            )
            output = cc.compile_context(request, candidates, policy)
            failure = output.result.failure
            bundle = output.bundle
            by_id = {c.candidate_id: c for c in candidates}
            admitted = [i.id for i in bundle.items] if bundle else []
            doc = {
                "fixture": fixture,
                "budget": budget,
                "request": request.to_dict(),
                "policy": policy.to_dict(),
                "success": output.result.success,
                "failure": failure.to_dict() if failure else None,
                "admitted_candidate_ids": admitted,
                "admitted_representation_ids": [
                    by_id[cid].representation_id for cid in admitted
                ],
                "bundle_order": admitted,
                "bundle": bundle.to_dict() if bundle else None,
                "bundle_tokens": output.result.bundle_tokens,
                "bundle_hash": output.result.bundle_hash,
                "trace": output.result.trace.to_dict(),
                "result": output.result.to_dict(),
                "rendered_text": (
                    cc.render_bundle_text(bundle) if bundle else None
                ),
            }
            (OUT / f"{fixture}-{budget}.json").write_text(
                json.dumps(doc, indent=2, sort_keys=True) + "\n", encoding="utf-8"
            )
            cases.append(f"{fixture}-{budget}")
    manifest_doc = {
        "reference_implementation": "Python",
        "reference_version": "0.1.0",
        "reference_git_commit": REFERENCE_COMMIT,
        "reference_tag": "python-v0.1.0",
        "schema_versions": {
            "candidate": "project_context.context_candidate.v1",
            "request": "project_context.context_request.v1",
            "trace": "project_context.decision_trace.v1",
            "failure": "project_context.compile_failure.v1",
            "result": "project_context.compilation_result.v1",
            "policy": "project_context.compiler_policy.v1",
            "bundle": "project_context.context_bundle.v1",
            "item": "project_context.context_item.v1",
        },
        "fixture_set": "compiler-v1",
        "fixture_version": manifest["fixture_version"],
        "budgets": list(BUDGETS),
        "case_count": len(cases),
        "cases": sorted(cases),
    }
    (OUT / "manifest.json").write_text(
        json.dumps(manifest_doc, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(f"wrote {len(cases)} golden cases to {OUT}")


if __name__ == "__main__":
    main()
