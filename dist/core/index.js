/**
 * Canonical compiler core. Dependency-free apart from Node builtins:
 * nothing here may import OpenCode, models, network, or filesystem
 * modules. See the architecture test pinning this boundary.
 */
export { BUNDLE_SCHEMA, ITEM_SCHEMA_VERSION, buildBundle, bundleFromJSON, bundleToJSON, checkLayout, contentHash, renderedTokenTotal, } from "./bundle.js";
export { COMPILATION_RESULT_SCHEMA, COMPILE_FAILURE_SCHEMA, CONTEXT_CANDIDATE_SCHEMA, CONTEXT_REQUEST_SCHEMA, DECISION_TRACE_SCHEMA, FAILURE_REASONS, REQUIREMENT_CLASSES, TRACE_DECISIONS, candidateFromJSON, candidateToJSON, failureFromJSON, failureToJSON, parseFailureReason, parseRequirementClass, parseTraceDecision, requestFromJSON, requestToJSON, resultFromJSON, resultToJSON, traceEntryFromJSON, traceEntryToJSON, traceFromJSON, traceToJSON, } from "./domain.js";
export { BAND_ORDER, SEPARATOR, SEPARATOR_TOKENS, closureIds, compareStrings, compileContext, decorationTokens, dependsOnId, eligibility, headerTokens, itemRenderCost, validateInputs, } from "./engine.js";
export { ITEM_SCHEMA, itemFromJSON, itemToJSON, makeItem, } from "./items.js";
export { COMPILER_POLICY_SCHEMA, DEFAULT_ORDER_ROLES, DEFAULT_POLICY_VERSION, defaultPolicy, policyFromJSON, policyToJSON, } from "./policy.js";
export { BUNDLE_CLOSE, BUNDLE_OPEN, renderBundleText } from "./render.js";
export { estimateTokens, pythonRoundHalfEven, splitWords } from "./tokens.js";
export { validateBundle, validateResult } from "./validation.js";
//# sourceMappingURL=index.js.map