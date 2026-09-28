# Candidate Builder

Upstream of the Context Compiler. Heterogeneous available
information in, comparable `ContextCandidate[]` out — through the
unchanged `project_context.context_candidate.v1` schema.

```text
AVAILABLE INFORMATION
        ↓
Source adapters (file, instruction, tool, state, retrieval)
        ↓
Source observations (existence, not eligibility)
        ↓
Candidate Builder
   ├── stable identity (content hashes, never sequence numbers)
   ├── provenance (every field: observed/declared/derived/policy/neutral/unknown)
   ├── metadata derivation (scope, freshness, authority, requirement, floor)
   ├── representation generation (full/compact/anchor/reference + marker)
   ├── dependency linking (cross-content needs only)
   └── conflict grouping (grouped, never silently resolved)
        ↓
ContextCandidate[] (existing schema, no changes)
        ↓
Admission / ranking / selection (downstream, not here)
        ↓
Context Compiler → ContextBundle or CompileFailure
```

## Boundary

The builder answers **what could legitimately become context**. It
does not answer what one computation should receive. It never
decides admission, rank, budget fit, transport, or usefulness.

```text
discovery ≠ admission
retrieval ≠ admission (retrieval outputs are inputs here, never executed)
candidate generation ≠ ranking (relevance is carried, never ordered by)
ranking ≠ assembly
assembly ≠ transport
transport ≠ model use
```

The builder never retrieves, never calls a model, and never reads
the filesystem, network, environment, clock, or randomness for its
decisions. The single clock read (`metrics.buildLatencyMs`) is
observability only and is excluded from the replay contract: same
request, available information, and policy give byte-identical
candidates and trace. A boundary test pins the import and
no-time-comparison rules; 24 builder tests pin the behaviour.

## Sources (implemented)

Three adapters cover five source classes plus retrieval outputs as
data. Each adapter exposes one function over its own typed inputs;
no source system shares a storage model.

| Adapter            | Source classes                                                    | Emits                                                        |
| ------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------ |
| file / instruction | repository files, explicitly supplied files, project instructions | one observation per file revision / instruction              |
| tool               | tool definitions and tool observations/results                    | a definition observation plus an output observation per call |
| state              | agent working state, memory recalls, retrieval outputs            | one observation per note / memory / retrieved passage        |

A discovered observation is not yet a candidate. Malformed
observations (empty payload, missing identity) are rejected one by
one and recorded; they never become guessed candidates.

## Candidate construction

One observation yields one or more candidates (one per
representation form). Reused schema, unchanged: `candidateFromJSON`
round-trips every emitted candidate.

| Field             | How the builder establishes it                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| candidate id      | `cand-<sha256(source, form, content)>`: stable; additions elsewhere never move it; mutation changes only its own source                   |
| content identity  | `content-<sha256(payload)>`: every form of one observation shares it, so the compiler treats forms as alternatives and admits at most one |
| representation    | full (3), compact (2), anchor (1), reference (0); floor from retention via policy (`pin` → 3)                                             |
| token cost        | word-based estimate, `approximation`; same estimator the compiler uses                                                                    |
| requirement       | source-declared, else policy default by source type (instruction → mandatory)                                                             |
| order role        | fixed mapping (instruction → instruction, tool definition → tool, working state → state, …)                                               |
| scope verdict     | declared scope equals active scope; unknown or wrong scope is ineligible (fail closed)                                                    |
| freshness verdict | validator status and supersession only; `observedAt` is carried, never compared                                                           |
| authority verdict | policy table by source class; relevance is never consulted (pinned by test)                                                               |
| dependencies      | tool output → its tool definition; references carry lineage in the trace, not compiler edges                                              |
| conflict group    | one locator with incompatible payloads → shared group id plus a builder-generated marker                                                  |
| relevance         | retrieval scores carried through; everything else an explicit neutral 0.5 (the builder does not rank)                                     |

Every field's provenance is recorded per candidate in the trace as
observed, declared, derived, policy-supplied, neutral, or unknown.
Unknown is never silently guessed: unknown scope fails closed,
unknown retention yields floor 0 marked unknown, unknown freshness
follows the explicit policy switch (default: eligible with the
reason stating no staleness claim exists and age was not
considered).

## Representation generation

Forms are planned per observation: verbatim full; deterministic
word-truncation compact (skipped when the payload already fits, and
always recorded as lossy); anchor (locator, version, first line);
reference (pointer text naming its anchor — never resident content).
Each derived form shares its observation's content identity and
records its derivation lineage in the trace. A compact form can
never masquerade as the original; a reference can never masquerade
as content. A reference whose anchor form is disabled is refused
with `REPRESENTATION_FAILURE` rather than left dangling.

## Dependencies

Edges name cross-content needs: a tool result needs its tool
definition; a reference names its anchor in lineage. A reference
deliberately carries no compiler edge to its own anchor: the
compiler admits at most one form per content, so that edge would be
unsatisfiable. Missing prerequisites are exposed (a derivation
noting the absent definition), never hidden. Dangling edges abort
the build with `INVALID_DEPENDENCY`; the construction is acyclic by
design (edges only point at already-emitted observations) and the
trace reports the cycle check.

## Conflict grouping

