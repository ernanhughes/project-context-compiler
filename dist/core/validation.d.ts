/**
 * Independent validators. Every success legality is recomputed from
 * explicit inputs rather than trusted from engine internals. That
 * includes the four hard-eligibility predicates, which are written out
 * again here on purpose: a checker that asked the engine whether a
 * candidate was legal could only agree with the engine.
 */
import type { ContextBundle } from "./bundle.ts";
import type { CompilationResult, ContextCandidate, ContextRequest } from "./domain.ts";
import type { CompilerPolicy } from "./policy.ts";
export declare function validateBundle(bundle: ContextBundle, request: ContextRequest, candidates: readonly ContextCandidate[], _policy: CompilerPolicy): string[];
export declare function validateResult(result: CompilationResult, request: ContextRequest, candidates: readonly ContextCandidate[]): string[];
//# sourceMappingURL=validation.d.ts.map