/**
 * Candidate Builder tests: stable identity, deterministic replay,
 * provenance, heterogeneous adapters, representation lineage, scope,
 * freshness, authority, conflicts, dependencies, failures,
 * backward compatibility, and the end-to-end builder → compiler flow.
 *
 * Controlled experiments A–H from the experiment programme are
 * labelled inline. All fixtures are synthetic; no model is called.
 */

import { deepStrictEqual, equal, ok, throws } from "node:assert/strict";
import { test } from "node:test";
import {
  buildCandidates,
  defaultBuilderPolicy,
  type AvailableInformation,
  type BuilderPolicy,
  type BuilderRequest,
} from "../../src/builder/index.ts";
import {
  candidateFromJSON,
  candidateToJSON,
  compileContext,
  defaultPolicy,
  validateBundle,
  validateResult,
} from "../../src/core/index.ts";

const LONG_TEXT = [
  "The authentication module verifies user credentials against the directory,",
  "enforces rate limiting on repeated failures, writes an audit record for every",
  "decision, rotates session tokens on privilege change, and rejects expired or",
  "revoked tokens before any handler runs. Operators must keep the clock source",
  "synchronised, retain the audit log for ninety days, and never disable the",
  "limiter in production even during incident response when pressure is highest.",
  "Generated files under the output directory are build artifacts and must not",
  "be edited by hand under any circumstance whatsoever.",
].join(" ");

function builderRequest(): BuilderRequest {
  return {
    requestId: "builder-test-1",
    taskId: "modify-authentication-behaviour",
    activeScope: "project-acme",
    createdAt: "2026-09-26T00:00:00Z",
    policyVersion: "builder-policy-v1",
  };
}

function canonicalAvailable(): AvailableInformation {
  return {
    files: [
      {
        path: "src/auth.ts",
        revision: "r42",
        content: LONG_TEXT,
        declaredScope: "project-acme",
        retention: "pin",
      },
      {
        path: "src/auth.ts",
        revision: "r39",
        content: "stale revision r39 without rate limiting",
        declaredScope: "project-acme",
        superseded: true,
        validatorStatus: "superseded",
        validatorId: "vcs-log",
      },
      {
        path: "README.md",
        revision: "r10",
        content: "Acme readme. Run tests with npm test.",
        declaredScope: "project-acme",
      },
      {
        path: "other-project/config.yaml",
        revision: "r3",
        content: "auth_endpoint: https://other.example.com/auth",
        declaredScope: "project-other",
      },
    ],
    instructions: [
      {
        instructionId: "never-modify-generated",
        text: "Never modify generated files under src/generated.",
        scope: "project-acme",
        authorityClass: "project-rule",
        retention: "pin",
      },
    ],
    tools: [
      {
        callId: "call-1",
        toolName: "read-file",
        definition: "read-file(path: string): returns file contents",
        output: "src/auth.ts r42 read successfully, 120 lines returned",
        status: "ok",
        declaredScope: "project-acme",
      },
    ],
    states: [
      {
        noteId: "working-note-1",
        text: "Hypothesis: the failure comes from the token expiry path.",
        status: "hypothesis",
        declaredScope: "project-acme",
      },
    ],
    memories: [
      {
        memoryId: "mem-oauth-lesson",
        text: "OAuth migration: keep the refresh-token path covered by tests.",
        validity: "historical",
        declaredScope: "project-acme",
      },
    ],
  };
}

function build(policy?: BuilderPolicy) {
  return buildCandidates(
    builderRequest(),
    canonicalAvailable(),
    policy ?? defaultBuilderPolicy(),
  );
}

// --- A. deterministic replay ---

test("A: same inputs give byte-identical candidates and trace", () => {
  const first = build();
  const second = build();
  deepStrictEqual(first.candidates, second.candidates);
  deepStrictEqual(first.trace, second.trace);
  ok(first.candidates.length > 0);
});

test("stable identity: candidate ids are content hashes, not sequence numbers", () => {
  const first = build();
  const ids = first.candidates.map((c) => c.candidateId);
  deepStrictEqual(ids, [...ids].sort());
  equal(new Set(ids).size, ids.length);
});

// --- heterogeneous adapters ---

test("heterogeneous sources become comparable candidates", () => {
  const built = build();
  const kinds = new Set(built.candidates.map((c) => c.sourceKind));
  for (const expected of [
    "file",
    "instruction",
    "tool",
    "working-state",
    "memory",
  ]) {
    ok(kinds.has(expected), `missing sourceKind ${expected}`);
  }
  ok(built.trace.sourcesConsulted.includes("file"));
  ok(built.trace.sourcesConsulted.includes("tool"));
  ok(built.trace.sourcesConsulted.includes("state"));
});

// --- representation lineage ---

