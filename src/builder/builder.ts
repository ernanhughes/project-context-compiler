/**
 * Candidate Builder: observations in, ContextCandidates out.
 *
 * For each valid observation the builder derives scope, freshness
 * and authority verdicts, a requirement class, a fidelity floor,
 * one or more representation forms with lineage, dependency edges
 * and conflict groups — then emits existing ContextCandidate
 * records unchanged in schema. Downstream compilation enforces
 * every constraint recorded here; nothing here admits, ranks,
 * budgets, transports, or judges usefulness.
 *
 * Determinism: pure functions of (request, available, policy).
 * No filesystem, network, model, env, clock or randomness. All
 * lists are sorted before output. `observedAt` values are carried
 * as opaque strings and never compared: age is not freshness.
 */

import { createHash } from "node:crypto";
import type { ContextCandidate, RequirementClass } from "../core/domain.ts";
import { estimateTokens, splitWords } from "../core/tokens.ts";
import { discover } from "./adapters.ts";
import type {
  AvailableInformation,
  BuilderMetrics,
  BuilderPolicy,
  BuilderRequest,
  BuilderTrace,
  BuildOutput,
  BuildRejection,
  ConflictGroup,
  DependencyEdge,
  FieldDerivation,
  FieldProvenance,
  SourceObservation,
} from "./types.ts";
import { BUILDER_VERSION } from "./types.ts";

const FORM_RANK: Readonly<Record<string, number>> = {
  reference: 0,
  anchor: 1,
  compact: 2,
  full: 3,
};

const ORDER_ROLE: Readonly<Record<string, string>> = {
  instruction: "instruction",
  file: "evidence",
  tool: "evidence",
  "tool-definition": "tool",
  "working-state": "state",
  memory: "support",
  retrieval: "support",
};

const BAND_PRIORITY: Readonly<Record<RequirementClass, number>> = {
  MANDATORY: 0,
  REQUIRED: 1,
  PREFERRED: 2,
  DISCRETIONARY: 3,
};

