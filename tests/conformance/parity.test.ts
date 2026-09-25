/**
 * Cross-language parity gate: TypeScript vs Python v0.1.0 goldens.
 * Every field of every one of the 42 cases is compared. Any
 * mismatch is either a TypeScript bug or a documented semantic
 * difference — never a regenerated expectation.
 *
 * The goldens are historical truth and are never edited. They use the
 * v1 trace, whose `budget_after` repeats `budget_before` and whose
 * `dependency_closure` is always empty. The engine now produces a v2
 * trace; parity is checked on its v1 projection, and tests/core/trace-v2
 * pins what v2 adds.
 */

import { deepStrictEqual, equal, ok } from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  bundleToJSON,
  compileContext,
  renderBundleText,
  requestFromJSON,
  resultToV1JSON,
  traceToV1JSON,
  type ContextCandidate,
} from "../../src/core/index.ts";
import {
  BUDGETS,
  loadManifest,
  loadPolicy,
} from "../../src/conformance/index.ts";
import {
  loadCandidateFile,
  loadFixtureSet,
} from "../../src/conformance/loader.ts";
import { loadRequestFile } from "../../src/conformance/loader.ts";

const testsDir = dirname(fileURLToPath(import.meta.url));
const GOLDEN = join(testsDir, "..", "..", "conformance", "golden", "python-v0.1.0");
const CONFORMANCE = join(testsDir, "..", "..", "conformance", "compiler-v1");

function goldenFiles(): string[] {
  return readdirSync(GOLDEN)
    .filter((f) => f.endsWith(".json") && f !== "manifest.json")
    .sort();
}

test("golden manifest describes the frozen reference", () => {
  const manifest = JSON.parse(
    readFileSync(join(GOLDEN, "manifest.json"), "utf-8"),
  ) as Record<string, unknown>;
  equal(manifest["reference_implementation"], "Python");
  equal(manifest["reference_version"], "0.1.0");
  equal(manifest["reference_git_commit"], "bc2bd54e7565153b6e6d9da7187cda614e9d78fc");
  equal(manifest["case_count"], 42);
  equal((manifest["cases"] as string[]).length, 42);
});

test("all 42 golden files exist", () => {
  equal(goldenFiles().length, 42);
});

for (const file of goldenFiles()) {
  test(`parity ${file}`, () => {
    const golden = JSON.parse(readFileSync(join(GOLDEN, file), "utf-8")) as Record<
      string,
      unknown
    >;
    const manifest = loadManifest();
    const policy = loadPolicy();
    const fixtureSet = loadFixtureSet(CONFORMANCE);
    const fixture = golden["fixture"] as string;
    const budget = golden["budget"] as string;
    ok(BUDGETS.includes(budget as "tight"));

    const budgetTokens = manifest.budgets[fixture]?.[budget] as number;
    const loaded = loadCandidateFile(fixtureSet[fixture]?.candidates as string);
    const baseJson = JSON.parse(
      readFileSync(fixtureSet[fixture]?.request as string, "utf-8"),
    ) as Record<string, unknown>;
    const request = requestFromJSON({
      ...baseJson,
      request_id: `${baseJson["request_id"] as string}-${budget}`,
      usable_token_budget: budgetTokens,
    });
    const output = compileContext(request, loaded, policy);

    equal(output.result.success, golden["success"], "success");
    const goldenFailure = golden["failure"] as Record<string, unknown> | null;
    if (goldenFailure === null) {
      equal(output.result.failure, null, "failure absent");
    } else {
      ok(output.result.failure, "failure present");
      const failure = output.result.failure;
      equal(failure.reason, goldenFailure["reason"], "reason");
      deepStrictEqual(
        [...failure.blockingIds],
        goldenFailure["blocking_ids"],
        "blocking",
      );
      equal(failure.diagnostic, goldenFailure["diagnostic"], "diagnostic");
      equal(failure.budgetUsed, goldenFailure["budget_used"], "budget_used");
      equal(failure.budgetTotal, goldenFailure["budget_total"], "budget_total");
    }

    deepStrictEqual(
      output.bundle ? output.bundle.items.map((i) => i.id) : [],
      golden["admitted_candidate_ids"],
      "admitted ids",
    );
    if (output.bundle) {
      const byId = new Map(loaded.map((c) => [c.candidateId, c]));
      deepStrictEqual(
        output.bundle.items.map((i) => byId.get(i.id)?.representationId),
        golden["admitted_representation_ids"],
        "representations",
      );
      equal(output.bundle.id, (golden["bundle"] as Record<string, unknown>)["id"], "bundle id");
      equal(output.result.bundleTokens, golden["bundle_tokens"], "tokens");
      equal(output.result.bundleHash, golden["bundle_hash"], "hash");
      deepStrictEqual(bundleToJSON(output.bundle), golden["bundle"], "bundle bytes");
      equal(renderBundleText(output.bundle), golden["rendered_text"], "rendered text");
    } else {
      equal(golden["bundle"], null, "bundle null");
      equal(golden["rendered_text"], null, "rendered null");
    }
    deepStrictEqual(traceToV1JSON(output.result.trace), golden["trace"], "trace bytes (v1 projection)");
    deepStrictEqual(resultToV1JSON(output.result), golden["result"], "result bytes (v1 projection)");
  });
}
