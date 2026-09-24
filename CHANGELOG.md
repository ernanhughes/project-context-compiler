# Changelog

## 0.1.0

Initial standalone release. Extracts the deterministic staged
compiler (compiler-policy-v1 semantics) from Project Context
without behavioural change.

- v1 domain records with frozen `project_context.*.v1` schemas
- deterministic staged engine (eligibility, alternatives,
  dependencies, groups, greedy admission, ordering, exact render
  validation, policy-governed repair, explicit failure)
- minimal item/bundle primitives with order-sensitive hashing
- strict JSON fixture loaders, generic text renderer, independent
  bundle/result validators
- canonical 14 × 3 conformance matrix shipped in-package
- `context-compiler` CLI (version, compile, validate, inspect,
  conformance) and stable `context_compiler` Python API

Implements/extracts existing compiler-policy-v1 semantics. Schema
version and package maturity are different things: this is not
called 1.0 merely because the schemas say v1.
