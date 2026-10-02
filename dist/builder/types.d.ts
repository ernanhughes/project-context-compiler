/**
 * Candidate Builder — types.
 *
 * Boundary: available information in, ContextCandidate[] out.
 * The builder never decides admission, rank, budget fit, transport,
 * or behavioural usefulness. It establishes what *could* enter
 * context and makes those possibilities comparable.
 *
 * Purity: no filesystem, network, models, env, clock, randomness.
 * Every timestamp is supplied by the caller. Outputs are sorted
 * by identifier so the same inputs always give the same bytes.
 */
import type { ContextCandidate, RequirementClass } from "../core/domain.ts";
export declare const BUILDER_VERSION = "candidate-builder-v1";
export declare const BUILDER_POLICY_SCHEMA = "project_context.builder_policy.v1";
/** Where a metadata value came from. Unknown is never silently guessed. */
export declare const FIELD_PROVENANCE: readonly ["observed", "declared", "derived", "policy", "neutral", "unknown"];
export type FieldProvenance = (typeof FIELD_PROVENANCE)[number];
/** What the builder was asked to build candidates for. */
export interface BuilderRequest {
    readonly requestId: string;
    readonly taskId: string;
    readonly activeScope: string;
    /** Supplied by the caller. The builder never reads a clock. */
    readonly createdAt: string;
    readonly policyVersion: string;
}
/** Heterogeneous available information. Each list may be empty. */
export interface AvailableInformation {
    readonly files?: readonly FileInput[];
    readonly instructions?: readonly InstructionInput[];
    readonly tools?: readonly ToolInput[];
    readonly states?: readonly StateInput[];
    readonly memories?: readonly MemoryInput[];
    readonly retrievals?: readonly RetrievalInput[];
}
export interface FileInput {
    readonly path: string;
    readonly revision: string;
    readonly content: string;
    readonly declaredScope?: string | null;
    readonly authorityClass?: string | null;
    readonly retention?: string | null;
    readonly requirement?: RequirementClass | null;
    readonly superseded?: boolean;
    readonly validatorStatus?: string | null;
    readonly validatorId?: string | null;
    readonly observedAt?: string | null;
}
export interface InstructionInput {
    readonly instructionId: string;
    readonly text: string;
    readonly scope?: string | null;
    readonly authorityClass?: string | null;
    readonly retention?: string | null;
    readonly requirement?: RequirementClass | null;
    readonly superseded?: boolean;
    readonly validatorStatus?: string | null;
    readonly validatorId?: string | null;
    readonly observedAt?: string | null;
}
export interface ToolInput {
    readonly callId: string;
    readonly toolName: string;
    readonly definition: string;
    readonly output: string;
    readonly status: string;
    readonly declaredScope?: string | null;
    readonly authorityClass?: string | null;
    readonly observedAt?: string | null;
}
export interface StateInput {
    readonly noteId: string;
    readonly text: string;
    readonly status: string;
    readonly declaredScope?: string | null;
    readonly authorityClass?: string | null;
    readonly observedAt?: string | null;
}
export interface MemoryInput {
    readonly memoryId: string;
    readonly text: string;
    /** current | historical | stale | superseded | unknown */
    readonly validity?: string | null;
    readonly declaredScope?: string | null;
    readonly authorityClass?: string | null;
    readonly observedAt?: string | null;
}
export interface RetrievalInput {
    readonly retrievalId: string;
    readonly text: string;
    readonly sourceRef: string;
    readonly score?: number | null;
    readonly declaredScope?: string | null;
    readonly authorityClass?: string | null;
    readonly observedAt?: string | null;
}
/**
 * Explicit builder policy. No ordering is hard-coded: requirement
 * defaults, authority verdicts, floors and form selection all come
 * from here so they can be argued with.
 */
