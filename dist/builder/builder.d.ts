/**
 * Candidate Builder: observations in, ContextCandidates out.
 *
 * For each valid observation the builder derives scope, freshness
 * and authority verdicts, a requirement class, a fidelity floor,
 * one or more representation forms with lineage, dependency edges
 * and conflict groups — then emits existing ContextCandidate
 * records unchanged in schema. Downstream compilation enforces
 * every constraint recorded here; nothing here admits, ranks,
 * budgets, transports, or judges usefulness.
 *
 * Determinism: pure functions of (request, available, policy).
 * No filesystem, network, model, env, clock or randomness. All
 * lists are sorted before output. `observedAt` values are carried
 * as opaque strings and never compared: age is not freshness.
 */
import type { AvailableInformation, BuilderPolicy, BuilderRequest, BuildOutput } from "./types.ts";
export declare function buildCandidates(request: BuilderRequest, available: AvailableInformation, policy: BuilderPolicy): BuildOutput;
//# sourceMappingURL=builder.d.ts.map