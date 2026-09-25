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

Use it three ways:

```text
TypeScript library
CLI / JSON boundary
OpenCode plugin
```

## Library

```ts
import {
  compileContext,
  defaultPolicy,
  validateBundle,
  validateResult,
  renderBundleText,
  type ContextCandidate,
  type ContextRequest,
  type CompilerPolicy,
  type CompileOutput,
} from "project-context-compiler/core";
```

```ts
const output: CompileOutput = compileContext(
  request,
  candidates,
  defaultPolicy(),
);

if (output.result.success) {
  const bundle = output.bundle; // exact ordered ContextBundle
  const trace = output.result.trace; // complete DecisionTrace
} else {
  console.log(output.result.failure?.reason); // machine-readable, never a guess
}
```

The core (`project-context-compiler/core`) has zero runtime
dependencies beyond Node builtins: no models, no network, no
OpenCode. Identical inputs yield identical outputs.

## Worked example

More than top-k:

```text
Candidate A:  relevance 0.95, wrong scope
Candidate B:  REQUIRED, depends on tool definition C
Candidate D:  DISCRETIONARY, cheap, relevance 0.1
Budget:       finite
```

```text
A rejected by the hard scope gate (relevance is irrelevant)

B admitted only if B + C both fit, with C emitted once

D excluded despite spare capacity (earns nothing)

or an explicit CompileFailure if B + C cannot legally fit
```

## Failure is a feature

> If no legal bundle exists, Context Compiler reports failure
> instead of fabricating one by silently truncating required
> information.

```text
INSUFFICIENT_BUDGET
UNSATISFIED_DEPENDENCY
NO_LEGAL_REPRESENTATION
UNRESOLVED_REQUIRED_GROUP
REQUIRED_SOURCE_UNAVAILABLE
REQUIRED_INELIGIBLE
```

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

The CLI is the language-neutral boundary: the Python research
harness in `project-context` drives the TypeScript compiler
through JSON files. Historical runs pin the Python reference
(`python-v0.1.0` tag); new use goes through this CLI.

## OpenCode plugin

Install directly from GitHub:

```powershell
opencode plugin add github:ernanhughes/project-context-compiler
opencode plugin check
opencode plugin update
```

This registers three explicit tools and nothing else:

```text
context_compiler_compile
context_compiler_validate
context_compiler_inspect
```

> Installing the plugin does not automatically recompile or mutate
> OpenCode model context. The plugin exposes explicit deterministic
> compiler operations. Automatic assembly belongs to a later
> integration layer once candidate construction is explicit.

Capture/injection/observation remain owned by
[Project Context OpenCode](https://github.com/ernanhughes/project-context-opencode),
which can import this package directly:

```ts
import {
  compileContext,
  renderBundleText,
} from "project-context-compiler/core";
```

## Conformance

The canonical compiler-v1 suite (14 fixtures × 3 budgets) plus
the frozen Python v0.1.0 golden outputs ship with the package:

```powershell
context-compiler conformance
node --test tests/conformance/parity.test.ts
```

```text
cases: 42
semantic mismatches: 0
PASS
```

## Versions

```text
0.1.0 = Python reference implementation (tag python-v0.1.0)
0.2.0 = TypeScript canonical implementation
0.3.0 = DecisionTrace and CompilationResult v2 (populated dependency
        closure, real budget accounting, pulledInBy); mandatory_form
        enforced; validators independent of the engine; selection unchanged
```

Retrieve the Python source any time with:

```text
git checkout python-v0.1.0
```

Serialized `project_context.*.v1` schemas were unchanged across the
port: a language move is not a schema change. Trace and result moved to
v2 in 0.3.0 because the meaning of their fields changed; v1 documents
are still read and `traceToV1JSON` / `resultToV1JSON` project onto them.

## Ecosystem

```text
project-context
    research / experiments / evidence
project-context-compiler (this package)
    deterministic context assembly
project-context-opencode
    OpenCode transport / intervention / observation
```

```text
Context Compiler:
    What exact context should this computation receive?

Project Context OpenCode:
    Did that context actually reach the OpenCode model-context boundary?

Project Context:
    Did supplying it change behaviour, and was the change useful?
```

## Positioning

Structural guarantees under explicit inputs and policies:

```text
deterministic
budget-bounded
policy-governed
traceable
explicit failure
reproducible
```

Not claimed: optimal context, better answers, automatic
understanding of arbitrary repositories, retrieval replacement.
Behavioural usefulness is a separate empirical question.

## Develop

```powershell
npm install
npm run typecheck
npm test
npm run lint
```

## Licence

Apache-2.0. See `LICENSE`.