export interface BuilderPolicy {
    readonly policyVersion: string;
    readonly requirementBySource: Readonly<Record<string, RequirementClass>>;
    readonly floorByRetention: Readonly<Record<string, number>>;
    readonly authorityTable: Readonly<Record<string, {
        readonly eligible: boolean;
        readonly reason: string;
    }>>;
    /** What to do when freshness cannot be affirmed or denied. */
    readonly unknownFreshness: "eligible" | "ineligible";
    readonly compactWords: number;
    readonly emitAnchor: boolean;
    readonly emitReference: boolean;
}
export declare function defaultBuilderPolicy(): BuilderPolicy;
/**
 * A discovered piece of information. Existence, not eligibility:
 * malformed observations are rejected here and never become
 * candidates.
 */
export interface SourceObservation {
    readonly observationId: string;
    readonly sourceType: string;
    readonly sourceIdentity: string;
    readonly locator: string;
    readonly observedVersion: string;
    readonly payload: string;
    readonly provenance: string;
    readonly declaredScope: string | null;
    readonly authorityClass: string | null;
    readonly retention: string | null;
    readonly declaredRequirement: RequirementClass | null;
    readonly superseded: boolean;
    readonly validatorStatus: string | null;
    readonly validatorId: string | null;
    readonly observedAt: string | null;
    /** Group key for structural conflict detection. Null opts out. */
    readonly conflictKey: string | null;
    readonly coverageKeys: readonly string[];
    readonly relevance: number;
    readonly relevanceProvenance: FieldProvenance;
}
export declare const BUILD_FAILURE_CODES: readonly ["SOURCE_UNAVAILABLE", "ADAPTER_FAILURE", "MALFORMED_OBSERVATION", "UNSUPPORTED_SOURCE", "INVALID_CANDIDATE", "IDENTITY_COLLISION", "REPRESENTATION_FAILURE", "UNRESOLVED_PROVENANCE", "METADATA_DERIVATION_FAILURE", "INVALID_DEPENDENCY", "CYCLIC_DEPENDENCY", "UNRESOLVED_SCOPE", "VALIDATION_UNAVAILABLE", "MODEL_JUDGE_FAILURE"];
export type BuildFailureCode = (typeof BUILD_FAILURE_CODES)[number];
export interface BuildRejection {
    readonly observationId: string;
    readonly code: BuildFailureCode;
    readonly reason: string;
}
export interface FieldDerivation {
    readonly candidateId: string;
    readonly field: string;
    readonly value: string;
    readonly provenance: FieldProvenance;
    readonly detail: string;
}
export interface DependencyEdge {
    readonly from: string;
    readonly to: string;
    readonly reason: string;
}
export interface ConflictGroup {
    readonly conflictId: string;
    readonly conflictKey: string;
    readonly members: readonly string[];
    readonly compilerGroupId: string;
}
export interface BuilderTrace {
    readonly builderVersion: string;
    readonly requestId: string;
    readonly sourcesConsulted: readonly string[];
    readonly observationsDiscovered: number;
    readonly observationsEmitted: number;
    readonly rejections: readonly BuildRejection[];
    readonly representationsGenerated: Readonly<Record<string, number>>;
    readonly derivations: readonly FieldDerivation[];
    readonly dependencies: readonly DependencyEdge[];
    readonly conflicts: readonly ConflictGroup[];
    readonly modelJudgments: readonly string[];
    readonly candidateIds: readonly string[];
    readonly cyclicDependency: boolean;
}
export interface BuilderMetrics {
    readonly availableItems: number;
    readonly observations: number;
    readonly candidatesEmitted: number;
    readonly candidatesRejected: number;
    readonly bySourceType: Readonly<Record<string, number>>;
    readonly byRepresentation: Readonly<Record<string, number>>;
    readonly deterministicDerivations: number;
    readonly modelJudgedDerivations: number;
    readonly unknownFields: number;
    readonly conflictGroups: number;
    readonly dependencyEdges: number;
    readonly candidateYield: number;
    readonly buildLatencyMs: number;
}
export interface BuildOutput {
    readonly candidates: readonly ContextCandidate[];
    readonly trace: BuilderTrace;
    readonly metrics: BuilderMetrics;
}
//# sourceMappingURL=types.d.ts.map