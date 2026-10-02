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
export const BUILDER_VERSION = "candidate-builder-v1";
export const BUILDER_POLICY_SCHEMA = "project_context.builder_policy.v1";
/** Where a metadata value came from. Unknown is never silently guessed. */
export const FIELD_PROVENANCE = [
    "observed",
    "declared",
    "derived",
    "policy",
    "neutral",
    "unknown",
];
export function defaultBuilderPolicy() {
    return {
        policyVersion: "builder-policy-v1",
        requirementBySource: {
            instruction: "MANDATORY",
            file: "PREFERRED",
            tool: "PREFERRED",
            "working-state": "PREFERRED",
            memory: "DISCRETIONARY",
            retrieval: "DISCRETIONARY",
        },
        floorByRetention: {
            pin: 3,
            exact: 3,
            compressible: 0,
            externalizable: 0,
            refetchable: 0,
            discardable: 0,
        },
        authorityTable: {
            "project-rule": {
                eligible: true,
                reason: "project rule: authorised source class",
            },
            "user-instruction": {
                eligible: true,
                reason: "user instruction: authorised source class",
            },
            "repository-source": {
                eligible: true,
                reason: "repository source: authorised as evidence",
            },
            "tool-output": {
                eligible: true,
                reason: "tool output: authorised as observation",
            },
            "tool-definition": {
                eligible: true,
                reason: "tool definition: authorised capability record",
            },
            "working-state": {
                eligible: true,
                reason: "working state: authorised as provisional evidence",
            },
            memory: {
                eligible: true,
                reason: "memory: authorised as evidence, admission decides use",
            },
            "retrieved-external": {
                eligible: true,
                reason: "retrieved external source: authorised as evidence",
            },
            "model-summary": {
                eligible: true,
                reason: "model-generated summary: authorised as derived evidence",
            },
        },
        unknownFreshness: "eligible",
        compactWords: 40,
        emitAnchor: true,
        emitReference: true,
    };
}
export const BUILD_FAILURE_CODES = [
    "SOURCE_UNAVAILABLE",
    "ADAPTER_FAILURE",
    "MALFORMED_OBSERVATION",
    "UNSUPPORTED_SOURCE",
    "INVALID_CANDIDATE",
    "IDENTITY_COLLISION",
    "REPRESENTATION_FAILURE",
    "UNRESOLVED_PROVENANCE",
    "METADATA_DERIVATION_FAILURE",
    "INVALID_DEPENDENCY",
    "CYCLIC_DEPENDENCY",
    "UNRESOLVED_SCOPE",
    "VALIDATION_UNAVAILABLE",
    "MODEL_JUDGE_FAILURE",
];
//# sourceMappingURL=types.js.map