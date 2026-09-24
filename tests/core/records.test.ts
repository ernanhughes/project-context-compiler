/**
 * Policy, validation, render, and null-contract unit tests.
 */

import { deepStrictEqual, equal, ok, throws } from "node:assert/strict";
import { test } from "node:test";
import {
  BUNDLE_CLOSE,
  BUNDLE_OPEN,
  COMPILER_POLICY_SCHEMA,
  DEFAULT_POLICY_VERSION,
  buildBundle,
  bundleToJSON,
  defaultPolicy,
  makeItem,
  policyFromJSON,
  policyToJSON,
  renderBundleText,
  resultFromJSON,
  resultToJSON,
  validateBundle,
  validateResult,
  type ContextBundle,
} from "../../src/core/index.ts";
import { compileContext } from "../../src/core/index.ts";

test("default policy matches compiler-policy-v1", () => {
  const policy = defaultPolicy();
  deepStrictEqual(policyToJSON(policy), {
    schema_version: COMPILER_POLICY_SCHEMA,
    policy_version: DEFAULT_POLICY_VERSION,
    min_discretionary_relevance: 0.3,
    mandatory_form: "cheapest",
    order_roles: [
      "instruction",
      "task",
      "state",
      "evidence",
      "support",
      "tool",
    ],
    repair: "drop-last-discretionary",
  });
});

test("policy rejects unknown schema", () => {
  throws(() => policyFromJSON({ schema_version: "x" }), /unsupported/);
});

test("policy applies documented defaults", () => {
  const policy = policyFromJSON({});
  equal(policy.policyVersion, DEFAULT_POLICY_VERSION);
  equal(policy.minDiscretionaryRelevance, 0.3);
  equal(policy.repair, "drop-last-discretionary");
});

test("bundle json keeps every v1 field present", () => {
  const bundle: ContextBundle = buildBundle({
    items: [makeItem({ id: "a", source: "s", kind: "k", content: "c" })],
    bundleId: "b",
    createdAt: "t",
  });
  const doc = bundleToJSON(bundle) as Record<string, unknown>;
  for (const key of [
    "schema_version",
    "id",
    "items",
    "created_at",
    "layout_trace",
    "evidence_class",
    "provenance",
  ]) {
    ok(key in doc, `missing ${key}`);
  }
  equal(doc["provenance"], null);
  const item = (doc["items"] as Record<string, unknown>[])[0] as Record<
    string,
    unknown
  >;
  for (const key of [
    "authority",
    "scope",
    "observed_at",
    "semantic_id",
    "ref",
  ]) {
    ok(key in item, `missing item ${key}`);
    equal(item[key], null);
  }
});

test("generic renderer is deterministic and marker-stable", () => {
  const bundle: ContextBundle = buildBundle({
    items: [
      makeItem({ id: "a", source: "s", kind: "k", content: "first" }),
      makeItem({ id: "b", source: "s", kind: "k", content: "second" }),
    ],
    bundleId: "b",
    createdAt: "t",
  });
  const first = renderBundleText(bundle);
  const second = renderBundleText(bundle);
  equal(first, second);
  ok(first.startsWith(`${BUNDLE_OPEN}\n`));
  ok(first.endsWith(`${BUNDLE_CLOSE}\n`));
  ok(!first.includes("[CONTEXT RUNTIME]"));
});

test("validators accept a good compile and reject a bad bundle", () => {
  const request = {
    requestId: "r",
    taskId: "t",
    usableTokenBudget: 5,
    createdAt: "t",
    activeScope: "s",
    requiredIds: [],
    policyVersion: "compiler-policy-v1",
  } as const;
  const candidates = [
    {
      candidateId: "big",
      contentIdentity: "big",
      representationId: "full",
      formRank: 3,
      minRank: 0,
      sourceKind: "s",
      sourceRef: "r",
      kind: "evidence",
      content: "word ".repeat(100),
      tokenCount: 1000,
      tokenSource: "fixture-declared-counts",
      requirement: "DISCRETIONARY",
      orderRole: "evidence",
      scopeEligible: true,
      scopeReason: "",
      freshnessEligible: true,
      freshnessReason: "",
      authorityEligible: true,
      authorityReason: "",
      dependsOn: [],
      groupId: null,
      groupRequired: false,
      coverageKeys: [],
      relevance: 0.0,
      isDefaultForm: true,
    },
  ] as const;
  const bundle: ContextBundle = buildBundle({
    items: [
      {
        ...makeItem({ id: "big", source: "s", kind: "evidence", content: "x" }),
        tokenCount: 1000,
      },
    ],
    bundleId: "b",
    createdAt: "t",
  });
  const problems = validateBundle(
    bundle,
    request,
    [...candidates] as unknown as Parameters<typeof validateBundle>[2],
    defaultPolicy(),
  );
  ok(
    problems.some((p) => p.includes("exceeds budget")),
    JSON.stringify(problems),
  );
});

test("result validator catches envelope errors", () => {
  const output = compileContext(
    {
      requestId: "r",
      taskId: "t",
      usableTokenBudget: 100,
      createdAt: "t",
      activeScope: "s",
      requiredIds: [],
      policyVersion: "compiler-policy-v1",
    },
    [],
    defaultPolicy(),
  );
  ok(output.result.success);
  const bad = { ...output.result, failure: output.result.failure };
  void bad;
  const broken = {
    ...output.result,
    success: false,
    failure: null,
    bundleId: "b",
  };
  const problems = validateResult(
    broken,
    {
      requestId: "r",
      taskId: "t",
      usableTokenBudget: 100,
      createdAt: "t",
      activeScope: "s",
      requiredIds: [],
      policyVersion: "compiler-policy-v1",
    },
    [],
  );
  ok(problems.length >= 2, JSON.stringify(problems));
});

test("empty success round trip preserves envelope nulls on failure", () => {
  const output = compileContext(
    {
      requestId: "r",
      taskId: "t",
      usableTokenBudget: 100,
      createdAt: "t",
      activeScope: "s",
      requiredIds: ["ghost"],
      policyVersion: "compiler-policy-v1",
    },
    [],
    defaultPolicy(),
  );
  equal(output.result.success, false);
  const doc = resultToJSON(output.result) as Record<string, unknown>;
  equal(doc["bundle_id"], null);
  equal(doc["bundle_tokens"], null);
  equal(doc["bundle_hash"], null);
  deepStrictEqual(
    resultFromJSON(JSON.parse(JSON.stringify(doc))),
    output.result,
  );
});
