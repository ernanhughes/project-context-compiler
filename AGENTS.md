# AGENTS.md — project-context-compiler

Instructions for coding agents working in this repository.

## What this is

TypeScript canonical implementation of the deterministic Context
Compiler (0.2.0), plus a CLI and an OpenCode plugin in the same
package. The Python 0.1.0 reference is frozen under tag
`python-v0.1.0`; `main` is TypeScript.

## Core invariants

1. **Deterministic core.** Identical explicit inputs yield identical
   outputs. No filesystem, network, models, env, clock,
   randomness, subprocesses, or provider SDKs in `src/core`.
2. **No OpenCode in core.** `src/core` imports only Node builtins
   (`node:crypto` for hashing/UUIDs). Plugin code lives in
   `src/opencode` and delegates to core. A test pins this.
3. **Hard illegality is terminal.** Scope/freshness/authority/floor
   rejections are never revived by relevance, rank, or budget.
4. **No silent mandatory truncation.** Over-budget minimum legal
   content is an explicit `CompileFailure`, never a guess.
5. **No final-render slicing.** Rendered cost validated exactly;
   repair is policy-governed only.
6. **Hidden truth never enters runtime.** No oracle labels in
   runtime modules or fixtures. Conformance uses structural
   expectations plus frozen Python goldens.
7. **Explicit failure is valid output.** Distinguish invalid input
   (throws) from valid problems with no legal compilation (fails).
8. **All success bundles validated.** Independent validators must
   agree with the engine on the conformance matrix.
9. **Policy changes require new policy versions.** Never mutate
   `compiler-policy-v1` behaviour.
10. **v1 schemas are frozen.** The `project_context.*.v1` strings
    are language-independent protocol identities. A language port
    never renames them.
11. **Compiler mechanism only.** No evaluation, no behavioural
    graders, no retrieval, no agent framework. Smallness is a
    feature.
12. **Plugin is side-effect-light.** Tools only. No context hooks,
    no capture, no injection. Transport lives in
    `project-context-opencode`.
13. **Conformance fixtures and goldens immutable.** Never
    regenerate expectations from the implementation under test.

## Cross-language traps

- Python `round()` is ties-to-even; `Math.round` is not. Use
  `pythonRoundHalfEven`.
- Python `str.split()` splits on whitespace runs; never
  `.split(" ")`.
- No `localeCompare` for decision ordering; use `compareStrings`.
- SHA-256 over UTF-8 bytes with NUL separators, exactly.
- `None` serializes as JSON `null`; never emit `undefined` into
  v1 JSON. Optional inputs default per the Python `.get` rules.

## Process

- Small diffs, boring code. Compatibility before cleanup.
- `npm run typecheck`, `npm test`, `npm run lint` before every
  commit. Prettier formatting is enforced; fixture/golden bytes
  under `conformance/` are excluded via `.prettierignore` and must
  stay byte-identical.
- Public repository. Never commit credentials or private data.