test("G: one content, several forms, shared identity, explicit lineage", () => {
  const built = build();
  const full = built.candidates.find(
    (c) => c.sourceRef === "src/auth.ts" && c.representationId === "full",
  );
  ok(full);
  const siblings = built.candidates.filter(
    (c) => c.contentIdentity === full.contentIdentity,
  );
  const forms = new Set(siblings.map((c) => c.representationId));
  ok(forms.has("full"));
  ok(forms.has("compact"), "long file must yield a compact form");
  ok(forms.has("anchor"));
  ok(forms.has("reference"));
  const compact = siblings.find((c) => c.representationId === "compact");
  ok(compact);
  ok(
    built.trace.derivations.some(
      (d) =>
        d.candidateId === compact.candidateId &&
        d.field === "fidelity" &&
        d.value === "lossy",
    ),
    "compact form must be recorded as lossy",
  );
  const reference = siblings.find((c) => c.representationId === "reference");
  ok(reference);
  ok(
    reference.content.startsWith("[reference]"),
    "reference must read as a pointer, never as resident content",
  );
  ok(
    !reference.content.includes("rate limiting") ||
      reference.content.includes("resolve via"),
    "reference must not masquerade as the payload",
  );
});

test("fidelity floor: pinned content offers no below-floor legal form", () => {
  const built = build();
  const pinned = built.candidates.filter(
    (c) => c.sourceRef === "never-modify-generated",
  );
  ok(pinned.length > 0);
  for (const candidate of pinned) {
    equal(candidate.minRank, 3);
  }
});

// --- scope ---

test("D: wrong-scope items stay explicit and compiler-rejectable", () => {
  const built = build();
  const wrong = built.candidates.filter(
    (c) => c.sourceRef === "other-project/config.yaml",
  );
  ok(wrong.length > 0);
  for (const candidate of wrong) {
    equal(candidate.scopeEligible, false);
    ok(candidate.scopeReason.includes("project-other"));
  }
  const right = built.candidates.filter(
    (c) => c.sourceRef === "src/auth.ts" && c.scopeEligible,
  );
  ok(right.length > 0);
});

test("unknown scope fails closed and stays visible", () => {
  const available = canonicalAvailable();
  const built = buildCandidates(
    builderRequest(),
    {
      ...available,
      files: [
        {
          path: "mystery.txt",
          revision: "r1",
          content: "content of unknown scope",
        },
      ],
      instructions: [],
      tools: [],
      states: [],
      memories: [],
    },
    defaultBuilderPolicy(),
  );
  ok(built.candidates.length > 0);
  for (const candidate of built.candidates) {
    equal(candidate.scopeEligible, false);
    ok(candidate.scopeReason.includes("unknown"));
  }
  ok(
    built.trace.derivations.some(
      (d) => d.field === "scope" && d.provenance === "unknown",
    ),
  );
});

// --- freshness ---

test("F: validators decide freshness; age never does", () => {
  const built = build();
  const stale = built.candidates.filter(
    (c) => c.sourceRef === "src/auth.ts" && c.content.includes("r39"),
  );
  ok(stale.length > 0);
  for (const candidate of stale) {
    equal(candidate.freshnessEligible, false);
    ok(
      candidate.freshnessReason.includes("superseded"),
      `stale verdict must name the cause: ${candidate.freshnessReason}`,
    );
  }
  // Old-but-valid: an old observation affirmed by its validator.
  const old = buildCandidates(
    builderRequest(),
    {
      files: [
        {
          path: "legacy.txt",
          revision: "r1",
          content: "old but affirmed content here",
          declaredScope: "project-acme",
          validatorStatus: "current",
          validatorId: "owner-review",
          observedAt: "2020-01-01T00:00:00Z",
        },
      ],
    },
    defaultBuilderPolicy(),
  );
  const affirmed = old.candidates.filter((c) => c.sourceRef === "legacy.txt");
  ok(affirmed.length > 0);
  for (const candidate of affirmed) {
    equal(candidate.freshnessEligible, true);
  }
  // Age alone changes nothing: same content, different observedAt.
  const newer = buildCandidates(
    builderRequest(),
    {
      files: [
        {
          path: "legacy.txt",
          revision: "r1",
          content: "old but affirmed content here",
          declaredScope: "project-acme",
          validatorStatus: "current",
          validatorId: "owner-review",
          observedAt: "2026-09-26T00:00:00Z",
        },
      ],
    },
    defaultBuilderPolicy(),
  );
  deepStrictEqual(
    newer.candidates.map((c) => [c.freshnessEligible, c.freshnessReason]),
    old.candidates.map((c) => [c.freshnessEligible, c.freshnessReason]),
  );
});

// --- authority ---

