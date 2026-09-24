/**
 * External-consumer import contract: the package is importable by
 * its published name (`project-context-compiler` and
 * `project-context-compiler/core`), exactly as
 * project-context-opencode will import it for future composition.
 * No subprocesses, no relative paths into this repository.
 */

import { deepStrictEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";
import {
  compileContext,
  defaultPolicy,
  renderBundleText,
} from "project-context-compiler/core";
import pluginDefault, { PLUGIN_ID } from "project-context-compiler";

test("named core import compiles", () => {
  const output = compileContext(
    {
      requestId: "r",
      taskId: "t",
      usableTokenBudget: 500,
      createdAt: "2026-09-24T00:00:00Z",
      activeScope: "s",
      requiredIds: [],
      policyVersion: "compiler-policy-v1",
    },
    [
      {
        candidateId: "m1",
        contentIdentity: "m1",
        representationId: "full",
        formRank: 3,
        minRank: 0,
        sourceKind: "ledger",
        sourceRef: "r",
        kind: "evidence",
        content: "keep this",
        tokenCount: 10,
        tokenSource: "fixture-declared-counts",
        requirement: "MANDATORY",
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
        relevance: 0,
        isDefaultForm: true,
      },
    ],
    defaultPolicy(),
  );
  ok(output.result.success);
  deepStrictEqual(
    output.bundle?.items.map((i) => i.id),
    ["m1"],
  );
  ok(renderBundleText(output.bundle as never).includes("[CONTEXT BUNDLE]"));
});

test("root default export is the plugin", () => {
  ok(pluginDefault);
  equal(PLUGIN_ID, "project-context.compiler");
});
