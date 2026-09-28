/**
 * Candidate Builder: available information in, ContextCandidate[] out.
 * The builder establishes what *could* enter context and makes those
 * possibilities comparable. It never decides admission, rank, budget
 * fit, transport, or usefulness — those stay downstream.
 */

export {
  BUILDER_VERSION,
  BUILDER_POLICY_SCHEMA,
  FIELD_PROVENANCE,
  BUILD_FAILURE_CODES,
  defaultBuilderPolicy,
  type AvailableInformation,
  type BuilderMetrics,
  type BuilderPolicy,
  type BuilderRequest,
  type BuilderTrace,
  type BuildFailureCode,
  type BuildOutput,
  type BuildRejection,
  type ConflictGroup,
  type DependencyEdge,
  type FieldDerivation,
  type FieldProvenance,
  type FileInput,
  type InstructionInput,
  type MemoryInput,
  type RetrievalInput,
  type SourceObservation,
  type StateInput,
  type ToolInput,
} from "./types.ts";
export { discover, type Discovery } from "./adapters.ts";
export { buildCandidates } from "./builder.ts";
