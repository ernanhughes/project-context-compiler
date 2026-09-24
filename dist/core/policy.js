/**
 * Explicit versioned compiler policy (compiler-policy-v1 port).
 * Behaviour lives in engine.ts; numbers live here.
 */
export const COMPILER_POLICY_SCHEMA = "project_context.compiler_policy.v1";
export const DEFAULT_POLICY_VERSION = "compiler-policy-v1";
export const DEFAULT_ORDER_ROLES = [
    "instruction",
    "task",
    "state",
    "evidence",
    "support",
    "tool",
];
export function policyToJSON(policy) {
    return {
        schema_version: COMPILER_POLICY_SCHEMA,
        policy_version: policy.policyVersion,
        min_discretionary_relevance: policy.minDiscretionaryRelevance,
        mandatory_form: policy.mandatoryForm,
        order_roles: [...policy.orderRoles],
        repair: policy.repair,
    };
}
export function policyFromJSON(data) {
    if (typeof data !== "object" || data === null) {
        throw new Error("policy is not an object");
    }
    const raw = data;
    const version = (raw["schema_version"] ?? COMPILER_POLICY_SCHEMA);
    if (version !== COMPILER_POLICY_SCHEMA) {
        throw new Error(`unsupported CompilerPolicy schema: ${JSON.stringify(version)}`);
    }
    const orderRoles = raw["order_roles"] ?? [...DEFAULT_ORDER_ROLES];
    if (!Array.isArray(orderRoles) ||
        !orderRoles.every((v) => typeof v === "string")) {
        throw new Error("invalid order_roles");
    }
    return {
        policyVersion: typeof raw["policy_version"] === "string"
            ? raw["policy_version"]
            : DEFAULT_POLICY_VERSION,
        minDiscretionaryRelevance: Number(raw["min_discretionary_relevance"] ?? 0.3),
        mandatoryForm: typeof raw["mandatory_form"] === "string"
            ? raw["mandatory_form"]
            : "cheapest",
        orderRoles: [...orderRoles],
        repair: typeof raw["repair"] === "string"
            ? raw["repair"]
            : "drop-last-discretionary",
    };
}
export function defaultPolicy() {
    return {
        policyVersion: DEFAULT_POLICY_VERSION,
        minDiscretionaryRelevance: 0.3,
        mandatoryForm: "cheapest",
        orderRoles: [...DEFAULT_ORDER_ROLES],
        repair: "drop-last-discretionary",
    };
}
//# sourceMappingURL=policy.js.map