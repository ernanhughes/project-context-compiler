/**
 * Compiler domain records (v1). Behavioural port of the Python
 * reference (tag python-v0.1.0): same records, same schema strings,
 * same serialized field order, same nulls.
 *
 * Records are readonly interfaces. Construction and parsing go
 * through explicit functions that throw on unsupported schemas or
 * illegal enum values — never silent coercion.
 */
export const CONTEXT_CANDIDATE_SCHEMA = "project_context.context_candidate.v1";
export const CONTEXT_REQUEST_SCHEMA = "project_context.context_request.v1";
/**
 * Trace and result schemas are at v2. v1 is the serialisation the
 * Python reference and its frozen goldens use: `budget_after` repeated
 * `budget_before`, `dependency_closure` was always empty, and there was
 * no `pulled_in_by`. v1 documents are still readable, and `traceToV1JSON`
 * / `resultToV1JSON` project a v2 result onto that historical shape so
 * parity with the frozen goldens stays checkable. Candidate, request,
 * bundle and failure schemas are unchanged.
 */
export const DECISION_TRACE_SCHEMA = "project_context.decision_trace.v2";
export const DECISION_TRACE_SCHEMA_V1 = "project_context.decision_trace.v1";
export const COMPILE_FAILURE_SCHEMA = "project_context.compile_failure.v1";
export const COMPILATION_RESULT_SCHEMA = "project_context.compilation_result.v2";
export const COMPILATION_RESULT_SCHEMA_V1 = "project_context.compilation_result.v1";
export const REQUIREMENT_CLASSES = [
    "MANDATORY",
    "REQUIRED",
    "PREFERRED",
    "DISCRETIONARY",
];
export const TRACE_DECISIONS = [
    "ADMITTED",
    "REJECTED_HARD",
    "REJECTED_BUDGET",
    "REJECTED_REDUNDANT",
    "REJECTED_ALTERNATIVE",
    "REJECTED_DEPENDENCY",
];
export const FAILURE_REASONS = [
    "INSUFFICIENT_BUDGET",
    "UNSATISFIED_DEPENDENCY",
    "NO_LEGAL_REPRESENTATION",
    "UNRESOLVED_REQUIRED_GROUP",
    "REQUIRED_SOURCE_UNAVAILABLE",
    "REQUIRED_INELIGIBLE",
];
function checkEnum(kind, values, raw) {
    if (typeof raw === "string" && values.includes(raw)) {
        return raw;
    }
    throw new Error(`unsupported ${kind}: ${JSON.stringify(raw)}`);
}
export function parseRequirementClass(raw) {
    return checkEnum("RequirementClass", REQUIREMENT_CLASSES, raw);
}
export function parseTraceDecision(raw) {
    return checkEnum("TraceDecision", TRACE_DECISIONS, raw);
}
export function parseFailureReason(raw) {
    return checkEnum("FailureReason", FAILURE_REASONS, raw);
}
export function candidateToJSON(c) {
    return {
        schema_version: CONTEXT_CANDIDATE_SCHEMA,
        candidate_id: c.candidateId,
        content_identity: c.contentIdentity,
        representation_id: c.representationId,
        form_rank: c.formRank,
        min_rank: c.minRank,
        source_kind: c.sourceKind,
        source_ref: c.sourceRef,
        kind: c.kind,
        content: c.content,
        token_count: c.tokenCount,
        token_source: c.tokenSource,
        requirement: c.requirement,
        order_role: c.orderRole,
        scope_eligible: c.scopeEligible,
        scope_reason: c.scopeReason,
        freshness_eligible: c.freshnessEligible,
        freshness_reason: c.freshnessReason,
        authority_eligible: c.authorityEligible,
        authority_reason: c.authorityReason,
        depends_on: [...c.dependsOn],
        group_id: c.groupId,
        group_required: c.groupRequired,
        coverage_keys: [...c.coverageKeys],
        relevance: c.relevance,
        is_default_form: c.isDefaultForm,
    };
}
function strField(data, key) {
    const value = data[key];
    if (typeof value !== "string")
        throw new Error(`invalid ${key}`);
    return value;
}
function numField(data, key) {
    const value = data[key];
    if (typeof value !== "number")
        throw new Error(`invalid ${key}`);
    return value;
}
function boolField(data, key) {
    const value = data[key];
    if (typeof value !== "boolean")
        throw new Error(`invalid ${key}`);
    return value;
}
function strList(data, key) {
    const value = data[key] ?? [];
    if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
        throw new Error(`invalid ${key}`);
    }
    return [...value];
}
function optStr(data, key, fallback) {
    const value = data[key];
    if (value === undefined || value === null)
        return fallback;
    if (typeof value !== "string")
        throw new Error(`invalid ${key}`);
    return value;
}
export function candidateFromJSON(data) {
    if (typeof data !== "object" || data === null) {
        throw new Error("candidate is not an object");
    }
    const raw = data;
    const version = (raw["schema_version"] ?? CONTEXT_CANDIDATE_SCHEMA);
    if (version !== CONTEXT_CANDIDATE_SCHEMA) {
        throw new Error(`unsupported ContextCandidate schema: ${JSON.stringify(version)}`);
    }
    const groupId = raw["group_id"] ?? null;
    if (groupId !== null && typeof groupId !== "string") {
        throw new Error("invalid group_id");
    }
    return {
        candidateId: strField(raw, "candidate_id"),
        contentIdentity: strField(raw, "content_identity"),
        representationId: strField(raw, "representation_id"),
        formRank: numField(raw, "form_rank"),
        minRank: numField(raw, "min_rank"),
        sourceKind: strField(raw, "source_kind"),
        sourceRef: strField(raw, "source_ref"),
        kind: strField(raw, "kind"),
        content: strField(raw, "content"),
        tokenCount: numField(raw, "token_count"),
        tokenSource: optStr(raw, "token_source", "approximation"),
        requirement: parseRequirementClass(raw["requirement"]),
        orderRole: strField(raw, "order_role"),
        scopeEligible: boolField(raw, "scope_eligible"),
        scopeReason: optStr(raw, "scope_reason", ""),
        freshnessEligible: boolField(raw, "freshness_eligible"),
        freshnessReason: optStr(raw, "freshness_reason", ""),
        authorityEligible: boolField(raw, "authority_eligible"),
        authorityReason: optStr(raw, "authority_reason", ""),
        dependsOn: strList(raw, "depends_on"),
        groupId,
        groupRequired: Boolean(raw["group_required"] ?? false),
        coverageKeys: strList(raw, "coverage_keys"),
        relevance: Number(raw["relevance"] ?? 0.0),
        isDefaultForm: Boolean(raw["is_default_form"] ?? false),
    };
}
export function requestToJSON(r) {
    return {
        schema_version: CONTEXT_REQUEST_SCHEMA,
        request_id: r.requestId,
        task_id: r.taskId,
        usable_token_budget: r.usableTokenBudget,
        created_at: r.createdAt,
        active_scope: r.activeScope,
        required_ids: [...r.requiredIds],
        policy_version: r.policyVersion,
    };
}
export function requestFromJSON(data) {
    if (typeof data !== "object" || data === null) {
        throw new Error("request is not an object");
    }
    const raw = data;
    const version = (raw["schema_version"] ?? CONTEXT_REQUEST_SCHEMA);
    if (version !== CONTEXT_REQUEST_SCHEMA) {
        throw new Error(`unsupported ContextRequest schema: ${JSON.stringify(version)}`);
    }
    const budget = raw["usable_token_budget"];
    if (typeof budget !== "number" || !Number.isInteger(budget) || budget < 0) {
        throw new Error(`invalid usable_token_budget: ${JSON.stringify(budget)}`);
    }
    return {
        requestId: strField(raw, "request_id"),
        taskId: strField(raw, "task_id"),
        usableTokenBudget: budget,
        createdAt: strField(raw, "created_at"),
        activeScope: optStr(raw, "active_scope", ""),
        requiredIds: strList(raw, "required_ids"),
        policyVersion: optStr(raw, "policy_version", "compiler-policy-v1"),
    };
}
export function traceEntryToJSON(e) {
    return {
        candidate_id: e.candidateId,
        content_identity: e.contentIdentity,
        representation_id: e.representationId,
        decision: e.decision,
        reason_code: e.reasonCode,
        reason_detail: e.reasonDetail,
        priority_band: e.priorityBand,
        relevance: e.relevance,
        marginal_cost: e.marginalCost,
        dependency_closure: [...e.dependencyClosure],
        pulled_in_by: [...e.pulledInBy],
        budget_before: e.budgetBefore,
        budget_after: e.budgetAfter,
        position: e.position,
    };
}
export function traceEntryFromJSON(data) {
    if (typeof data !== "object" || data === null) {
        throw new Error("trace entry is not an object");
    }
    const raw = data;
    const position = raw["position"] ?? null;
    if (position !== null && typeof position !== "number") {
        throw new Error("invalid position");
    }
    return {
        candidateId: strField(raw, "candidate_id"),
        contentIdentity: strField(raw, "content_identity"),
        representationId: strField(raw, "representation_id"),
        decision: parseTraceDecision(raw["decision"]),
        reasonCode: strField(raw, "reason_code"),
        reasonDetail: optStr(raw, "reason_detail", ""),
        priorityBand: optStr(raw, "priority_band", ""),
        relevance: Number(raw["relevance"] ?? 0.0),
        marginalCost: Number.isInteger(raw["marginal_cost"])
            ? raw["marginal_cost"]
            : parseInt(String(raw["marginal_cost"] ?? 0), 10),
        dependencyClosure: strList(raw, "dependency_closure"),
        pulledInBy: strList(raw, "pulled_in_by"),
        budgetBefore: Number.isInteger(raw["budget_before"])
            ? raw["budget_before"]
            : parseInt(String(raw["budget_before"] ?? 0), 10),
        budgetAfter: Number.isInteger(raw["budget_after"])
            ? raw["budget_after"]
            : parseInt(String(raw["budget_after"] ?? 0), 10),
        position,
    };
}
export function traceEntryToV1JSON(e) {
    const { pulled_in_by: _dropped, ...rest } = traceEntryToJSON(e);
    void _dropped;
    return { ...rest, dependency_closure: [], budget_after: e.budgetBefore };
}
/** Project a trace onto the v1 shape (Python reference serialisation). */
export function traceToV1JSON(t) {
    return {
        schema_version: DECISION_TRACE_SCHEMA_V1,
        request_id: t.requestId,
        policy_version: t.policyVersion,
        entries: t.entries.map(traceEntryToV1JSON),
    };
}
export function traceToJSON(t) {
    if (t.legacySchema === "v1")
        return traceToV1JSON(t);
    return {
        schema_version: DECISION_TRACE_SCHEMA,
        request_id: t.requestId,
        policy_version: t.policyVersion,
        entries: t.entries.map(traceEntryToJSON),
    };
}
export function traceFromJSON(data) {
    if (typeof data !== "object" || data === null) {
        throw new Error("trace is not an object");
    }
    const raw = data;
    const version = (raw["schema_version"] ?? DECISION_TRACE_SCHEMA);
    if (version !== DECISION_TRACE_SCHEMA &&
        version !== DECISION_TRACE_SCHEMA_V1) {
        throw new Error(`unsupported DecisionTrace schema: ${JSON.stringify(version)}`);
    }
    const entries = raw["entries"] ?? [];
    if (!Array.isArray(entries))
        throw new Error("invalid entries");
    const trace = {
        requestId: strField(raw, "request_id"),
        policyVersion: optStr(raw, "policy_version", ""),
        entries: entries.map(traceEntryFromJSON),
    };
    return version === DECISION_TRACE_SCHEMA_V1
        ? { ...trace, legacySchema: "v1" }
        : trace;
}
export function failureToJSON(f) {
    return {
        schema_version: COMPILE_FAILURE_SCHEMA,
        request_id: f.requestId,
        policy_version: f.policyVersion,
        reason: f.reason,
        blocking_ids: [...f.blockingIds],
        budget_used: f.budgetUsed,
        budget_total: f.budgetTotal,
        diagnostic: f.diagnostic,
    };
}
export function failureFromJSON(data) {
    if (typeof data !== "object" || data === null) {
        throw new Error("failure is not an object");
    }
    const raw = data;
    const version = (raw["schema_version"] ?? COMPILE_FAILURE_SCHEMA);
    if (version !== COMPILE_FAILURE_SCHEMA) {
        throw new Error(`unsupported CompileFailure schema: ${JSON.stringify(version)}`);
    }
    return {
        requestId: strField(raw, "request_id"),
        policyVersion: optStr(raw, "policy_version", ""),
        reason: parseFailureReason(raw["reason"]),
        blockingIds: strList(raw, "blocking_ids"),
        budgetUsed: Number.isInteger(raw["budget_used"])
            ? raw["budget_used"]
            : parseInt(String(raw["budget_used"] ?? 0), 10),
        budgetTotal: Number.isInteger(raw["budget_total"])
            ? raw["budget_total"]
            : parseInt(String(raw["budget_total"] ?? 0), 10),
        diagnostic: optStr(raw, "diagnostic", ""),
    };
}
export function resultToV1JSON(r) {
    return {
        ...resultToJSON(r),
        schema_version: COMPILATION_RESULT_SCHEMA_V1,
        trace: traceToV1JSON(r.trace),
    };
}
export function resultToJSON(r) {
    return {
        schema_version: r.trace.legacySchema === "v1"
            ? COMPILATION_RESULT_SCHEMA_V1
            : COMPILATION_RESULT_SCHEMA,
        request_id: r.requestId,
        policy_version: r.policyVersion,
        success: r.success,
        bundle_id: r.bundleId,
        bundle_tokens: r.bundleTokens,
        bundle_hash: r.bundleHash,
        trace: traceToJSON(r.trace),
        failure: r.failure ? failureToJSON(r.failure) : null,
    };
}
export function resultFromJSON(data) {
    if (typeof data !== "object" || data === null) {
        throw new Error("result is not an object");
    }
    const raw = data;
    const version = (raw["schema_version"] ??
        COMPILATION_RESULT_SCHEMA);
    if (version !== COMPILATION_RESULT_SCHEMA &&
        version !== COMPILATION_RESULT_SCHEMA_V1) {
        throw new Error(`unsupported CompilationResult schema: ${JSON.stringify(version)}`);
    }
    const failure = raw["failure"] ?? null;
    const bundleId = raw["bundle_id"] ?? null;
    const bundleTokens = raw["bundle_tokens"] ?? null;
    const bundleHash = raw["bundle_hash"] ?? null;
    if (bundleId !== null && typeof bundleId !== "string") {
        throw new Error("invalid bundle_id");
    }
    if (bundleTokens !== null && typeof bundleTokens !== "number") {
        throw new Error("invalid bundle_tokens");
    }
    if (bundleHash !== null && typeof bundleHash !== "string") {
        throw new Error("invalid bundle_hash");
    }
    return {
        requestId: strField(raw, "request_id"),
        policyVersion: optStr(raw, "policy_version", ""),
        success: Boolean(raw["success"]),
        bundleId,
        bundleTokens,
        bundleHash,
        trace: traceFromJSON(raw["trace"]),
        failure: failure ? failureFromJSON(failure) : null,
    };
}
//# sourceMappingURL=domain.js.map