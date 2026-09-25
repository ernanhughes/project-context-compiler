/**
 * Trace v2 and independent validation.
 *
 * The frozen Python goldens use the v1 trace: budget_after repeats
 * budget_before and dependency_closure is always empty. The engine now
 * produces v2. These tests pin what v2 adds, that it adds nothing else,
 * that v1 documents remain readable, and that the validators catch the
 * old defects and each hard-gate violation without asking the engine.
 */

import { deepStrictEqual, equal, ok, throws } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  TRACE_DECISIONS,
  bundleToJSON,
  compileContext,
  policyFromJSON,
  requestFromJSON,
  traceFromJSON,
  traceToJSON,
  traceToV1JSON,
  validateBundle,
  validateResult,
  type ContextCandidate,
} from "../../src/core/index.ts";
import {
  BUDGETS,
  CONFORMANCE_ROOT,
  loadManifest,
  loadPolicy,
} from "../../src/conformance/index.ts";
import {
  loadCandidateFile,
  loadFixtureSet,
} from "../../src/conformance/loader.ts";

const GOLDEN = join(CONFORMANCE_ROOT, "..", "golden", "python-v0.1.0");

function compileCase(fixture: string, budget: string) {
  const manifest = loadManifest();
  const policy = loadPolicy();
  const entry = loadFixtureSet(CONFORMANCE_ROOT)[fixture];
  ok(entry, `fixture ${fixture}`);
  const candidates = loadCandidateFile(entry.candidates);
  const base = JSON.parse(readFileSync(entry.request, "utf-8")) as Record<
    string,
    unknown
  >;
  const request = requestFromJSON({
    ...base,
    request_id: `${base["request_id"] as string}-${budget}`,
    usable_token_budget: manifest.budgets[fixture]?.[budget],
  });
  return {
    request,
    candidates,
    policy,
    output: compileContext(request, candidates, policy),
  };
}

test("a dependency records what pulled it in and the closure that came with it", () => {
  const { output } = compileCase("dependency-trap", "medium");
  const entries = new Map(
    output.result.trace.entries.map((e) => [e.candidateId, e]),
  );
  const ref = entries.get("ref-cheap");
  const resolver = entries.get("resolver-tool");
  ok(ref && resolver);
  deepStrictEqual([...ref.dependencyClosure], ["resolver-tool"]);
  deepStrictEqual([...ref.pulledInBy], []);
  deepStrictEqual([...resolver.pulledInBy], ["ref-cheap"]);
  equal(ref.budgetBefore, resolver.budgetBefore, "one unit, one budget before");
  equal(
    ref.budgetBefore - ref.budgetAfter,
    20 + 650,
    "the whole unit is charged",
  );
});

test("budget advances across admissions and never rises", () => {
  const { output } = compileCase("dependency-trap", "medium");
  for (const e of output.result.trace.entries) {
    ok(e.budgetAfter <= e.budgetBefore, `${e.candidateId} budget rose`);
    if (e.decision !== "ADMITTED") equal(e.budgetAfter, e.budgetBefore);
  }
});

test("v2 differs from the v1 projection only in the three documented fields", () => {
  for (const fixture of Object.keys(loadManifest().budgets)) {
    for (const budget of BUDGETS) {
      const { output } = compileCase(fixture, budget);
      const v2 = (
        traceToJSON(output.result.trace)["entries"] as Record<string, unknown>[]
      ).map((e) => {
        const { pulled_in_by, budget_after, dependency_closure, ...rest } = e;
        void pulled_in_by;
        void budget_after;
        void dependency_closure;
        return rest;
      });
      const v1 = (
        traceToV1JSON(output.result.trace)["entries"] as Record<
          string,
          unknown
        >[]
      ).map((e) => {
        const { budget_after, dependency_closure, ...rest } = e;
        void budget_after;
        void dependency_closure;
        return rest;
      });
      deepStrictEqual(v2, v1, `${fixture}/${budget}`);
    }
  }
});

test("a v1 trace from the frozen goldens is still readable and round-trips", () => {
  const golden = JSON.parse(
    readFileSync(join(GOLDEN, "dependency-trap-medium.json"), "utf-8"),
  ) as { trace: unknown };
  const trace = traceFromJSON(golden.trace);
  equal(trace.legacySchema, "v1");
  deepStrictEqual(traceToJSON(trace), golden.trace);
});

