# Context Compiler

A deterministic compiler for assembling bounded,
policy-governed context for AI model invocations.

Part of the [Project Context](https://github.com/ernanhughes/project-context) ecosystem.

```text
retrieval asks:
    what information might be relevant?

context compilation asks:
    what exact legal representation should this computation receive,
    under this budget and these policies?
```

Compilation is deliberately separated from everything around it:

```text
candidate generation
≠
admission
≠
assembly
≠
rendering
≠
model evaluation
```

The compiler owns the middle problem: **admission, assembly, and
validation**. It never retrieves, never calls a model, and never
judges whether an answer was good.

## Pipeline

```text
validate inputs
  ↓
explicit required-source check
  ↓
hard eligibility gates (scope / freshness / authority / floor)
  ↓
mandatory admission (cheapest legal form, groups atomic)
  ↓
required admission
  ↓
preferred / discretionary admission (earn rule + coverage)
  ↓
alternative-form closeout
  ↓
deterministic ordering
  ↓
render + exact budget validation + policy-governed repair
  ↓
trace + bundle OR explicit failure
```

## Install

```powershell
pip install git+https://github.com/ernanhughes/project-context-compiler.git
```

Requires Python 3.11+. Zero runtime dependencies — standard library
only. No LLM, no network, no API keys.

## Use

```python
from context_compiler import (
    ContextCandidate,
    ContextRequest,
    CompilerPolicy,
    CompileOutput,
    compile_context,
    default_policy,
)

result: CompileOutput = compile_context(
    request=request,
    candidates=candidates,
    policy=default_policy(),
)

if result.result.success:
    bundle = result.bundle      # exact ordered ContextBundle
    trace = result.result.trace # complete DecisionTrace
else:
    failure = result.result.failure
    print(failure.reason)       # machine-readable, never a guess
```

## Worked example

More than top-k. Suppose:

```text
Candidate A:  relevance 0.95, wrong scope
Candidate B:  REQUIRED, depends on tool definition C
Candidate D:  DISCRETIONARY, cheap, relevance 0.1
Budget:       finite
```

Compilation gives:

```text
A rejected by the hard scope gate (relevance is irrelevant)

B admitted only if B + C both fit, with C emitted once

D excluded despite spare capacity (earns nothing: low relevance,
no new coverage) — positive slack is legal

or an explicit CompileFailure if B + C cannot legally fit
```

Relevance never launders hard illegality. Mandatory content is
never silently truncated to fit.

## Failure is a feature

If no legal bundle exists, Context Compiler reports failure instead
of fabricating one by silently truncating required information:

```python
output = compile_context(...)

if not output.result.success:
    print(output.result.failure.reason)
```

```text
INSUFFICIENT_BUDGET
UNSATISFIED_DEPENDENCY
NO_LEGAL_REPRESENTATION
UNRESOLVED_REQUIRED_GROUP
REQUIRED_SOURCE_UNAVAILABLE
REQUIRED_INELIGIBLE
```

Every failure still carries the complete decision trace, so you can
see exactly which gate each candidate hit.

## Deterministic reproducibility

```text
same request
same candidates
same policy
same token costs
=
same bundle
same trace
```

No model nondeterminism. No network. No clock. No random seed.
Thousands of cheap offline compilations behave identically.

## CLI

```powershell
context-compiler version
context-compiler conformance
context-compiler inspect heterogeneous-basic --budget medium
context-compiler compile `
    --request request.json `
    --candidates candidates.json `
    --policy policy.json `
    --output compilation.json
context-compiler validate `
    --compilation compilation.json `
    --request request.json `
    --candidates candidates.json `
    --policy policy.json
```

## Conformance

The canonical compiler-v1 suite — 14 synthetic fixtures × 3
budgets — ships with the package:

```text
context-compiler conformance
```

```text
Context Compiler conformance

fixtures: 14
budgets: 3
cases: 42

success cases: 34
expected failure cases: 8

semantic mismatches: 0
serialization mismatches: 0
budget violations: 0

PASS
```

## Trace inspection

Every considered candidate receives exactly one terminal trace
entry (`ADMITTED`, `REJECTED_HARD`, `REJECTED_BUDGET`,
`REJECTED_REDUNDANT`, `REJECTED_ALTERNATIVE`,
`REJECTED_DEPENDENCY`, `REJECTED_GROUP`) with reason codes,
marginal costs, dependency closure, and budget before/after. The
trace explains exclusions, not just admissions.

## Rendering for transport

`render_bundle_text` turns an exact bundle into exact text between
stable `[CONTEXT BUNDLE]` markers for demonstration and
integration. Downstream transports (for example
[Project Context OpenCode](https://github.com/ernanhughes/project-context-opencode))
wrap this output without changing what was admitted.

## Ecosystem

```text
project-context
    research / experiments / evidence

project-context-compiler (this package)
    deterministic context assembly

project-context-opencode
    OpenCode transport / intervention / observation
```

And the questions divide cleanly:

```text
Context Compiler:
    What should this computation receive?

Project Context OpenCode:
    Did the runtime actually receive it?

Project Context:
    Did receiving it change behaviour, and was that change useful?
```

Historical compiler experiments and frozen evidence remain in
`project-context`; this package owns the mechanism.

## Positioning

Guaranteed structural properties under explicit inputs and
policies: deterministic, budget-bounded, policy-governed,
traceable, explicitly failing when no legal bundle exists.

Not claimed: optimal context, better answers, or any behavioural
effect. Whether compiled context helps is a separate empirical
question for `project-context` experiments.

## Licence

Apache-2.0. See `LICENSE`.
