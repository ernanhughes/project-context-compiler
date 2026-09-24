/**
 * Canonical compiler-v1 conformance matrix: 14 fixtures x 3 budgets.
 * Expectations come from the frozen manifest's structural `expected`
 * matrix — never from oracle truth files, which are not shipped.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compileContext, } from "../core/engine.js";
import { loadCandidateFile, loadFixtureSet, loadRequestFile, } from "./loader.js";
import { policyFromJSON } from "../core/policy.js";
import { validateBundle, validateResult } from "../core/validation.js";
const here = dirname(fileURLToPath(import.meta.url));
export const CONFORMANCE_ROOT = join(here, "..", "..", "conformance", "compiler-v1");
export const POLICY_FILE = join(CONFORMANCE_ROOT, "compiler-policy-v1.json");
export const MANIFEST_FILE = join(CONFORMANCE_ROOT, "manifest.json");
export const BUDGETS = ["tight", "medium", "roomy"];
export function loadManifest() {
    return JSON.parse(readFileSync(MANIFEST_FILE, "utf-8"));
}
export function loadPolicy() {
    return policyFromJSON(JSON.parse(readFileSync(POLICY_FILE, "utf-8")));
}
export function runCase(fixture, budget, manifest, policy) {
    const fixtureSet = loadFixtureSet(CONFORMANCE_ROOT);
    const entry = fixtureSet[fixture];
    if (!entry)
        throw new Error(`unknown fixture: ${fixture}`);
    const candidates = loadCandidateFile(entry.candidates);
    const base = loadRequestFile(entry.request);
    const budgetTokens = manifest.budgets[fixture]?.[budget];
    if (typeof budgetTokens !== "number") {
        throw new Error(`no budget for ${fixture}/${budget}`);
    }
    const request = {
        ...base,
        requestId: `${base.requestId}-${budget}`,
        usableTokenBudget: budgetTokens,
    };
    const output = compileContext(request, candidates, policy);
    const problems = [...validateResult(output.result, request, candidates)];
    let admittedIds = [];
    let bundleTokens = null;
    let bundleHash = null;
    if (output.result.success && output.bundle) {
        problems.push(...validateBundle(output.bundle, request, candidates, policy));
        admittedIds = output.bundle.items.map((item) => item.id);
        bundleTokens = output.result.bundleTokens;
        bundleHash = output.result.bundleHash;
    }
    const expected = manifest.expected[fixture]?.[budget];
    if (!expected)
        throw new Error(`no expectation for ${fixture}/${budget}`);
    return {
        outcome: {
            fixture,
            budget,
            success: output.result.success,
            reason: output.result.failure ? output.result.failure.reason : null,
            admittedIds,
            bundleTokens,
            bundleHash,
            validationProblems: problems,
        },
        expected,
    };
}
export function runConformance() {
    const manifest = loadManifest();
    const policy = loadPolicy();
    const fixtureSet = loadFixtureSet(CONFORMANCE_ROOT);
    const details = [];
    let semantic = 0;
    let serial = 0;
    let budgetBad = 0;
    let successCases = 0;
    let failureCases = 0;
    let cases = 0;
    for (const fixture of Object.keys(fixtureSet).sort()) {
        for (const budget of BUDGETS) {
            cases++;
            const { outcome, expected } = runCase(fixture, budget, manifest, policy);
            if (outcome.success !== expected.success ||
                (!outcome.success && outcome.reason !== expected.reason)) {
                semantic++;
                details.push(`${fixture}/${budget}: got success=${outcome.success} ` +
                    `reason=${outcome.reason}, expected success=${expected.success} ` +
                    `reason=${expected.reason}`);
            }
            if (outcome.validationProblems.length > 0) {
                serial++;
                details.push(`${fixture}/${budget}: validation ${outcome.validationProblems.join("; ")}`);
            }
            const budgetTokens = manifest.budgets[fixture]?.[budget] ?? 0;
            if (outcome.success &&
                outcome.bundleTokens !== null &&
                outcome.bundleTokens > budgetTokens) {
                budgetBad++;
                details.push(`${fixture}/${budget}: over budget`);
            }
            if (outcome.success)
                successCases++;
            else
                failureCases++;
        }
    }
    return {
        cases,
        successCases,
        expectedFailureCases: failureCases,
        semanticMismatches: semantic,
        serializationMismatches: serial,
        budgetViolations: budgetBad,
        details,
        passed: semantic === 0 && serial === 0 && budgetBad === 0,
    };
}
export function formatReport(report) {
    const lines = [
        "Context Compiler conformance",
        "",
        "fixtures: 14",
        "budgets: 3",
        `cases: ${report.cases}`,
        "",
        `success cases: ${report.successCases}`,
        `expected failure cases: ${report.expectedFailureCases}`,
        "",
        `semantic mismatches: ${report.semanticMismatches}`,
        `serialization mismatches: ${report.serializationMismatches}`,
        `budget violations: ${report.budgetViolations}`,
        "",
        report.passed ? "PASS" : "FAIL",
        ...report.details,
    ];
    return lines.join("\n") + "\n";
}
//# sourceMappingURL=index.js.map