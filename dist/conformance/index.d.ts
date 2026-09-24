/**
 * Canonical compiler-v1 conformance matrix: 14 fixtures x 3 budgets.
 * Expectations come from the frozen manifest's structural `expected`
 * matrix — never from oracle truth files, which are not shipped.
 */
import { type CompilerPolicy } from "../core/policy.ts";
export declare const CONFORMANCE_ROOT: string;
export declare const POLICY_FILE: string;
export declare const MANIFEST_FILE: string;
export declare const BUDGETS: readonly ["tight", "medium", "roomy"];
export interface CaseOutcome {
    readonly fixture: string;
    readonly budget: string;
    readonly success: boolean;
    readonly reason: string | null;
    readonly admittedIds: readonly string[];
    readonly bundleTokens: number | null;
    readonly bundleHash: string | null;
    readonly validationProblems: readonly string[];
}
export interface ConformanceReport {
    readonly cases: number;
    readonly successCases: number;
    readonly expectedFailureCases: number;
    readonly semanticMismatches: number;
    readonly serializationMismatches: number;
    readonly budgetViolations: number;
    readonly details: readonly string[];
    readonly passed: boolean;
}
export declare function loadManifest(): {
    budgets: Record<string, Record<string, number>>;
    expected: Record<string, Record<string, {
        success: boolean;
        reason: string | null;
    }>>;
};
export declare function loadPolicy(): CompilerPolicy;
export declare function runCase(fixture: string, budget: string, manifest: ReturnType<typeof loadManifest>, policy: CompilerPolicy): {
    outcome: CaseOutcome;
    expected: {
        success: boolean;
        reason: string | null;
    };
};
export declare function runConformance(): ConformanceReport;
export declare function formatReport(report: ConformanceReport): string;
//# sourceMappingURL=index.d.ts.map