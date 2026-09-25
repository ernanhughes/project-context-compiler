/**
 * Canonical compiler core. Dependency-free apart from Node builtins:
 * nothing here may import OpenCode, models, network, or filesystem
 * modules. See the architecture test pinning this boundary.
 */

export {
  BUNDLE_SCHEMA,
  ITEM_SCHEMA_VERSION,
  buildBundle,
  bundleFromJSON,
  bundleToJSON,
  checkLayout,
  contentHash,
  renderedTokenTotal,
  type ContextBundle,
} from "./bundle.ts";
export {
  COMPILATION_RESULT_SCHEMA,
  COMPILE_FAILURE_SCHEMA,
  CONTEXT_CANDIDATE_SCHEMA,
  CONTEXT_REQUEST_SCHEMA,
  DECISION_TRACE_SCHEMA,
  DECISION_TRACE_SCHEMA_V1,
  COMPILATION_RESULT_SCHEMA_V1,
  FAILURE_REASONS,
  REQUIREMENT_CLASSES,
  TRACE_DECISIONS,
  candidateFromJSON,
  candidateToJSON,
  failureFromJSON,
  failureToJSON,
  parseFailureReason,
  parseRequirementClass,
  parseTraceDecision,
  requestFromJSON,
  requestToJSON,
  resultFromJSON,
  resultToJSON,
  resultToV1JSON,
  traceEntryFromJSON,
  traceEntryToJSON,
  traceFromJSON,
  traceToJSON,
  traceToV1JSON,
  type CompilationResult,
  type CompileFailure,
  type ContextCandidate,
  type ContextRequest,
  type DecisionTrace,
  type FailureReason,
  type RequirementClass,
  type TraceDecision,
  type TraceEntry,
} from "./domain.ts";
export {
  BAND_ORDER,
  SEPARATOR,
  SEPARATOR_TOKENS,
  closureIds,
  compareStrings,
  compileContext,
  decorationTokens,
  dependsOnId,
  eligibility,
  headerTokens,
  itemRenderCost,
  validateInputs,
} from "./engine.ts";
export type { CompileOutput } from "./engine.ts";
export {
  ITEM_SCHEMA,
  itemFromJSON,
  itemToJSON,
  makeItem,
  type ContextItem,
} from "./items.ts";
export {
  COMPILER_POLICY_SCHEMA,
  DEFAULT_ORDER_ROLES,
  DEFAULT_POLICY_VERSION,
  defaultPolicy,
  policyFromJSON,
  policyToJSON,
  type CompilerPolicy,
} from "./policy.ts";
export { BUNDLE_CLOSE, BUNDLE_OPEN, renderBundleText } from "./render.ts";
export { estimateTokens, pythonRoundHalfEven, splitWords } from "./tokens.ts";
export { validateBundle, validateResult } from "./validation.ts";
