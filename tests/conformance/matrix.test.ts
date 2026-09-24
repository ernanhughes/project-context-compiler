/**
 * Self-conformance: the TypeScript package verifies itself against
 * the frozen manifest without needing project-context.
 */

import { equal, ok } from "node:assert/strict";
import { test } from "node:test";
import {
  formatReport,
  runConformance,
} from "../../src/conformance/index.ts";

test("conformance matrix passes", () => {
  const report = runConformance();
  equal(report.cases, 42);
  equal(report.successCases, 34);
  equal(report.expectedFailureCases, 8);
  equal(report.semanticMismatches, 0);
  equal(report.serializationMismatches, 0);
  equal(report.budgetViolations, 0);
  ok(report.passed);
});

test("conformance report format", () => {
  const report = runConformance();
  const text = formatReport(report);
  ok(text.includes("cases: 42"));
  ok(text.endsWith("PASS\n"));
});