test("the group rejection name is gone from the vocabulary", () => {
  ok(!(TRACE_DECISIONS as readonly string[]).includes("REJECTED_GROUP"));
});

test("the validator catches a trace that has the old defects", () => {
  const { request, candidates, output } = compileCase(
    "dependency-trap",
    "medium",
  );
  deepStrictEqual(validateResult(output.result, request, candidates), []);
  const stale = {
    ...output.result,
    trace: {
      ...output.result.trace,
      entries: output.result.trace.entries.map((e) => ({
        ...e,
        dependencyClosure: [],
        budgetAfter: e.budgetBefore,
      })),
    },
  };
  const problems = validateResult(stale, request, candidates);
  ok(
    problems.some((p) => p.includes("closure wrong for ref-cheap")),
    problems.join("; "),
  );
  ok(
    problems.some((p) => p.includes("budget did not advance")),
    problems.join("; "),
  );
});

test("mandatory_form is enforced, not decorative", () => {
  const base = JSON.parse(
    readFileSync(join(CONFORMANCE_ROOT, "compiler-policy-v1.json"), "utf-8"),
  ) as Record<string, unknown>;
  throws(
    () => policyFromJSON({ ...base, mandatory_form: "richest" }),
    /unsupported mandatory_form/,
  );
  const { request, candidates, policy } = compileCase("budget-slack", "medium");
  throws(
    () =>
      compileContext(request, candidates, {
        ...policy,
        mandatoryForm: "richest",
      }),
    /unsupported mandatory_form/,
  );
});

// ---- the validator does not ask the engine whether a candidate is legal

function mutated(
  candidates: readonly ContextCandidate[],
  id: string,
  change: Partial<ContextCandidate>,
): ContextCandidate[] {
  return candidates.map((c) =>
    c.candidateId === id ? { ...c, ...change } : c,
  );
}

for (const [name, change, expected] of [
  ["scope", { scopeEligible: false }, "scope"],
  ["freshness", { freshnessEligible: false }, "freshness"],
  ["authority", { authorityEligible: false }, "authority"],
  ["floor", { minRank: 9 }, "floor"],
] as const) {
  test(`validator rejects an admitted candidate that fails the ${name} gate`, () => {
    const { request, candidates, policy, output } = compileCase(
      "wrong-scope",
      "medium",
    );
    ok(output.bundle);
    deepStrictEqual(
      validateBundle(output.bundle, request, candidates, policy),
      [],
    );
    const problems = validateBundle(
      output.bundle,
      request,
      mutated(candidates, "good-evidence", change),
      policy,
    );
    ok(
      problems.some((p) => p.includes(expected)),
      problems.join("; "),
    );
  });
}

test("validator rejects over-budget, missing-dependency and partial-group bundles", () => {
  const dep = compileCase("dependency-trap", "medium");
  ok(dep.output.bundle);
  const withoutResolver = {
    ...dep.output.bundle,
    items: dep.output.bundle.items.filter((i) => i.id !== "resolver-tool"),
    layoutTrace: dep.output.bundle.layoutTrace.filter(
      (i) => i !== "resolver-tool",
    ),
  };
  ok(
    validateBundle(
      withoutResolver,
      dep.request,
      dep.candidates,
      dep.policy,
    ).some((p) => p.includes("unsatisfied dependency")),
  );
  const tight = { ...dep.request, usableTokenBudget: 100 };
  ok(
    validateBundle(dep.output.bundle, tight, dep.candidates, dep.policy).some(
      (p) => p.includes("exceeds budget"),
    ),
  );
  const grp = compileCase("conflict-trap", "medium");
  ok(grp.output.bundle);
  const half = {
    ...grp.output.bundle,
    items: grp.output.bundle.items.filter((i) => i.id !== "conflict-marker"),
    layoutTrace: grp.output.bundle.layoutTrace.filter(
      (i) => i !== "conflict-marker",
    ),
  };
  ok(
    validateBundle(half, grp.request, grp.candidates, grp.policy).some((p) =>
      p.includes("partially admitted"),
    ),
  );
  void bundleToJSON;
});
