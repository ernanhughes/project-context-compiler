/**
 * Behavioural engine surface, ported from the Python compiler tests:
 * determinism, immutability, hard gates, representations,
 * dependencies, groups, budget, trace, serialization, loaders,
 * hashing, validation.
 */

import { deepStrictEqual, equal, ok, throws } from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  candidateFromJSON,
  candidateToJSON,
  compileContext,
  policyFromJSON,
  requestFromJSON,
  resultFromJSON,
  resultToJSON,
  requestToJSON,
  traceFromJSON,
  traceToJSON,
  validateBundle,
  validateResult,
  type CompileOutput,
  type ContextCandidate,
  type ContextRequest,
  type CompilerPolicy,
} from "../../src/core/index.ts";
import {
  loadCandidateFile,
  loadFixtureSet,
  loadRequestFile,
  CANDIDATE_KEYS,
  REQUEST_KEYS,
} from "../../src/conformance/loader.ts";
import { CONFORMANCE_ROOT, POLICY_FILE } from "../../src/conformance/index.ts";
import { MANIFEST_FILE } from "../../src/conformance/index.ts";

function manifest(): Record<string, Record<string, number>> {
  return (
    JSON.parse(readFileSync(MANIFEST_FILE, "utf-8")) as {
      budgets: Record<string, Record<string, number>>;
    }
  ).budgets;
}

function policy(): CompilerPolicy {
  return policyFromJSON(
    JSON.parse(readFileSync(POLICY_FILE, "utf-8")) as unknown,
  );
}

function load(
  name: string,
  budget: string,
): [ContextRequest, ContextCandidate[]] {
  const set = loadFixtureSet(CONFORMANCE_ROOT);
  const entry = set[name];
  if (!entry) throw new Error(`unknown fixture ${name}`);
  const candidates = loadCandidateFile(entry.candidates);
  const base = loadRequestFile(entry.request);
  const budgets = manifest()[name];
  if (!budgets) throw new Error(`no budgets for ${name}`);
  const tokens = budgets[budget];
  if (typeof tokens !== "number")
    throw new Error(`no budget ${name}/${budget}`);
  const request: ContextRequest = {
    ...base,
    requestId: `${base.requestId}-${budget}`,
    usableTokenBudget: tokens,
  };
  return [request, candidates];
}

function compile(
  name: string,
  budget: string,
  p?: CompilerPolicy,
): CompileOutput {
  const [request, candidates] = load(name, budget);
  return compileContext(request, candidates, p ?? policy());
}

// --- determinism and purity ---

test("deterministic compile equality", () => {
  const [request, candidates] = load("heterogeneous-basic", "medium");
  const first = compileContext(request, candidates, policy());
  const second = compileContext(request, candidates, policy());
  deepStrictEqual(first.result, second.result);
  equal(first.bundle?.id, second.bundle?.id);
});

test("inputs are not mutated", () => {
  const [request, candidates] = load("dependency-trap", "tight");
  const beforeC = JSON.stringify(candidates);
  const beforeR = JSON.stringify(request);
  const p = policy();
  const beforeP = JSON.stringify(p);
  compileContext(request, candidates, p);
  equal(JSON.stringify(candidates), beforeC);
  equal(JSON.stringify(request), beforeR);
  equal(JSON.stringify(p), beforeP);
});

test("invalid inputs raise, not fail", () => {
  const [request, candidates] = load("budget-slack", "tight");
  const bad = {
    ...candidates[0],
    dependsOn: ["no-such-record"],
  } as ContextCandidate;
  throws(() => compileContext(request, [bad], policy()), /unknown dependency/);
  const dup = [candidates[0], candidates[0]] as ContextCandidate[];
  throws(
    () => compileContext(request, dup as ContextCandidate[], policy()),
    /duplicate/,
  );
});

test("policy mismatch raises", () => {
  const [request, candidates] = load("budget-slack", "tight");
  const other = { ...policy(), policyVersion: "other" };
  throws(() => compileContext(request, candidates, other), /policy/);
});

// --- hard gates ---

test("illegal high relevance never admitted", () => {
  const output = compile("wrong-scope", "tight");
  ok(output.result.success);
  const admitted = output.bundle?.items.map((i) => i.id) ?? [];
  equal(admitted.includes("scope-out"), false);
  const entry = output.result.trace.entries.find(
    (e) => e.candidateId === "scope-out",
  );
  equal(entry?.decision, "REJECTED_HARD");
  equal(entry?.reasonCode, "scope_ineligible");
});

test("stale cheap rejected despite cost", () => {
  const output = compile("stale-cheap", "tight");
  ok(output.result.success);
  const admitted = output.bundle?.items.map((i) => i.id) ?? [];
  equal(admitted.includes("stale-compact"), false);
  equal(admitted.includes("fresh-full"), true);
});

test("mandatory overflow fails", () => {
  for (const budget of ["tight", "medium"]) {
    const output = compile("mandatory-overflow", budget);
    equal(output.result.success, false);
    equal(output.result.failure?.reason, "INSUFFICIENT_BUDGET");
    equal(output.bundle, null);
  }
});