test("authority comes from source class and policy, never from relevance", () => {
  const built = buildCandidates(
    builderRequest(),
    {
      retrievals: [
        {
          retrievalId: "hot-external",
          text: "extremely relevant external claim",
          sourceRef: "external-docs",
          score: 0.99,
          declaredScope: "project-acme",
          authorityClass: "retrieved-external",
        },
        {
          retrievalId: "cold-unknown",
          text: "irrelevant claim of unknown class",
          sourceRef: "unknown-place",
          score: 0.0,
          declaredScope: "project-acme",
          authorityClass: "no-such-class",
        },
      ],
    },
    defaultBuilderPolicy(),
  );
  const hot = built.candidates.filter((c) => c.sourceRef === "external-docs");
  ok(hot.length > 0);
  for (const candidate of hot) {
    equal(candidate.authorityEligible, true);
    equal(candidate.relevance, 0.99);
  }
  const cold = built.candidates.filter((c) => c.sourceRef === "unknown-place");
  ok(cold.length > 0);
  for (const candidate of cold) {
    equal(candidate.authorityEligible, false);
    ok(candidate.authorityReason.includes("unknown authority class"));
  }
});

// --- unknown metadata ---

test("unknown retention stays visible as an unknown floor", () => {
  const built = build();
  const readme = built.candidates.filter(
    (c) => c.sourceRef === "README.md" && c.representationId === "full",
  );
  ok(readme.length === 1);
  equal(readme[0]?.minRank, 0);
  ok(
    built.trace.derivations.some(
      (d) =>
        d.candidateId === readme[0]?.candidateId &&
        d.field === "floor" &&
        d.provenance === "unknown",
    ),
  );
});

// --- conflicts ---

test("E: conflicting versions are grouped, never silently won", () => {
  const built = build();
  equal(built.trace.conflicts.length, 1);
  const group = built.trace.conflicts[0];
  equal(group?.conflictKey, "file:src/auth.ts");
  equal(group?.members.length, 2);
  const markers = built.candidates.filter((c) => c.kind === "conflict-marker");
  equal(markers.length, 1);
  // Both versions are emitted: no silent winner at build time.
  const fulls = built.candidates.filter(
    (c) => c.sourceRef === "src/auth.ts" && c.representationId === "full",
  );
  equal(fulls.length, 2);
  // The stale version is grouped but not required: it must not hold
  // the fresh version hostage at compile time.
  equal(markers[0]?.groupRequired, false);
});

// --- dependencies ---

test("H: tool outputs declare their definition as a dependency", () => {
  const built = build();
  const outputs = built.candidates.filter((c) => c.kind === "tool-output");
  ok(outputs.length > 0);
  for (const output of outputs) {
    equal(output.dependsOn.length, 1);
    const definition = built.candidates.find(
      (c) => c.candidateId === output.dependsOn[0],
    );
    ok(definition);
    equal(definition.kind, "tool-definition");
  }
  ok(built.trace.dependencies.length > 0);
  equal(built.trace.cyclicDependency, false);
});

test("H: missing prerequisites are exposed, not hidden", () => {
  const built = buildCandidates(
    builderRequest(),
    {
      tools: [
        {
          callId: "lonely-call",
          toolName: "query",
          definition: "",
          output: "an answer with no recorded definition",
          status: "ok",
          declaredScope: "project-acme",
        },
      ],
    },
    defaultBuilderPolicy(),
  );
  const outputs = built.candidates.filter((c) => c.kind === "tool-output");
  ok(outputs.length > 0);
  ok(
    built.trace.derivations.some(
      (d) =>
        d.field === "dependsOn" &&
        d.provenance === "unknown" &&
        d.detail.includes("absent"),
    ),
  );
});

test("H: references without anchors are refused loudly", () => {
  const policy: BuilderPolicy = {
    ...defaultBuilderPolicy(),
    emitAnchor: false,
    emitReference: true,
  };
  const built = buildCandidates(builderRequest(), canonicalAvailable(), policy);
  ok(built.trace.rejections.some((r) => r.code === "REPRESENTATION_FAILURE"));
  equal(
    built.candidates.filter((c) => c.representationId === "reference").length,
    0,
  );
});

// --- failures ---

test("malformed observations are rejected one by one, never aborting", () => {
  const built = buildCandidates(
    builderRequest(),
    {
      files: [
        { path: "empty.txt", revision: "r1", content: "" },
        {
          path: "good.txt",
          revision: "r1",
          content: "good content here",
          declaredScope: "project-acme",
        },
      ],
    },
    defaultBuilderPolicy(),
  );
  ok(built.trace.rejections.some((r) => r.code === "MALFORMED_OBSERVATION"));
  ok(built.candidates.some((c) => c.sourceRef === "good.txt"));
});

test("absent available information aborts loudly", () => {
  throws(
    () =>
      buildCandidates(
        builderRequest(),
        null as unknown as AvailableInformation,
        defaultBuilderPolicy(),
      ),
    /SOURCE_UNAVAILABLE/,
  );
});

