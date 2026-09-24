/**
 * Explicit versioned compiler policy (compiler-policy-v1 port).
 * Behaviour lives in engine.ts; numbers live here.
 */
export declare const COMPILER_POLICY_SCHEMA = "project_context.compiler_policy.v1";
export declare const DEFAULT_POLICY_VERSION = "compiler-policy-v1";
export declare const DEFAULT_ORDER_ROLES: readonly string[];
export interface CompilerPolicy {
    readonly policyVersion: string;
    readonly minDiscretionaryRelevance: number;
    readonly mandatoryForm: string;
    readonly orderRoles: readonly string[];
    readonly repair: string;
}
export declare function policyToJSON(policy: CompilerPolicy): Record<string, unknown>;
export declare function policyFromJSON(data: unknown): CompilerPolicy;
export declare function defaultPolicy(): CompilerPolicy;
//# sourceMappingURL=policy.d.ts.map