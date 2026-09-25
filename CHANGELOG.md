# Changelog

## 0.3.0

Trace semantics repaired. Selection behaviour is unchanged: on all 42
compiler-v1 cases the same candidates are admitted in the same order with
the same bundle hashes and the same failures.

- **DecisionTrace v2** (`project_context.decision_trace.v2`) and
  **CompilationResult v2**. Candidate, request, bundle and failure schemas
  are unchanged.
  - `dependency_closure` now holds each candidate's transitive
    dependencies (it was always empty).
  - `budget_after` is now the budget remaining after the decision (it
    repeated `budget_before`). An admission charges its whole unit, the
    candidate and any dependencies admitted with it.
  - new `pulled_in_by`: for a candidate admitted only because another
    needed it, the requested candidates that depend on it.
  - `REJECTED_GROUP` removed from the decision vocabulary. The engine
    never wrote it; a group that cannot be admitted is recorded as a
    budget or dependency rejection of its members.
  - v1 documents are still read (`legacySchema: "v1"`). `traceToV1JSON` and
    `resultToV1JSON` project a result onto the v1 shape.
- **Parity is checked on the v1 projection.** The frozen Python goldens are
  historical truth and are unchanged. They contain the two v1 trace
  defects above, which the first TypeScript port reproduced faithfully;
  parity showed equivalence, not correctness.
- **`mandatory_form` is enforced.** Only `"cheapest"` is supported; any other
  value is rejected when the policy is read and when compiling. Previously
  the field was recorded and ignored.
- **Validators are independent of the engine.** The four hard-eligibility
  predicates and the transitive-dependency walk are written out again in
  `validation.ts` instead of importing the engine's. `validateResult` also
  checks v2 trace semantics and would have caught both v1 defects. Tests
  feed each validator malformed bundles and traces.
- Not changed, on purpose: ranking within the preferred and discretionary
  classes (relevance, then new coverage, then cost, then identifier).

## 0.2.3

Packaging only, no compiler behaviour change.

- commit `dist/` so Git installs work without a build step
  (installer environments may omit dev dependencies); `prepare`
  rebuilds only when `dist` is absent

## 0.2.2

Packaging only, no compiler behaviour change.

- run the `dist/` build on Git install (`prepare`), so Git
  consumers receive compiled output without a local build step

Packaging only, no compiler behaviour change.

- ship compiled `dist/` (types + maps + `context-compiler` bin)
  so plain Node consumers can import the package without
  TypeScript stripping; `main`/`exports` point at `dist`
- CLI reports 0.2.1

TypeScript canonical implementation. Behavioural port of the
Python 0.1.0 reference (tag `python-v0.1.0`); compiler-policy-v1
semantics unchanged.

- `src/core`: domain, policy, staged engine, items/bundle
  primitives, generic renderer, independent validators —
  dependency-free apart from Node builtins
- `src/cli.ts`: version, compile, validate, inspect, conformance
  (the language-neutral JSON boundary for the Python harness)
- `src/opencode`: OpenCode V2 plugin (id
  `project-context.compiler`) exposing `context_compiler_compile`,
  `context_compiler_validate`, `context_compiler_inspect` tools;
  side-effect-light, no context hooks
- `conformance/`: canonical compiler-v1 fixtures plus frozen
  Python v0.1.0 golden outputs; 42/42 cross-language parity
- dual package entries: `.` (plugin + library) and `./core`
  (library only)

Implements/extracts existing compiler-policy-v1 semantics under
unchanged `project_context.*.v1` schemas.

## 0.1.0

Python reference implementation (tag `python-v0.1.0`).

- v1 domain records with frozen `project_context.*.v1` schemas
- deterministic staged engine (eligibility, alternatives,
  dependencies, groups, greedy admission, ordering, exact render
  validation, policy-governed repair, explicit failure)
- minimal item/bundle primitives with order-sensitive hashing
- strict JSON fixture loaders, generic text renderer, independent
  bundle/result validators
- canonical 14 × 3 conformance matrix
- `context-compiler` CLI and stable `context_compiler` Python API