// --- B/C: source addition and mutation radius ---

test("B: irrelevant additions leave unrelated identities untouched", () => {
  const before = build();
  const beforeIds = new Set(before.candidates.map((c) => c.candidateId));
  const extended = buildCandidates(
    builderRequest(),
    {
      ...canonicalAvailable(),
      files: [
        ...(canonicalAvailable().files ?? []),
        {
          path: "unrelated.txt",
          revision: "r1",
          content: "entirely unrelated content",
          declaredScope: "project-acme",
        },
      ],
    },
    defaultBuilderPolicy(),
  );
  for (const candidate of extended.candidates) {
    if (candidate.sourceRef !== "unrelated.txt") {
      ok(
        beforeIds.has(candidate.candidateId),
        `unrelated addition changed ${candidate.candidateId}`,
      );
    }
  }
});

test("C: mutating one source changes only its own candidates", () => {
  const before = build();
  const beforeById = new Map(before.candidates.map((c) => [c.candidateId, c]));
  const mutated = buildCandidates(
    builderRequest(),
    {
      ...canonicalAvailable(),
      files: (canonicalAvailable().files ?? []).map((f) =>
        f.path === "README.md"
          ? { ...f, content: "Acme readme. Run tests with npm run check." }
          : f,
      ),
    },
    defaultBuilderPolicy(),
  );
  for (const candidate of mutated.candidates) {
    if (candidate.sourceRef === "README.md") {
      ok(
        !beforeById.has(candidate.candidateId),
        "mutated source must yield new identities",
      );
    } else {
      ok(
        beforeById.has(candidate.candidateId),
        `mutation leaked into ${candidate.candidateId}`,
      );
    }
  }
});

// --- backward compatibility ---

test("builder output is existing ContextCandidate schema, unchanged", () => {
  const built = build();
  for (const candidate of built.candidates) {
    deepStrictEqual(candidateFromJSON(candidateToJSON(candidate)), candidate);
  }
});

// --- end-to-end builder → compiler ---

test("builder candidates compile through the existing pipeline", () => {
  const built = build();
  const output = compileContext(
    {
      requestId: "builder-e2e-1",
      taskId: "modify-authentication-behaviour",
      usableTokenBudget: 4000,
      createdAt: "2026-09-26T00:00:00Z",
      activeScope: "project-acme",
      requiredIds: [],
      policyVersion: "compiler-policy-v1",
    },
    built.candidates,
    defaultPolicy(),
  );
  ok(output.result.success, JSON.stringify(output.result.failure));
  ok(output.bundle);
  equal(
    validateBundle(
      output.bundle,
      {
        requestId: "builder-e2e-1",
        taskId: "modify-authentication-behaviour",
        usableTokenBudget: 4000,
        createdAt: "2026-09-26T00:00:00Z",
        activeScope: "project-acme",
        requiredIds: [],
        policyVersion: "compiler-policy-v1",
      },
      built.candidates,
      defaultPolicy(),
    ).length,
    0,
  );
  equal(
    validateResult(
      output.result,
      {
        requestId: "builder-e2e-1",
        taskId: "modify-authentication-behaviour",
        usableTokenBudget: 4000,
        createdAt: "2026-09-26T00:00:00Z",
        activeScope: "project-acme",
        requiredIds: [],
        policyVersion: "compiler-policy-v1",
      },
      built.candidates,
    ).length,
    0,
  );
  const admitted = new Set(output.bundle.items.map((i) => i.id));
  const staleFull = built.candidates.find(
    (c) =>
      c.sourceRef === "src/auth.ts" &&
      c.representationId === "full" &&
      c.content.includes("r39"),
  );
  ok(staleFull);
  equal(admitted.has(staleFull.candidateId), false);
  const wrongScope = built.candidates.filter(
    (c) => c.sourceRef === "other-project/config.yaml",
  );
  for (const candidate of wrongScope) {
    equal(admitted.has(candidate.candidateId), false);
  }
  const hardRejections = output.result.trace.entries.filter(
    (e) => e.decision === "REJECTED_HARD",
  );
  ok(hardRejections.length > 0);
});

// --- builder metrics ---

test("builder reports structural metrics, never a quality score", () => {
  const built = build();
  const metrics = built.metrics;
  ok(metrics.availableItems > 0);
  equal(metrics.observations, built.trace.observationsDiscovered);
  equal(metrics.candidatesEmitted, built.candidates.length);
  equal(metrics.modelJudgedDerivations, 0);
  deepStrictEqual(built.trace.modelJudgments, []);
  ok(metrics.candidateYield > 1, "one observation yields several forms");
  ok(metrics.unknownFields > 0, "unknowns stay counted, not guessed");
  equal(metrics.conflictGroups, 1);
  ok(metrics.dependencyEdges > 0);
});
