/**
 * Independent validators, ported from the Python reference. Every
 * success legality is recomputed from explicit inputs rather than
 * trusted from engine internals.
 */
import type { ContextBundle } from "./bundle.ts";
import type { CompilationResult, ContextCandidate, ContextRequest } from "./domain.ts";
import type { CompilerPolicy } from "./policy.ts";
export declare function validateBundle(bundle: ContextBundle, request: ContextRequest, candidates: readonly ContextCandidate[], _policy: CompilerPolicy): string[];
export declare function validateResult(result: CompilationResult, request: ContextRequest, candidates: readonly ContextCandidate[]): string[];
//# sourceMappingURL=validation.d.ts.map