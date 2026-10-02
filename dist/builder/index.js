/**
 * Candidate Builder: available information in, ContextCandidate[] out.
 * The builder establishes what *could* enter context and makes those
 * possibilities comparable. It never decides admission, rank, budget
 * fit, transport, or usefulness — those stay downstream.
 */
export { BUILDER_VERSION, BUILDER_POLICY_SCHEMA, FIELD_PROVENANCE, BUILD_FAILURE_CODES, defaultBuilderPolicy, } from "./types.js";
export { discover } from "./adapters.js";
export { buildCandidates } from "./builder.js";
//# sourceMappingURL=index.js.map