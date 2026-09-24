"""Standalone CLI: context-compiler.

Small on purpose. The Python API is primary; this CLI covers file
IO, validation, inspection, and the conformance gate:

    context-compiler version
    context-compiler compile --request R --candidates C --policy P --output O
    context-compiler validate --compilation COMP
    context-compiler inspect FIXTURE [--budget B]
    context-compiler conformance
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import context_compiler
from context_compiler.conformance import (
    format_report,
    run_case,
    run_conformance,
)
from context_compiler.domain import (
    CompilationResult,
    ContextRequest,
)
from context_compiler.engine import compile_context
from context_compiler.fixtures import load_candidate_file
from context_compiler.policy import CompilerPolicy
from context_compiler.render import render_bundle_text
from context_compiler.validation import validate_bundle, validate_result


def _read_json(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def cmd_version() -> int:
    print(f"context-compiler {context_compiler.__version__}")
    return 0


def cmd_compile(args: argparse.Namespace) -> int:
    request = ContextRequest.from_dict(_read_json(args.request))
    candidates = load_candidate_file(Path(args.candidates))
    policy = CompilerPolicy.from_dict(_read_json(args.policy))
    output = compile_context(request, candidates, policy)
    problems = validate_result(output.result, request, candidates)
    if output.result.success and output.bundle is not None:
        problems.extend(
            validate_bundle(output.bundle, request, candidates, policy)
        )
    if problems:
        print(f"INVALID: {'; '.join(problems)}", file=sys.stderr)
        return 1
    doc = {
        "bundle": output.bundle.to_dict() if output.bundle else None,
        "result": output.result.to_dict(),
    }
    if args.output:
        Path(args.output).write_text(json.dumps(doc, indent=2), encoding="utf-8")
    else:
        print(json.dumps(doc, indent=2))
    if output.bundle is not None:
        print(render_bundle_text(output.bundle), file=sys.stderr)
    else:
        print(
            f"explicit failure: {output.result.failure.reason.value}",
            file=sys.stderr,
        )
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    from context_compiler.bundle import ContextBundle

    doc = _read_json(args.compilation)
    bundle_doc = doc.get("bundle")
    result = CompilationResult.from_dict(doc["result"])
    request = ContextRequest.from_dict(_read_json(args.request))
    candidates = load_candidate_file(Path(args.candidates))
    problems = validate_result(result, request, candidates)
    if bundle_doc is None:
        if result.success:
            problems.append("success without bundle")
    else:
        bundle = ContextBundle.from_dict(bundle_doc)
        policy = CompilerPolicy.from_dict(_read_json(args.policy))
        problems.extend(validate_bundle(bundle, request, candidates, policy))
    if problems:
        print(f"INVALID: {'; '.join(problems)}", file=sys.stderr)
        return 1
    print("valid")
    return 0


def cmd_inspect(args: argparse.Namespace) -> int:
    from context_compiler.conformance import _manifest, _policy

    try:
        manifest = _manifest()
        policy = _policy()
        outcome, _ = run_case(args.fixture, args.budget, manifest, policy)
    except KeyError:
        print(f"unknown fixture: {args.fixture}", file=sys.stderr)
        return 2
    print(f"{outcome.fixture}/{outcome.budget}: success={outcome.success}")
    if not outcome.success:
        print(f"reason: {outcome.reason}")
    else:
        print(f"admitted: {list(outcome.admitted_ids)}")
        print(f"tokens: {outcome.bundle_tokens} hash: {outcome.bundle_hash}")
    if outcome.validation_problems:
        print(f"validation: {list(outcome.validation_problems)}")
        return 1
    return 0


def cmd_conformance() -> int:
    report = run_conformance()
    print(format_report(report), end="")
    return 0 if report.passed else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="context-compiler")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("version")
    compile_p = sub.add_parser("compile")
    compile_p.add_argument("--request", required=True)
    compile_p.add_argument("--candidates", required=True)
    compile_p.add_argument("--policy", required=True)
    compile_p.add_argument("--output", default="")
    validate_p = sub.add_parser("validate")
    validate_p.add_argument("--compilation", required=True)
    validate_p.add_argument("--request", required=True)
    validate_p.add_argument("--candidates", required=True)
    validate_p.add_argument("--policy", required=True)
    inspect_p = sub.add_parser("inspect")
    inspect_p.add_argument("fixture")
    inspect_p.add_argument("--budget", default="medium")
    sub.add_parser("conformance")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "version":
        return cmd_version()
    if args.command == "compile":
        return cmd_compile(args)
    if args.command == "validate":
        return cmd_validate(args)
    if args.command == "inspect":
        return cmd_inspect(args)
    if args.command == "conformance":
        return cmd_conformance()
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
