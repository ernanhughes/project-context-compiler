/**
 * Compiler domain records (v1). Behavioural port of the Python
 * reference (tag python-v0.1.0): same records, same schema strings,
 * same serialized field order, same nulls.
 *
 * Records are readonly interfaces. Construction and parsing go
 * through explicit functions that throw on unsupported schemas or
 * illegal enum values — never silent coercion.
 */
export declare const CONTEXT_CANDIDATE_SCHEMA = "project_context.context_candidate.v1";
export declare const CONTEXT_REQUEST_SCHEMA = "project_context.context_request.v1";
export declare const DECISION_TRACE_SCHEMA = "project_context.decision_trace.v1";
export declare const COMPILE_FAILURE_SCHEMA = "project_context.compile_failure.v1";
export declare const COMPILATION_RESULT_SCHEMA = "project_context.compilation_result.v1";
export declare const REQUIREMENT_CLASSES: readonly ["MANDATORY", "REQUIRED", "PREFERRED", "DISCRETIONARY"];
export type RequirementClass = (typeof REQUIREMENT_CLASSES)[number];
export declare const TRACE_DECISIONS: readonly ["ADMITTED", "REJECTED_HARD", "REJECTED_BUDGET", "REJECTED_REDUNDANT", "REJECTED_ALTERNATIVE", "REJECTED_DEPENDENCY", "REJECTED_GROUP"];
export type TraceDecision = (typeof TRACE_DECISIONS)[number];
export declare const FAILURE_REASONS: readonly ["INSUFFICIENT_BUDGET", "UNSATISFIED_DEPENDENCY", "NO_LEGAL_REPRESENTATION", "UNRESOLVED_REQUIRED_GROUP", "REQUIRED_SOURCE_UNAVAILABLE", "REQUIRED_INELIGIBLE"];
export type FailureReason = (typeof FAILURE_REASONS)[number];
export declare function parseRequirementClass(raw: unknown): RequirementClass;
export declare function parseTraceDecision(raw: unknown): TraceDecision;
export declare function parseFailureReason(raw: unknown): FailureReason;
export interface ContextCandidate {
    readonly candidateId: string;
    readonly contentIdentity: string;
    readonly representationId: string;
    readonly formRank: number;
    readonly minRank: number;
    readonly sourceKind: string;
    readonly sourceRef: string;
    readonly kind: string;
    readonly content: string;
    readonly tokenCount: number;
    readonly tokenSource: string;
    readonly requirement: RequirementClass;
    readonly orderRole: string;
    readonly scopeEligible: boolean;
    readonly scopeReason: string;
    readonly freshnessEligible: boolean;
    readonly freshnessReason: string;
    readonly authorityEligible: boolean;
    readonly authorityReason: string;
    readonly dependsOn: readonly string[];
    readonly groupId: string | null;
    readonly groupRequired: boolean;
    readonly coverageKeys: readonly string[];
    readonly relevance: number;
    readonly isDefaultForm: boolean;
}
export declare function candidateToJSON(c: ContextCandidate): Record<string, unknown>;
export declare function candidateFromJSON(data: unknown): ContextCandidate;
export interface ContextRequest {
    readonly requestId: string;
    readonly taskId: string;
    readonly usableTokenBudget: number;
    readonly createdAt: string;
    readonly activeScope: string;
    readonly requiredIds: readonly string[];
    readonly policyVersion: string;
}
export declare function requestToJSON(r: ContextRequest): Record<string, unknown>;
export declare function requestFromJSON(data: unknown): ContextRequest;
export interface TraceEntry {
    readonly candidateId: string;
    readonly contentIdentity: string;
    readonly representationId: string;
    readonly decision: TraceDecision;
    readonly reasonCode: string;
    readonly reasonDetail: string;
    readonly priorityBand: string;
    readonly relevance: number;
    readonly marginalCost: number;
    readonly dependencyClosure: readonly string[];
    readonly budgetBefore: number;
    readonly budgetAfter: number;
    readonly position: number | null;
}
export declare function traceEntryToJSON(e: TraceEntry): Record<string, unknown>;
export declare function traceEntryFromJSON(data: unknown): TraceEntry;
export interface DecisionTrace {
    readonly requestId: string;
    readonly policyVersion: string;
    readonly entries: readonly TraceEntry[];
}
export declare function traceToJSON(t: DecisionTrace): Record<string, unknown>;
export declare function traceFromJSON(data: unknown): DecisionTrace;
export interface CompileFailure {
    readonly requestId: string;
    readonly policyVersion: string;
    readonly reason: FailureReason;
    readonly blockingIds: readonly string[];
    readonly budgetUsed: number;
    readonly budgetTotal: number;
    readonly diagnostic: string;
}
export declare function failureToJSON(f: CompileFailure): Record<string, unknown>;
export declare function failureFromJSON(data: unknown): CompileFailure;
export interface CompilationResult {
    readonly requestId: string;
    readonly policyVersion: string;
    readonly success: boolean;
    readonly bundleId: string | null;
    readonly bundleTokens: number | null;
    readonly bundleHash: string | null;
    readonly trace: DecisionTrace;
    readonly failure: CompileFailure | null;
}
export declare function resultToJSON(r: CompilationResult): Record<string, unknown>;
export declare function resultFromJSON(data: unknown): CompilationResult;
//# sourceMappingURL=domain.d.ts.map