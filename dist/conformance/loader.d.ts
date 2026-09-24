/**
 * Strict JSON loaders for compiler-v1 fixture files. Port of the
 * Python reference: unknown keys are rejected so malformed inputs
 * fail loudly. Truth files are never touched here.
 */
import { type ContextCandidate, type ContextRequest } from "../core/domain.ts";
export declare const CANDIDATE_KEYS: ReadonlySet<string>;
export declare const REQUEST_KEYS: ReadonlySet<string>;
export declare function loadCandidateFile(path: string): ContextCandidate[];
export declare function loadRequestFile(path: string): ContextRequest;
export declare function loadFixtureSet(root: string): Record<string, {
    candidates: string;
    request: string;
}>;
//# sourceMappingURL=loader.d.ts.map