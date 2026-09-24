# Changelog

## 0.2.0

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
