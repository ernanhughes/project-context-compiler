/**
 * Canonical compiler-v1 conformance matrix: 14 fixtures x 3 budgets.
 * Expectations come from the frozen manifest's structural `expected`
 * matrix — never from oracle truth files, which are not shipped.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileContext,
  type CompileOutput,
} from "../core/engine.ts";
import type { ContextRequest } from "../core/domain.ts";
import {
  loadCandidateFile,
  loadFixtureSet,
  loadRequestFile,
} from "./loader.ts";
import { policyFromJSON, type CompilerPolicy } from "../core/policy.ts";
import { validateBundle, validateResult } from "../core/validation.ts";

const here = dirname(fileURLToPath(import.meta.url));
export const CONFORMANCE_ROOT = join(here, "..", "..", "conformance", "compiler-v1");
export const POLICY_FILE = join(CONFORMANCE_ROOT, "compiler-policy-v1.json");
export const MANIFEST_FILE = join(CONFORMANCE_ROOT, "manifest.json");
export const BUDGETS = ["tight", "medium", "roomy"] as const;

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

export function loadManifest(): {
  budgets: Record<string, Record<string, number>>;
  expected: Record<string, Record<string, { success: boolean; reason: string | null }>>;
} {
  return JSON.parse(readFileSync(MANIFEST_FILE, "utf-8")) as {
    budgets: Record<string, Record<string, number>>;
    expected: Record<string, Record<string, { success: boolean; reason: string | null }>>;
  };
}

export function loadPolicy(): CompilerPolicy {
  return policyFromJSON(JSON.parse(readFileSync(POLICY_FILE, "utf-8")) as unknown);
}

export function runCase(
  fixture: string,
  budget: string,
  manifest: ReturnType<typeof loadManifest>,
  policy: CompilerPolicy,
): { outcome: CaseOutcome; expected: { success: boolean; reason: string | null } } {
  const fixtureSet = loadFixtureSet(CONFORMANCE_ROOT);
  const entry = fixtureSet[fixture];
  if (!entry) throw new Error(`unknown fixture: ${fixture}`);
  const candidates = loadCandidateFile(entry.candidates);
  const base = loadRequestFile(entry.request);
  const budgetTokens = manifest.budgets[fixture]?.[budget];
  if (typeof budgetTokens !== "number") {
    throw new Error(`no budget for ${fixture}/${budget}`);
  }
  const request: ContextRequest = {
    ...base,
    requestId: `${base.requestId}-${budget}`,
    usableTokenBudget: budgetTokens,
  };
  const output: CompileOutput = compileContext(request, candidates, policy);
  const problems = [...validateResult(output.result, request, candidates)];
  let admittedIds: readonly string[] = [];
  let bundleTokens: number | null = null;
  let bundleHash: string | null = null;
  if (output.result.success && output.bundle) {
    problems.push(...validateBundle(output.bundle, request, candidates, policy));
    admittedIds = output.bundle.items.map((item) => item.id);
    bundleTokens = output.result.bundleTokens;
    bundleHash = output.result.bundleHash;
  }
  const expected = manifest.expected[fixture]?.[budget];
  if (!expected) throw new Error(`no expectation for ${fixture}/${budget}`);
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

export function runConformance(): ConformanceReport {
  const manifest = loadManifest();
  const policy = loadPolicy();
  const fixtureSet = loadFixtureSet(CONFORMANCE_ROOT);
  const details: string[] = [];
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
      if (
        outcome.success !== expected.success ||
        (!outcome.success && outcome.reason !== expected.reason)
      ) {
        semantic++;
        details.push(
          `${fixture}/${budget}: got success=${outcome.success} ` +
            `reason=${outcome.reason}, expected success=${expected.success} ` +
            `reason=${expected.reason}`,
        );
      }
      if (outcome.validationProblems.length > 0) {
        serial++;
        details.push(
          `${fixture}/${budget}: validation ${outcome.validationProblems.join("; ")}`,
        );
      }
      const budgetTokens = manifest.budgets[fixture]?.[budget] ?? 0;
      if (
        outcome.success &&
        outcome.bundleTokens !== null &&
        outcome.bundleTokens > budgetTokens
      ) {
        budgetBad++;
        details.push(`${fixture}/${budget}: over budget`);
      }
      if (outcome.success) successCases++;
      else failureCases++;
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

export function formatReport(report: ConformanceReport): string {
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