test("no legal representation fails", () => {
  const output = compile("no-legal-representation", "medium");
  equal(output.result.success, false);
  equal(output.result.failure?.reason, "NO_LEGAL_REPRESENTATION");
});

test("required unavailable fails", () => {
  const output = compile("required-unavailable", "tight");
  equal(output.result.success, false);
  equal(output.result.failure?.reason, "REQUIRED_SOURCE_UNAVAILABLE");
  ok(output.result.failure?.blockingIds.includes("ghost-1"));
});

test("monotonic failure below mandatory minimum", () => {
  const [request, candidates] = load("budget-slack", "tight");
  const tiny: ContextRequest = {
    ...request,
    requestId: "tiny",
    usableTokenBudget: 10,
  };
  const output = compileContext(tiny, candidates, policy());
  equal(output.result.success, false);
  equal(output.result.failure?.reason, "INSUFFICIENT_BUDGET");
});

// --- representations ---

test("alternatives never double-selected", () => {
  const output = compile("representation-alternatives", "roomy");
  ok(output.result.success);
  const [, candidates] = load("representation-alternatives", "roomy");
  const byId = new Map(candidates.map((c) => [c.candidateId, c]));
  const identities = (output.bundle?.items.map((i) => i.id) ?? []).map(
    (id) => byId.get(id)?.contentIdentity,
  );
  equal(identities.length, new Set(identities).size);
});

test("composite anchor reference admitted together", () => {
  const output = compile("dependency-trap", "tight");
  ok(output.result.success);
  const admitted = output.bundle?.items.map((i) => i.id) ?? [];
  equal(admitted.includes("ref-cheap"), true);
  equal(admitted.includes("resolver-tool"), true);
});

test("form choice recomputed per budget", () => {
  const tight = compile("representation-alternatives", "tight");
  const roomy = compile("representation-alternatives", "roomy");
  const tightIds = new Set(tight.bundle?.items.map((i) => i.id) ?? []);
  const roomyIds = new Set(roomy.bundle?.items.map((i) => i.id) ?? []);
  equal(tightIds.has("inc-anchor"), true);
  equal(roomyIds.has("inc-anchor"), true);
  const slackTight = 400 - (tight.result.bundleTokens ?? 0);
  const slackRoomy = 2000 - (roomy.result.bundleTokens ?? 0);
  ok(slackRoomy > slackTight);
});

// --- dependencies and groups ---

test("dependency closure commits requirements", () => {
  const output = compile("dependency-trap", "tight");
  const admitted = output.bundle?.items.map((i) => i.id) ?? [];
  equal(admitted.includes("resolver-tool"), true);
});

test("shared dependency emitted once", () => {
  const output = compile("shared-dependency", "tight");
  ok(output.result.success);
  const admitted = output.bundle?.items.map((i) => i.id) ?? [];
  equal(admitted.filter((id) => id === "tool-def").length, 1);
  equal(admitted.includes("ref-a"), true);
  equal(admitted.includes("ref-b"), true);
});

test("dependency cycle terminates", () => {
  const output = compile("dependency-cycle", "tight");
  ok(output.result.success);
  const admitted = output.bundle?.items.map((i) => i.id) ?? [];
  equal(admitted.includes("cyc-a"), true);
  equal(admitted.includes("cyc-b"), true);
});

test("ineligible dependency blocks mandatory", () => {
  const [request, candidates] = load("wrong-scope", "tight");
  const parent: ContextCandidate = {
    ...(candidates[0] as ContextCandidate),
    candidateId: "mand-parent",
    contentIdentity: "mand-parent",
    requirement: "MANDATORY",
    dependsOn: ["scope-out"],
  };
  const output = compileContext(
    request,
    [parent, ...candidates.slice(1)],
    policy(),
  );
  equal(output.result.success, false);
  equal(output.result.failure?.reason, "UNSATISFIED_DEPENDENCY");
});

test("required group atomic", () => {
  const output = compile("qualification-trap", "tight");
  ok(output.result.success);
  const admitted = output.bundle?.items.map((i) => i.id) ?? [];
  equal(admitted.includes("claim-positive"), true);
  equal(admitted.includes("exception-tenant"), true);
});

test("conflict group preserved", () => {
  const output = compile("conflict-trap", "medium");
  ok(output.result.success);
  const admitted = output.bundle?.items.map((i) => i.id) ?? [];
  equal(admitted.includes("claim-a"), true);
  equal(admitted.includes("claim-b"), true);
  equal(admitted.includes("conflict-marker"), true);
});

test("group band mixing rejected", () => {
  const [request, candidates] = load("qualification-trap", "tight");
  const altered: ContextCandidate = {
    ...(candidates[2] as ContextCandidate),
    requirement: "DISCRETIONARY",
  };
  throws(
    () =>
      compileContext(
        request,
        candidates.map((c) =>
          c.candidateId === "claim-positive" ? altered : c,
        ),
        policy(),
      ),
    /spans bands/,
  );
});

// --- budget behaviour ---