Structurally detectable conflicts — one locator, incompatible
payloads — are grouped with a marker candidate describing the
disagreement. The group is marked required only when every member
is gate-eligible, so a stale version can never hold its fresh
counterpart hostage; grouping stays visible in the trace either
way. Resolution stays downstream: the builder never picks a
winner, and the compiler's gates still apply per candidate.

## Failure taxonomy and policy

| Code                          | Meaning                           | Response                                                                 |
| ----------------------------- | --------------------------------- | ------------------------------------------------------------------------ |
| `SOURCE_UNAVAILABLE`          | no available information supplied | abort (throw): silent partial context is worse than none                 |
| `ADAPTER_FAILURE`             | one source class fails            | skip that source, record, continue with the rest                         |
| `MALFORMED_OBSERVATION`       | empty payload, missing identity   | skip the observation, record, continue                                   |
| `UNSUPPORTED_SOURCE`          | unknown source shape              | skip, record                                                             |
| `INVALID_CANDIDATE`           | post-construction check fails     | skip, record                                                             |
| `IDENTITY_COLLISION`          | same id, different content        | abort (throw): identity is load-bearing                                  |
| `REPRESENTATION_FAILURE`      | a form cannot be built honestly   | skip the form, record                                                    |
| `UNRESOLVED_PROVENANCE`       | a field has no provenance         | mark unknown, never guess                                                |
| `METADATA_DERIVATION_FAILURE` | a verdict cannot be derived       | fail closed for scope/authority, policy switch for freshness             |
| `INVALID_DEPENDENCY`          | an edge names an absent candidate | abort (throw): the output would be uncompilable                          |
| `CYCLIC_DEPENDENCY`           | a dependency cycle                | reported in the trace; still emitted (the compiler terminates on cycles) |
| `UNRESOLVED_SCOPE`            | scope unknown                     | ineligible, fail closed                                                  |
| `VALIDATION_UNAVAILABLE`      | no validator speaks               | policy switch, reason states the absence                                 |
| `MODEL_JUDGE_FAILURE`         | n/a in v1                         | no model judge exists; the trace field stays empty by construction       |

Item-level problems skip the item; identity, dependency, and
absent-input problems abort the build. Rationale: a skipped item
is visible in the trace, while a collision or dangling edge would
make the whole output untrustworthy or uncompilable.

## Determinism

Deterministic: pure functions of (request, available information,
policy). Externally observed (payloads, versions, validator
claims), policy-driven (requirement defaults, authority table,
floors, freshness switch), heuristic only in the fixed
word-truncation and anchor-extraction rules. Model-judged: nothing
in v1 — zero model-judged derivations on every run, and the
trace's model-judgment list stays empty. If an LLM ever classifies
or generates, its output must enter as an attributed claim with
provider, model, and execution identity; unmarked
LLM-judgement-as-fact is not representable in this schema.

## Canonical worked example (measured)

Task: modify authentication behaviour. Available information: a
project instruction, a long source file at its current revision, a
stale revision of the same file, a README, a wrong-scope config, a
tool call with definition and output, a working-state note, and a
memory recall. From `tests/builder/builder.test.ts`:

```text
available-information items:  8
observations discovered:      9  (one tool call yields definition + output)
candidates emitted:           29
candidates rejected:          0
by source:                    file 13, tool 6, instruction 3,
                              working-state 3, memory 3, builder 1 (marker)
by representation:            full 9, compact 1, anchor 9,
                              reference 9, conflict-marker 1
deterministic derivations:    210
model-judged derivations:     0
unknown metadata fields:      46 (counted, not guessed)
conflict groups:              1 (src/auth.ts r42 vs r39 + marker)
dependency edges:             3 (tool outputs and reference → definition)
candidate yield:              29 / 9 ≈ 3.2 (structural, not a quality score)
```

Fed through the existing compiler at a 4,000-token budget with no
hand edits: success, 7 admitted items, 196 bundle tokens, zero
problems from the independent bundle and result validators. The
stale revision and the wrong-scope config are rejected at the hard
gates with reasons; the fresh file revision and the standing
instruction are admitted.

Controlled checks, all in `tests/builder/builder.test.ts`: replay
is byte-identical (A); irrelevant additions move no unrelated
identity (B); mutating one source moves only its own candidates
(C); wrong-scope items stay explicit and rejectable (D);
conflicting versions group without a winner (E); old-but-affirmed
stays eligible while new-but-superseded is rejected, and identical
content under different timestamps verifies identically (F);
full/compact/reference lineage and floors survive (G); tool
dependencies, exposed prerequisites, and refused dangling
references behave (H).

## What this proves and what it does not

Structural only: heterogeneous information becomes explicit,
inspectable, replayable candidate objects without making the final
context decision. It does not prove relevance, usefulness,
correctness, authority, freshness, eventual admission, or any
behavioural benefit. Ranking quality, admission quality, and
model behaviour stay separate experiments.

## Future work (not implemented)

Live source connectors (the builder takes in-memory records;
something else reads repositories and calls tools); learned
relevance or ranking (carried scores only); model-judged
classification with attributed claims; resolver-backed references
with compiler-level dependency edges; freshness validators beyond
status passthrough; sub-task and delegation scope derivation;
conflict resolution policy (grouping only in v1).
