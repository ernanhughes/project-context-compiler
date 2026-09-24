/**
 * Deterministic staged compiler. Behavioural port of the Python
 * reference (tag python-v0.1.0): same pipeline, same decisions, same
 * trace evidence. No redesign, no new heuristics.
 *
 * Pipeline:
 * validate inputs -> explicit required-source check -> hard
 * eligibility gates -> mandatory admission -> required admission ->
 * preferred/discretionary greedy -> alternative closeout ->
 * deterministic ordering -> render + exact budget validation +
 * repair -> trace + bundle-or-failure.
 *
 * Purity: no filesystem, network, models, env, clock, randomness,
 * subprocesses. Inputs are never mutated. Ordering uses an explicit
 * code-point string comparator (matches Python `sorted` for the
 * supported ID vocabulary; no locale-sensitive comparison).
 */
import type { CompilationResult, ContextCandidate, ContextRequest, RequirementClass } from "./domain.ts";
import { type ContextBundle } from "./bundle.ts";
import type { CompilerPolicy } from "./policy.ts";
export declare const SEPARATOR = "\n---\n";
export declare const SEPARATOR_TOKENS: number;
export declare const BAND_ORDER: readonly RequirementClass[];
/** Deterministic string order, mirroring Python code-point sorting. */
export declare function compareStrings(a: string, b: string): number;
export interface CompileOutput {
    readonly bundle: ContextBundle | null;
    readonly result: CompilationResult;
}
export declare function headerTokens(request: ContextRequest): number;
export declare function decorationTokens(candidate: ContextCandidate): number;
export declare function itemRenderCost(candidate: ContextCandidate): number;
export declare function eligibility(candidate: ContextCandidate): [boolean, string, string];
export declare function closureIds(recordId: string, byId: ReadonlyMap<string, ContextCandidate>): string[];
export declare function compileContext(request: ContextRequest, candidates: readonly ContextCandidate[], policy: CompilerPolicy): CompileOutput;
export declare function validateInputs(request: ContextRequest, candidates: readonly ContextCandidate[]): string[];
export declare function dependsOnId(candidateId: string, live: readonly ContextCandidate[]): boolean;
//# sourceMappingURL=engine.d.ts.map