test("roomy budget leaves slack", () => {
  const [request, candidates] = load("budget-slack", "roomy");
  const output = compileContext(request, candidates, policy());
  ok(output.result.success);
  ok((output.result.bundleTokens ?? 0) < request.usableTokenBudget);
  const slack = request.usableTokenBudget - (output.result.bundleTokens ?? 0);
  ok(slack > 2000);
  const admitted = output.bundle?.items.map((i) => i.id) ?? [];
  equal(admitted.includes("distract-d1"), false);
  equal(admitted.includes("distract-d2"), false);
});

test("rendered overflow repairs discretionary only", () => {
  const [request, candidates] = load("rendered-overflow", "tight");
  const output = compileContext(request, candidates, policy());
  ok(output.result.success);
  const admitted = output.bundle?.items.map((i) => i.id) ?? [];
  equal(admitted.includes("instr-1"), true);
  equal(admitted.includes("taskreq-1"), true);
  equal(admitted.includes("disc-a"), false);
  ok((output.result.bundleTokens ?? Infinity) <= request.usableTokenBudget);
  const dropped = output.result.trace.entries.find(
    (e) => e.candidateId === "disc-a",
  );
  equal(dropped?.reasonCode, "repair-drop");
});

for (const name of [
  "dependency-trap",
  "qualification-trap",
  "conflict-trap",
  "stale-cheap",
  "wrong-scope",
  "budget-slack",
  "representation-alternatives",
  "shared-dependency",
  "dependency-cycle",
  "rendered-overflow",
  "heterogeneous-basic",
  "mandatory-overflow",
]) {
  for (const budget of ["tight", "medium", "roomy"]) {
    test(`rendered never exceeds budget: ${name}/${budget}`, () => {
      const [request, candidates] = load(name, budget);
      const output = compileContext(request, candidates, policy());
      if (output.result.success) {
        ok(
          (output.result.bundleTokens ?? Infinity) <= request.usableTokenBudget,
        );
      }
    });
  }
}

test("trace covers every record on success", () => {
  const [, candidates] = load("heterogeneous-basic", "medium");
  const output = compile("heterogeneous-basic", "medium");
  const traced = new Set(output.result.trace.entries.map((e) => e.candidateId));
  deepStrictEqual(traced, new Set(candidates.map((c) => c.candidateId)));
});

test("early rejection keeps evidence", () => {
  const output = compile("heterogeneous-basic", "medium");
  const entry = output.result.trace.entries.find(
    (e) => e.candidateId === "scope-bad",
  );
  equal(entry?.decision, "REJECTED_HARD");
  ok((entry?.reasonDetail ?? "").includes("project-b"));
});

test("trace ordering deterministic", () => {
  const output = compile("heterogeneous-basic", "medium");
  const ids = output.result.trace.entries.map((e) => e.candidateId);
  deepStrictEqual(ids, [...ids].sort());
});

test("policy version recorded", () => {
  const output = compile("budget-slack", "tight");
  equal(output.result.policyVersion, "compiler-policy-v1");
  equal(output.result.trace.policyVersion, "compiler-policy-v1");
});

test("failure deterministic and complete", () => {
  const first = compile("mandatory-overflow", "tight");
  const second = compile("mandatory-overflow", "tight");
  deepStrictEqual(first.result, second.result);
  ok(first.result.failure?.blockingIds.length);
  ok(first.result.failure?.diagnostic);
  equal(first.result.failure?.budgetTotal, 4000);
});

// --- records ---

test("json round trips", () => {
  const [request, candidates] = load("budget-slack", "tight");
  for (const record of candidates) {
    deepStrictEqual(candidateFromJSON(candidateToJSON(record)), record);
  }
  deepStrictEqual(requestFromJSON(requestToJSON(request)), request);
  const p = policy();
  deepStrictEqual(policyFromJSON(JSON.parse(JSON.stringify(p))), p);
});

test("strict loader rejects unknown keys", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-"));
  const bad = {
    candidates: [
      {
        candidate_id: "x",
        content_identity: "x",
        representation_id: "f",
        form_rank: 3,
        min_rank: 0,
        source_kind: "s",
        source_ref: "r",
        kind: "k",
        content: "c",
        token_count: 5,
        requirement: "MANDATORY",
        order_role: "evidence",
        scope_eligible: true,
        freshness_eligible: true,
        authority_eligible: true,
        eval_class: "must",
      },
    ],
  };
  const path = join(dir, "x.candidates.json");
  writeFileSync(path, JSON.stringify(bad), "utf-8");
  let message = "";
  try {
    loadCandidateFile(path);
  } catch (error) {
    message = String(error);
  }
  ok(
    message.includes("unknown candidate keys") ||
      message.includes("eval_class"),
  );
});

test("loader key sets are frozen", () => {
  ok(CANDIDATE_KEYS.has("candidate_id"));
  ok(!CANDIDATE_KEYS.has("eval_class"));
  ok(REQUEST_KEYS.has("usable_token_budget"));
});

test("result and trace round trip", () => {
  const output = compile("budget-slack", "tight");
  deepStrictEqual(resultFromJSON(resultToJSON(output.result)), output.result);
  deepStrictEqual(
    traceFromJSON(traceToJSON(output.result.trace)),
    output.result.trace,
  );
});