function shortHash(text: string): string {
  return createHash("sha256").update(text, "utf-8").digest("hex").slice(0, 12);
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

interface Verdict {
  readonly eligible: boolean;
  readonly reason: string;
  readonly provenance: FieldProvenance;
}

function scopeVerdict(
  observation: SourceObservation,
  activeScope: string,
): Verdict {
  const declared = observation.declaredScope;
  if (declared === null || declared === "") {
    return {
      eligible: false,
      reason: `scope unknown for ${observation.sourceIdentity}: fail closed`,
      provenance: "unknown",
    };
  }
  if (declared === activeScope) {
    return {
      eligible: true,
      reason: `declared scope ${declared} matches active scope`,
      provenance: "observed",
    };
  }
  return {
    eligible: false,
    reason: `declared scope ${declared} is not active scope ${activeScope}`,
    provenance: "observed",
  };
}

function freshnessVerdict(
  observation: SourceObservation,
  policy: BuilderPolicy,
): Verdict {
  if (observation.superseded) {
    return {
      eligible: false,
      reason: `superseded: ${observation.provenance}`,
      provenance: "observed",
    };
  }
  const status = observation.validatorStatus;
  if (status === "stale" || status === "superseded") {
    const who = observation.validatorId ?? "validator";
    return {
      eligible: false,
      reason: `${who} reports ${status}`,
      provenance: "observed",
    };
  }
  if (status === "current") {
    const who = observation.validatorId ?? "validator";
    return {
      eligible: true,
      reason: `${who} affirms current`,
      provenance: "observed",
    };
  }
  if (policy.unknownFreshness === "eligible") {
    return {
      eligible: true,
      reason: `no staleness claim against ${observation.sourceIdentity}; age not considered`,
      provenance: "unknown",
    };
  }
  return {
    eligible: false,
    reason: `freshness unaffirmed for ${observation.sourceIdentity}`,
    provenance: "unknown",
  };
}

function authorityVerdict(
  observation: SourceObservation,
  policy: BuilderPolicy,
): Verdict {
  const entry =
    observation.authorityClass === null
      ? undefined
      : policy.authorityTable[observation.authorityClass];
  if (entry === undefined) {
    return {
      eligible: false,
      reason: `unknown authority class for ${observation.sourceIdentity}: fail closed`,
      provenance: "unknown",
    };
  }
  return {
    eligible: entry.eligible,
    reason: entry.reason,
    provenance: "policy",
  };
}

function requirementOf(
  observation: SourceObservation,
  policy: BuilderPolicy,
): { requirement: RequirementClass; provenance: FieldProvenance } {
  if (observation.declaredRequirement !== null) {
    return {
      requirement: observation.declaredRequirement,
      provenance: "declared",
    };
  }
  const fallback = policy.requirementBySource[observation.sourceType];
  if (fallback !== undefined) {
    return { requirement: fallback, provenance: "policy" };
  }
  return { requirement: "DISCRETIONARY", provenance: "neutral" };
}

function floorOf(
  observation: SourceObservation,
  policy: BuilderPolicy,
): { floor: number; provenance: FieldProvenance } {
  if (observation.retention === null) {
    return { floor: 0, provenance: "unknown" };
  }
  const floor = policy.floorByRetention[observation.retention];
  if (floor === undefined) {
    return { floor: 0, provenance: "unknown" };
  }
  return { floor, provenance: "policy" };
}

function compactText(payload: string, words: number): string | null {
  const all = splitWords(payload);
  if (all.length <= words) return null;
  return `${all.slice(0, words).join(" ")}… [compact: lossy deterministic truncation]`;
}

function anchorText(locator: string, version: string, payload: string): string {
  const first =
    payload.split(/\r?\n/u).find((line) => line.trim().length > 0) ?? "";
  const head = first.trim().slice(0, 120);
  return `[anchor] ${locator} @ ${version} :: ${head}`;
}

interface FormPlan {
  readonly form: string;
  readonly content: string;
  readonly lineage: string;
  readonly lossy: boolean;
}

function planForms(
  observation: SourceObservation,
  policy: BuilderPolicy,
): FormPlan[] {
  const forms: FormPlan[] = [
    {
      form: "full",
      content: observation.payload,
      lineage: `verbatim of ${observation.observationId}`,
      lossy: false,
    },
  ];
  const compact = compactText(observation.payload, policy.compactWords);
  if (compact !== null) {
    forms.push({
      form: "compact",
      content: compact,
      lineage: `deterministic-truncation(${policy.compactWords} words) of ${observation.observationId}`,
      lossy: true,
    });
  }
  if (policy.emitAnchor) {
    forms.push({
      form: "anchor",
      content: anchorText(
        observation.locator,
        observation.observedVersion,
        observation.payload,
      ),
      lineage: `anchor-extraction of ${observation.observationId}`,
      lossy: true,
    });
  }
  return forms;
}

function candidateIdFor(
  sourceIdentity: string,
  form: string,
  contentHash: string,
): string {
  return `cand-${shortHash(`${sourceIdentity}:${form}:${contentHash}`)}`;
}

function contentIdentityFor(payload: string): string {
  return `content-${shortHash(`payload:${payload}`)}`;
}

function hasCycle(edges: ReadonlyMap<string, readonly string[]>): boolean {
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (node: string): boolean => {
    if (done.has(node)) return false;
    if (visiting.has(node)) return true;
    visiting.add(node);
    for (const dep of edges.get(node) ?? []) {
      if (visit(dep)) return true;
    }
    visiting.delete(node);
    done.add(node);
    return false;
  };
  for (const node of edges.keys()) {
    if (visit(node)) return true;
  }
  return false;
}

export function buildCandidates(
  request: BuilderRequest,
  available: AvailableInformation,
  policy: BuilderPolicy,
): BuildOutput {
  const started = Date.now();
  if (available === null || available === undefined) {
    throw new Error("SOURCE_UNAVAILABLE: no available information supplied");
  }
  const discovery = discover(available);
  const rejections: BuildRejection[] = [...discovery.rejections];
  const derivations: FieldDerivation[] = [];
  const dependencyEdges: DependencyEdge[] = [];

  const candidatesById = new Map<string, ContextCandidate>();
  const emit = (candidate: ContextCandidate): void => {
    const existing = candidatesById.get(candidate.candidateId);
    if (existing !== undefined) {
      if (existing.content !== candidate.content) {
        throw new Error(
          `IDENTITY_COLLISION: ${candidate.candidateId} from ${candidate.sourceRef}`,
        );
      }
      return;
    }
    if (candidate.tokenCount < 0) {
      rejections.push({
        observationId: candidate.candidateId,
        code: "INVALID_CANDIDATE",
        reason: `negative token_count for ${candidate.candidateId}`,
      });
      return;
    }
    candidatesById.set(candidate.candidateId, candidate);
  };

  const note = (
    candidateId: string,
    field: string,
    value: string,
    provenance: FieldProvenance,
    detail: string,
  ): void => {
    derivations.push({ candidateId, field, value, provenance, detail });
  };

  // Tool definitions by call, so tool outputs can declare the dependency.
  const definitionIdByCall = new Map<string, string>();
  for (const observation of discovery.observations) {
    if (observation.sourceIdentity.startsWith("tool-definition:")) {
      const call = observation.locator;
      const contentHash = shortHash(`payload:${observation.payload}`);
      definitionIdByCall.set(
        call,
        candidateIdFor(observation.sourceIdentity, "full", contentHash),
      );
    }
  }

  interface PendingForm {
    readonly observation: SourceObservation;
    readonly form: string;
    readonly content: string;
    readonly lineage: string;
    readonly lossy: boolean;
    readonly contentIdentity: string;
    readonly candidateId: string;
    readonly scope: Verdict;
    readonly freshness: Verdict;
    readonly authority: Verdict;
    readonly requirement: RequirementClass;
    readonly requirementProvenance: FieldProvenance;
    readonly floor: number;
    readonly floorProvenance: FieldProvenance;
    readonly orderRole: string;
  }

  const pending: PendingForm[] = [];
  for (const observation of discovery.observations) {
    let forms: FormPlan[];
    try {
      forms = planForms(observation, policy);
    } catch {
      rejections.push({
        observationId: observation.observationId,
        code: "REPRESENTATION_FAILURE",
        reason: `representation generation failed for ${observation.sourceIdentity}`,
      });
      continue;
    }
    const scope = scopeVerdict(observation, request.activeScope);
    const freshness = freshnessVerdict(observation, policy);
    const authority = authorityVerdict(observation, policy);
    const { requirement, provenance: reqProv } = requirementOf(
      observation,
      policy,
    );
    const { floor, provenance: floorProv } = floorOf(observation, policy);
    const orderRole =
      observation.sourceIdentity.startsWith("tool-definition:") &&
      ORDER_ROLE["tool-definition"] !== undefined
        ? (ORDER_ROLE["tool-definition"] as string)
        : (ORDER_ROLE[observation.sourceType] ?? "support");
    for (const plan of forms) {
      const contentIdentity = contentIdentityFor(plan.content);
      const contentHash = shortHash(`payload:${plan.content}`);
      pending.push({
        observation,
        form: plan.form,
        content: plan.content,
        lineage: plan.lineage,
        lossy: plan.lossy,
        contentIdentity,
        candidateId: candidateIdFor(
          observation.sourceIdentity,
          plan.form,
          contentHash,
        ),
        scope,
        freshness,
        authority,
        requirement,
        requirementProvenance: reqProv,
        floor,
        floorProvenance: floorProv,
        orderRole,
      });
    }
  }

  interface EmittedPlan extends PendingForm {
    dependsOn: string[];
  }
  const emitted: EmittedPlan[] = [];
  for (const item of pending) {
    const dependsOn: string[] = [];
    if (
      item.observation.sourceType === "tool" &&
      item.observation.sourceIdentity.startsWith("tool-output:")
    ) {
      const call = item.observation.locator;
      const definitionId = definitionIdByCall.get(call);
      if (definitionId !== undefined && definitionId !== item.candidateId) {
        dependsOn.push(definitionId);
        dependencyEdges.push({
          from: item.candidateId,
          to: definitionId,
          reason: `tool output requires its tool definition (${call})`,
        });
      } else if (definitionId === undefined) {
        note(
          item.candidateId,
          "dependsOn",
          "[]",
          "unknown",
          `tool definition for ${call} absent: output stands alone, prerequisite exposed as missing`,
        );
      }
    }
    emitted.push({ ...item, dependsOn });
  }

  // Reference forms: pointers, not resident content. A reference is
  // emitted only when anchors are enabled so its "resolve via" text
  // never names a form the build did not produce; otherwise the
  // dangling pointer is refused loudly at build time. References
  // carry no compiler dependency edge in v1: their resolvability is
  // a lineage claim in the trace. (A reference that depended on its
  // own anchor could never be admitted: the compiler admits at most
  // one form per content, so the edge would be unsatisfiable.
  // Compiler-level dependsOn is reserved for cross-content needs
  // such as a tool output requiring its tool definition.)
  if (policy.emitReference) {
    for (const item of pending) {
      if (item.form !== "full") continue;
      if (!policy.emitAnchor) {
        rejections.push({
          observationId: item.observation.observationId,
          code: "REPRESENTATION_FAILURE",
          reason: `reference for ${item.observation.sourceIdentity} refused: anchor emission disabled so the pointer would dangle`,
        });
        continue;
      }
      const anchorId = candidateIdFor(
        item.observation.sourceIdentity,
        "anchor",
        shortHash(
          `payload:${anchorText(item.observation.locator, item.observation.observedVersion, item.observation.payload)}`,
        ),
      );
      const content =
        `[reference] ${item.observation.locator} @ ` +
        `${item.observation.observedVersion} — resolve via ${anchorId}`;
      const contentHash = shortHash(`payload:${content}`);
      const referenceId = candidateIdFor(
        item.observation.sourceIdentity,
        "reference",
        contentHash,
      );
      const referenceDependsOn: string[] = [];
      if (
        item.observation.sourceType === "tool" &&
        item.observation.sourceIdentity.startsWith("tool-output:")
      ) {
        const definitionId = definitionIdByCall.get(item.observation.locator);
        if (definitionId !== undefined) {
          referenceDependsOn.push(definitionId);
          dependencyEdges.push({
            from: referenceId,
            to: definitionId,
            reason: `tool reference requires its tool definition (${item.observation.locator})`,
          });
        }
      }
      note(
        referenceId,
        "resolvesVia",
        anchorId,
        "derived",
        `reference pointer; anchor ${anchorId} emitted in the same build when eligible`,
      );
      emitted.push({
        ...item,
        form: "reference",
        content,
        lineage: `pointer to ${item.observation.observationId} via ${anchorId}`,
        lossy: true,
        contentIdentity: contentIdentityFor(item.observation.payload),
        candidateId: referenceId,
        dependsOn: referenceDependsOn,
      });
    }
  }

  // Structural conflicts: one locator, incompatible payloads.
  // Members are grouped; resolution stays downstream.
  const conflicts: ConflictGroup[] = [];
  const byConflictKey = new Map<string, SourceObservation[]>();
  for (const observation of discovery.observations) {
    if (observation.conflictKey === null) continue;
    const list = byConflictKey.get(observation.conflictKey) ?? [];
    list.push(observation);
    byConflictKey.set(observation.conflictKey, list);
  }
  const conflictGroupByObservation = new Map<
    string,
    { groupId: string; required: boolean }
  >();
  const conflictBandByGroup = new Map<string, RequirementClass>();
  for (const [conflictKey, members] of byConflictKey) {
    const distinct = new Set(
      members.map((m) => shortHash(`payload:${m.payload}`)),
    );
    if (distinct.size < 2) continue;
    const conflictId = `conflict-${shortHash(conflictKey)}`;
    const compilerGroupId = `grp-${shortHash(`conflict:${conflictKey}`)}`;
    // One required group needs one band: take the strongest present.
    // The group is marked required only when every member is
    // gate-eligible: a stale version must never hold its fresh
    // counterpart hostage, and gates still apply per candidate at
    // compile time. Grouping stays visible in the trace either way.
    let band: RequirementClass = "DISCRETIONARY";
    let allEligible = true;
    for (const member of members) {
      const { requirement } = requirementOf(member, policy);
      if ((BAND_PRIORITY[requirement] ?? 3) < (BAND_PRIORITY[band] ?? 3)) {
        band = requirement;
      }
      if (
        !scopeVerdict(member, request.activeScope).eligible ||
        !freshnessVerdict(member, policy).eligible ||
        !authorityVerdict(member, policy).eligible
      ) {
        allEligible = false;
      }
    }
    const markerContent =
      `[conflict] ${conflictKey}: ${distinct.size} incompatible versions present; ` +
      `both preserved, resolution is downstream`;
    const markerHash = shortHash(`payload:${markerContent}`);
    const markerId = candidateIdFor(
      `conflict-marker:${conflictKey}`,
      "full",
      markerHash,
    );
    const memberScope = members.every(
      (m) => scopeVerdict(m, request.activeScope).eligible,
    );
    const memberFresh = members.every(
      (m) => freshnessVerdict(m, policy).eligible,
    );
    const markerScope: Verdict = memberScope
      ? {
          eligible: true,
          reason: `all conflicting versions in scope for ${conflictKey}`,
          provenance: "derived",
        }
      : {
          eligible: false,
          reason: `a conflicting version of ${conflictKey} is out of scope`,
          provenance: "derived",
        };
    const markerFreshness: Verdict = memberFresh
      ? {
          eligible: true,
          reason: `no staleness claim against the conflict set ${conflictKey}`,
          provenance: "derived",
        }
      : {
          eligible: false,
          reason: `a conflicting version of ${conflictKey} is stale`,
          provenance: "derived",
        };
    const markerAuthority: Verdict = {
      eligible: true,
      reason: "conflict marker: builder-generated structural record",
      provenance: "derived",
    };
    const [markerTokens] = estimateTokens(markerContent);
    const marker: ContextCandidate = {
      candidateId: markerId,
      contentIdentity: contentIdentityFor(markerContent),
      representationId: "conflict-marker",
      formRank: 3,
      minRank: 0,
      sourceKind: "builder",
      sourceRef: conflictKey,
      kind: "conflict-marker",
      content: markerContent,
      tokenCount: markerTokens,
      tokenSource: "approximation",
      requirement: band,
      orderRole: "evidence",
      scopeEligible: markerScope.eligible,
      scopeReason: markerScope.reason,
      freshnessEligible: markerFreshness.eligible,
      freshnessReason: markerFreshness.reason,
      authorityEligible: markerAuthority.eligible,
      authorityReason: markerAuthority.reason,
      dependsOn: [],
      groupId: compilerGroupId,
      groupRequired: allEligible,
      coverageKeys: [conflictKey],
      relevance: 0.5,
      isDefaultForm: true,
    };
    emit(marker);
    note(
      markerId,
      "scope",
      String(markerScope.eligible),
      markerScope.provenance,
      markerScope.reason,
    );
    note(
      markerId,
      "freshness",
      String(markerFreshness.eligible),
      markerFreshness.provenance,
      markerFreshness.reason,
    );
    note(
      markerId,
      "authority",
      String(markerAuthority.eligible),
      markerAuthority.provenance,
      markerAuthority.reason,
    );
    note(markerId, "requirement", band, "derived", "strongest member band");
    conflictBandByGroup.set(compilerGroupId, band);
    conflicts.push({
      conflictId,
      conflictKey,
      members: members.map((m) => m.observationId),
      compilerGroupId,
    });
    for (const member of members) {
      conflictGroupByObservation.set(member.observationId, {
        groupId: compilerGroupId,
        required: allEligible,
      });
    }
    void conflictId;
  }

  // Emit candidates. Conflict members join their group at full form
  // with the group band; other forms stay ungrouped alternatives.
  for (const item of emitted) {
    const grouping = conflictGroupByObservation.get(
      item.observation.observationId,
    );
    const inConflictGroup =
      grouping !== undefined &&
      item.form === "full" &&
      item.observation.conflictKey !== null;
    const requirement = inConflictGroup
      ? ((conflictBandByGroup.get(grouping.groupId) ??
          item.requirement) as RequirementClass)
      : item.requirement;
    const [tokenCount] = estimateTokens(item.content);
    // One content, several candidates: every form of one observation
    // shares the payload-hash content identity, so the compiler treats
    // them as alternatives and admits at most one. Lineage (which
    // derivation produced the form, and whether it is lossy) lives in
    // the representation id and the trace, not in the identity.
    const contentIdentity = contentIdentityFor(item.observation.payload);
    const candidate: ContextCandidate = {
      candidateId: item.candidateId,
      contentIdentity,
      representationId:
        item.form === "full"
          ? `full`
          : item.form === "compact"
            ? `compact`
            : item.form === "anchor"
              ? `anchor`
              : `reference`,
      formRank: FORM_RANK[item.form] ?? 3,
      minRank: item.floor,
      sourceKind:
        item.observation.sourceIdentity.startsWith("tool-definition:") &&
        item.observation.sourceType === "tool"
          ? "tool"
          : item.observation.sourceType,
      sourceRef: item.observation.locator,
      kind:
        item.observation.sourceType === "instruction"
          ? "instruction"
          : item.observation.sourceType === "tool"
            ? item.observation.sourceIdentity.startsWith("tool-definition:")
              ? "tool-definition"
              : "tool-output"
            : item.observation.sourceType === "file"
              ? "source"
              : item.observation.sourceType === "memory"
                ? "recall"
                : "note",
      content: item.content,
      tokenCount,
      tokenSource: "approximation",
      requirement,
      orderRole: item.orderRole,
      scopeEligible: item.scope.eligible,
      scopeReason: item.scope.reason,
      freshnessEligible: item.freshness.eligible,
      freshnessReason: item.freshness.reason,
      authorityEligible: item.authority.eligible,
      authorityReason: item.authority.reason,
      dependsOn: [...item.dependsOn],
      groupId: inConflictGroup ? grouping.groupId : null,
      groupRequired: inConflictGroup ? grouping.required : false,
      coverageKeys: [...item.observation.coverageKeys],
      relevance: item.observation.relevance,
      isDefaultForm: item.form === "full",
    };
    // Full-form content identity is the payload hash so that two
    // versions of one locator are distinct contents in one group,
    // while every derived form keeps lineage to its derivation.
    emit(candidate);
    note(
      candidate.candidateId,
      "identity",
      candidate.contentIdentity,
      "derived",
      item.lineage,
    );
    note(
      candidate.candidateId,
      "scope",
      String(candidate.scopeEligible),
      item.scope.provenance,
      candidate.scopeReason,
    );
    note(
      candidate.candidateId,
      "freshness",
      String(candidate.freshnessEligible),
      item.freshness.provenance,
      candidate.freshnessReason,
    );
    note(
      candidate.candidateId,
      "authority",
      String(candidate.authorityEligible),
      item.authority.provenance,
      candidate.authorityReason,
    );
    note(
      candidate.candidateId,
      "requirement",
      candidate.requirement,
      item.requirementProvenance,
      item.observation.declaredRequirement !== null
        ? "declared by source"
        : "builder policy default by source type",
    );
    note(
      candidate.candidateId,
      "floor",
      String(candidate.minRank),
      item.floorProvenance,
      item.observation.retention === null
        ? "retention unknown: floor 0, visible as unknown"
        : `retention ${item.observation.retention}`,
    );
    note(
      candidate.candidateId,
      "tokenCount",
      String(candidate.tokenCount),
      "derived",
      "word-based estimate, approximation",
    );
    note(
      candidate.candidateId,
      "relevance",
      String(candidate.relevance),
      item.observation.relevanceProvenance,
      item.observation.relevanceProvenance === "declared"
        ? "carried from retrieval score; never used for authority"
        : "neutral default; builder does not rank",
    );
    if (item.lossy) {
      note(candidate.candidateId, "fidelity", "lossy", "derived", item.lineage);
    }
  }

  const candidates = [...candidatesById.values()].sort((a, b) =>
    compareStrings(a.candidateId, b.candidateId),
  );

  // Post-emit checks: dangling dependencies abort loudly; cycles are
  // reported in the trace but still emitted (the compiler terminates
  // on cycles instead of looping).
  const known = new Set(candidates.map((c) => c.candidateId));
  for (const candidate of candidates) {
    for (const dep of candidate.dependsOn) {
      if (!known.has(dep)) {
        throw new Error(
          `INVALID_DEPENDENCY: ${candidate.candidateId} needs absent ${dep}`,
        );
      }
    }
  }
  const graph = new Map<string, readonly string[]>(
    candidates.map((c) => [c.candidateId, c.dependsOn]),
  );
  const cyclic = hasCycle(graph);

  derivations.sort((a, b) =>
    a.candidateId < b.candidateId
      ? -1
      : a.candidateId > b.candidateId
        ? 1
        : a.field < b.field
          ? -1
          : a.field > b.field
            ? 1
            : 0,
  );
  const sortedEdges = [...dependencyEdges].sort((a, b) =>
    compareStrings(a.from, b.from) !== 0
      ? compareStrings(a.from, b.from)
      : compareStrings(a.to, b.to),
  );
  const sortedConflicts = [...conflicts].sort((a, b) =>
    compareStrings(a.conflictId, b.conflictId),
  );

  const representationsGenerated: Record<string, number> = {};
  for (const candidate of candidates) {
    const form = candidate.representationId;
    representationsGenerated[form] = (representationsGenerated[form] ?? 0) + 1;
  }
  const bySourceType: Record<string, number> = {};
  for (const candidate of candidates) {
    bySourceType[candidate.sourceKind] =
      (bySourceType[candidate.sourceKind] ?? 0) + 1;
  }
  let unknownFields = 0;
  let deterministicDerivations = 0;
  for (const derivation of derivations) {
    if (derivation.provenance === "unknown") unknownFields += 1;
    else deterministicDerivations += 1;
  }

  const trace: BuilderTrace = {
    builderVersion: BUILDER_VERSION,
    requestId: request.requestId,
    sourcesConsulted: [...discovery.sourcesConsulted].sort(compareStrings),
    observationsDiscovered: discovery.observations.length,
    observationsEmitted: new Set(candidates.map((c) => c.sourceRef)).size,
    rejections: [...rejections],
    representationsGenerated,
    derivations,
    dependencies: sortedEdges,
    conflicts: sortedConflicts,
    modelJudgments: [],
    candidateIds: candidates.map((c) => c.candidateId),
    cyclicDependency: cyclic,
  };

  const metrics: BuilderMetrics = {
    availableItems: discovery.availableItems,
    observations: discovery.observations.length,
    candidatesEmitted: candidates.length,
    candidatesRejected: rejections.length,
    bySourceType,
    byRepresentation: { ...representationsGenerated },
    deterministicDerivations,
    modelJudgedDerivations: 0,
    unknownFields,
    conflictGroups: conflicts.length,
    dependencyEdges: sortedEdges.length,
    candidateYield:
      discovery.observations.length === 0
        ? 0
        : candidates.length / discovery.observations.length,
    buildLatencyMs: Date.now() - started,
  };

  return { candidates, trace, metrics };
}
