# AGENTS.md — project-context-compiler

Instructions for coding agents working in this repository.

## Core invariants

1. **Deterministic core.** Identical explicit inputs yield identical
   outputs. No file IO, clock, randomness, network, models, retrieval,
   memory, or subprocesses inside the compile path.
2. **No models/network/IO inside `engine.py`.** A source-scan test
   pins this. File-facing code lives in `fixtures.py`, `cli.py`, and
   `conformance.py` only.
3. **Hard illegality is terminal.** Scope/freshness/authority/floor
   rejections are never revived by relevance, rank, or budget.
4. **No silent mandatory truncation.** Over-budget minimum legal
   content is `CompileFailure(INSUFFICIENT_BUDGET)`, never a guess.
5. **No final-render slicing.** Rendered cost is validated exactly;
   repair is policy-governed (`drop-last-discretionary` under v1).
6. **Hidden truth never enters runtime.** No oracle labels, eval
   classes, or grader mappings in runtime modules or conformance
   fixtures. Structural expectations only.
7. **Explicit failure is valid output.** Distinguish invalid input
   (raises) from valid problems with no legal compilation (fails).
8. **All success bundles validated.** Independent validators in
   `validation.py` must agree with the engine on the conformance
   matrix.
9. **Policy changes require new policy versions.** Never mutate
   `compiler-policy-v1` behaviour. New policies get new versions.
10. **Serialized schema v1 compatibility must not change silently.**
    The `project_context.*.v1` strings are historical public
    identities. A cleaner namespace is a v2 schema, not a rewrite.
11. **Compiler mechanism only.** No model evaluation, no behavioural
    graders, no readers, no provider execution. Those live in
    `project-context`.
12. **Keep dependencies minimal.** Zero runtime dependencies. Boring
    Python: stdlib, frozen dataclasses, enums, pure functions.
13. **Historical conformance fixtures immutable once versioned.** Do
    not regenerate fixtures and call them the same version.

## Process

- Small diffs, boring code. Compatibility before cleanup: any
  behavioural change must first pass the 42-case conformance matrix
  plus the differential expectations.
- Never fabricate results. Conformance fixtures are labelled
  synthetic; synthetic is never evidence of behavioural usefulness.
- Public repository. Never commit credentials, private code, or
  personal data.
