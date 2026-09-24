/**
 * Deterministic staged compiler. Behavioural port of the Python
 * reference (tag python-v0.1.0): same pipeline, same decisions, same
 * trace evidence. No redesign, no new heuristics.
 *
 * Pipeline:
 * validate inputs -> explicit required-source check -> hard
 * eligibility gates -> mandatory admission -> required admission ->
 * preferred/discretionary greedy -> alternative closeout ->
 * deterministic ordering -> render + exact budget validation +
 * repair -> trace + bundle-or-failure.
 *
 * Purity: no filesystem, network, models, env, clock, randomness,
 * subprocesses. Inputs are never mutated. Ordering uses an explicit
 * code-point string comparator (matches Python `sorted` for the
 * supported ID vocabulary; no locale-sensitive comparison).
 */

import type {
  CompilationResult,
  CompileFailure,
  ContextCandidate,
  ContextRequest,
  DecisionTrace,
  FailureReason,
  RequirementClass,
  TraceDecision,
  TraceEntry,
} from "./domain.ts";
import { buildBundle, contentHash, type ContextBundle } from "./bundle.ts";
import { estimateTokens } from "./tokens.ts";
import { makeItem } from "./items.ts";
import type { CompilerPolicy } from "./policy.ts";

export const SEPARATOR = "\n---\n";
export const SEPARATOR_TOKENS = estimateTokens(SEPARATOR)[0];

export const BAND_ORDER: readonly RequirementClass[] = [
  "MANDATORY",
  "REQUIRED",
  "PREFERRED",
  "DISCRETIONARY",
];

/** Deterministic string order, mirroring Python code-point sorting. */
export function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sortedStrings(values: Iterable<string>): string[] {
  return [...values].sort(compareStrings);
}

export interface CompileOutput {
  readonly bundle: ContextBundle | null;
  readonly result: CompilationResult;
}

export function headerTokens(request: ContextRequest): number {
  return estimateTokens(
    `${request.requestId} ${request.taskId} ${request.policyVersion}`,
  )[0];
}

export function decorationTokens(candidate: ContextCandidate): number {
  return estimateTokens(`${candidate.sourceKind} ${candidate.kind}`)[0];
}

export function itemRenderCost(candidate: ContextCandidate): number {
  return candidate.tokenCount + decorationTokens(candidate);
}

interface Gate {
  readonly eligible: boolean;
  readonly reasonCode: string;
  readonly reasonDetail: string;
}

function hardGate(candidate: ContextCandidate): Gate {
  if (!candidate.scopeEligible) {
    return {
      eligible: false,
      reasonCode: "scope_ineligible",
      reasonDetail: candidate.scopeReason,
    };
  }
  if (!candidate.freshnessEligible) {
    return {
      eligible: false,
      reasonCode: "freshness_ineligible",
      reasonDetail: candidate.freshnessReason,
    };
  }
  if (!candidate.authorityEligible) {
    return {
      eligible: false,
      reasonCode: "authority_ineligible",
      reasonDetail: candidate.authorityReason,
    };
  }
  if (candidate.formRank < candidate.minRank) {
    return {
      eligible: false,
      reasonCode: "illegal_representation",
      reasonDetail: `form_rank ${candidate.formRank} below floor ${candidate.minRank}`,
    };
  }
  return {
    eligible: true,
    reasonCode: "eligible",
    reasonDetail: "passed scope/freshness/authority/floor gates",
  };
}

export function eligibility(
  candidate: ContextCandidate,
): [boolean, string, string] {
  const gate = hardGate(candidate);
  return [gate.eligible, gate.reasonCode, gate.reasonDetail];
}

export function closureIds(
  recordId: string,
  byId: ReadonlyMap<string, ContextCandidate>,
): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const visit = (node: string): void => {
    if (seen.has(node)) return;
    seen.add(node);
    ordered.push(node);
    const candidate = byId.get(node);
    if (!candidate) return;
    for (const dep of candidate.dependsOn) visit(dep);
  };
  visit(recordId);
  return ordered;
}

export function compileContext(
  request: ContextRequest,
  candidates: readonly ContextCandidate[],
  policy: CompilerPolicy,
): CompileOutput {
  const problems = validateInputs(request, candidates);
  if (problems.length > 0) {
    throw new Error(`invalid compiler inputs: ${problems.join("; ")}`);
  }
  if (request.policyVersion !== policy.policyVersion) {
    throw new Error(
      `request policy ${JSON.stringify(request.policyVersion)} != ` +
        `compiler policy ${JSON.stringify(policy.policyVersion)}`,
    );
  }
  const state = new CompileState(request, [...candidates], policy);

  const missing = sortedStrings(
    [...request.requiredIds].filter((id) => !state.byId.has(id)),
  );
  if (missing.length > 0) {
    return state.fail(
      "REQUIRED_SOURCE_UNAVAILABLE",
      missing,
      `explicitly required candidates absent: ${missing.join(", ")}`,
    );
  }

  for (const candidate of candidates) {
    const gate = state.gates.get(candidate.candidateId);
    if (gate && !gate.eligible) {
      state.record(
        candidate,
        "REJECTED_HARD",
        gate.reasonCode,
        gate.reasonDetail,
        0,
        [],
        null,
      );
    }
  }

  for (const band of ["MANDATORY", "REQUIRED"] as const) {
    const outcome = state.admitBand(band, band === "MANDATORY");
    if (outcome !== null) return outcome;
  }
  state.closeOutAlternatives("MANDATORY");

  for (const band of ["PREFERRED", "DISCRETIONARY"] as const) {
    state.admitGreedy(band);
  }
  state.closeOutRemaining();

  const roleRank = new Map(
    policy.orderRoles.map((role, index) => [role, index]),
  );
  const rankSize = policy.orderRoles.length;
  const live = [...state.admitted.values()].sort((a, b) => {
    const ra = roleRank.get(a.orderRole) ?? rankSize;
    const rb = roleRank.get(b.orderRole) ?? rankSize;
    if (ra !== rb) return ra - rb;
    return compareStrings(a.candidateId, b.candidateId);
  });

  let bundle = state.render(live);
  let rendered = state.renderedCost(live);
  if (rendered > request.usableTokenBudget) {
    const repaired = state.repair(live, rendered);
    if (repaired === null) {
      return state.fail(
        "INSUFFICIENT_BUDGET",
        live.map((c) => c.candidateId),
        `rendered ${rendered} exceeds budget ${request.usableTokenBudget} with no legal repair`,
      );
    }
    live.length = 0;
    live.push(...repaired.live);
    bundle = repaired.bundle;
    rendered = repaired.rendered;
  }

  const bundleProblems = state.validateBundle(bundle, live);
  if (bundleProblems.length > 0) {
    return state.fail(
      "INSUFFICIENT_BUDGET",
      live.map((c) => c.candidateId),
      `post-compile validation failed: ${bundleProblems.join("; ")}`,
    );
  }

  for (const [index, candidate] of live.entries()) {
    const old = state.entries.get(candidate.candidateId);
    if (old)
      state.entries.set(candidate.candidateId, { ...old, position: index });
  }

  const trace: DecisionTrace = {
    requestId: request.requestId,
    policyVersion: policy.policyVersion,
    entries: sortedStrings(state.entries.keys()).map(
      (cid) => state.entries.get(cid) as TraceEntry,
    ),
  };
  const result: CompilationResult = {
    requestId: request.requestId,
    policyVersion: policy.policyVersion,
    success: true,
    bundleId: bundle.id,
    bundleTokens: rendered,
    bundleHash: contentHash(bundle),
    trace,
    failure: null,
  };
  return { bundle, result };
}

export function validateInputs(
  request: ContextRequest,
  candidates: readonly ContextCandidate[],
): string[] {
  void request;
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate.candidateId)) {
      errors.push(`duplicate candidate_id: ${candidate.candidateId}`);
    }
    seen.add(candidate.candidateId);
    if (candidate.tokenCount < 0) {
      errors.push(`negative token_count: ${candidate.candidateId}`);
    }
  }
  for (const candidate of candidates) {
    for (const dep of candidate.dependsOn) {
      if (!seen.has(dep)) {
        errors.push(
          `unknown dependency ${JSON.stringify(dep)} from ${candidate.candidateId}`,
        );
      }
    }
  }
  const groups = new Map<string, Set<string>>();
  for (const candidate of candidates) {
    if (candidate.groupId && candidate.groupRequired) {
      let bands = groups.get(candidate.groupId);
      if (!bands) {
        bands = new Set<string>();
        groups.set(candidate.groupId, bands);
      }
      bands.add(candidate.requirement);
    }
  }
  for (const [groupId, bands] of groups) {
    if (bands.size > 1) {
      errors.push(
        `required group ${groupId} spans bands: ${sortedStrings(bands)}`,
      );
    }
  }
  return errors;
}

class CompileState {
  readonly request: ContextRequest;
  readonly policy: CompilerPolicy;
  readonly byId: Map<string, ContextCandidate>;
  readonly ordered: ContextCandidate[];
  readonly gates: Map<string, Gate>;
  readonly budgetTotal: number;
  remaining: number;
  readonly covered = new Set<string>();
  readonly admitted = new Map<string, ContextCandidate>();
  admittedContent = new Set<string>();
  readonly entries = new Map<string, TraceEntry>();
  readonly requiredIds: Set<string>;

  constructor(
    request: ContextRequest,
    candidates: ContextCandidate[],
    policy: CompilerPolicy,
  ) {
    this.request = request;
    this.policy = policy;
    this.byId = new Map(candidates.map((c) => [c.candidateId, c]));
    this.ordered = [...candidates].sort((a, b) =>
      compareStrings(a.candidateId, b.candidateId),
    );
    this.gates = new Map(candidates.map((c) => [c.candidateId, hardGate(c)]));
    this.budgetTotal = request.usableTokenBudget;
    this.remaining = request.usableTokenBudget;
    this.requiredIds = new Set(request.requiredIds);
  }

  effectiveBand(candidate: ContextCandidate): RequirementClass {
    if (this.requiredIds.has(candidate.candidateId)) {
      if (candidate.requirement === "MANDATORY") return "MANDATORY";
      return "REQUIRED";
    }
    return candidate.requirement;
  }

  record(
    candidate: ContextCandidate,
    decision: TraceDecision,
    reasonCode: string,
    reasonDetail: string,
    marginal: number,
    closure: readonly string[],
    position: number | null,
  ): void {
    this.entries.set(candidate.candidateId, {
      candidateId: candidate.candidateId,
      contentIdentity: candidate.contentIdentity,
      representationId: candidate.representationId,
      decision,
      reasonCode,
      reasonDetail,
      priorityBand: this.effectiveBand(candidate),
      relevance: candidate.relevance,
      marginalCost: marginal,
      dependencyClosure: [...closure],
      budgetBefore: this.remaining,
      budgetAfter: this.remaining,
      position,
    });
  }

  fail(
    reason: FailureReason,
    blocking: readonly string[],
    diagnostic: string,
  ): CompileOutput {
    const trace: DecisionTrace = {
      requestId: this.request.requestId,
      policyVersion: this.policy.policyVersion,
      entries: sortedStrings(this.entries.keys()).map(
        (cid) => this.entries.get(cid) as TraceEntry,
      ),
    };
    const failure: CompileFailure = {
      requestId: this.request.requestId,
      policyVersion: this.policy.policyVersion,
      reason,
      blockingIds: sortedStrings(new Set(blocking)),
      budgetUsed: this.budgetTotal - this.remaining,
      budgetTotal: this.budgetTotal,
      diagnostic,
    };
    return {
      bundle: null,
      result: {
        requestId: this.request.requestId,
        policyVersion: this.policy.policyVersion,
        success: false,
        bundleId: null,
        bundleTokens: null,
        bundleHash: null,
        trace,
        failure,
      },
    };
  }

  marginalFor(recordIds: readonly string[]): [number, string[]] {
    const closure: string[] = [];
    for (const rid of recordIds) {
      for (const node of closureIds(rid, this.byId)) {
        if (!this.admitted.has(node) && !closure.includes(node)) {
          closure.push(node);
        }
      }
    }
    let cost = 0;
    for (const node of closure) {
      const candidate = this.byId.get(node);
      if (candidate) cost += candidate.tokenCount;
    }
    return [cost, closure];
  }

  commit(wanted: readonly string[], _cost: number, reasonDetail: string): void {
    void _cost;
    for (const node of sortedStrings(wanted)) {
      const candidate = this.byId.get(node);
      if (!candidate) continue;
      this.admitted.set(node, candidate);
      this.admittedContent.add(candidate.contentIdentity);
      for (const key of candidate.coverageKeys) this.covered.add(key);
      this.record(
        candidate,
        "ADMITTED",
        "admitted",
        reasonDetail,
        candidate.tokenCount,
        [],
        null,
      );
    }
  }

  formsOf(contentIdentity: string): ContextCandidate[] {
    return [...this.byId.values()]
      .filter((c) => c.contentIdentity === contentIdentity)
      .sort(
        (a, b) =>
          a.tokenCount - b.tokenCount ||
          compareStrings(a.candidateId, b.candidateId),
      );
  }

  groupMembers(groupId: string): ContextCandidate[] {
    return [...this.byId.values()]
      .filter((c) => c.groupId === groupId && c.groupRequired)
      .sort((a, b) => compareStrings(a.candidateId, b.candidateId));
  }

  admitBand(band: RequirementClass, mandatory: boolean): CompileOutput | null {
    if (mandatory) {
      const identities = sortedStrings(
        new Set(
          [...this.byId.values()]
            .filter((c) => this.effectiveBand(c) === "MANDATORY")
            .map((c) => c.contentIdentity),
        ),
      );
      for (const identity of identities) {
        if (this.admittedContent.has(identity)) continue;
        const forms = this.formsOf(identity).filter(
          (c) => this.effectiveBand(c) === "MANDATORY",
        );
        const eligible = forms.filter(
          (c) => this.gates.get(c.candidateId)?.eligible ?? false,
        );
        if (eligible.length === 0) {
          const floorOnly =
            forms.length > 0 &&
            forms.every(
              (c) =>
                this.gates.get(c.candidateId)?.reasonCode ===
                "illegal_representation",
            );
          if (floorOnly) {
            return this.fail(
              "NO_LEGAL_REPRESENTATION",
              [identity],
              `mandatory ${identity}: all forms violate floor`,
            );
          }
          return this.fail(
            "REQUIRED_INELIGIBLE",
            [identity],
            `mandatory ${identity}: no hard-eligible form`,
          );
        }
        const byMarginal = [...eligible].sort((a, b) => {
          const [ca] = this.marginalFor([a.candidateId]);
          const [cb] = this.marginalFor([b.candidateId]);
          if (ca !== cb) return ca - cb;
          return compareStrings(a.candidateId, b.candidateId);
        });
        let placed = false;
        for (const form of byMarginal) {
          const group =
            form.groupId && form.groupRequired
              ? this.groupMembers(form.groupId)
              : [form];
          const [cost, closure] = this.marginalFor(
            group.map((m) => m.candidateId),
          );
          if (cost > this.remaining) continue;
          const blocked = this.blockedNodes(group);
          if (blocked) {
            return this.fail(
              "UNSATISFIED_DEPENDENCY",
              [identity],
              `mandatory ${identity} blocked: ${blocked}`,
            );
          }
          this.commit(closure, cost, "mandatory");
          this.remaining -= cost;
          placed = true;
          break;
        }
        if (!placed) {
          return this.fail(
            "INSUFFICIENT_BUDGET",
            [identity],
            `mandatory ${identity} closure exceeds remaining budget`,
          );
        }
      }
    }
    if (band === "REQUIRED") {
      const units = this.bandUnits(band);
      const groupUnits: ContextCandidate[][] = [];
      const singleForms = new Map<string, ContextCandidate[]>();
      for (const unit of units) {
        if (unit.length > 1 || (unit[0]?.groupId && unit[0]?.groupRequired)) {
          groupUnits.push(unit);
        } else if (unit[0]) {
          const list = singleForms.get(unit[0].contentIdentity) ?? [];
          list.push(unit[0]);
          singleForms.set(unit[0].contentIdentity, list);
        }
      }
      for (const unit of groupUnits) {
        const [cost, closure] = this.marginalFor(
          unit.map((m) => m.candidateId),
        );
        const blocked = this.blockedNodes(unit);
        const members = unit.map((m) => m.candidateId).sort(compareStrings);
        if (blocked) {
          return this.fail(
            "UNRESOLVED_REQUIRED_GROUP",
            members,
            `required group cannot be satisfied: ${blocked}`,
          );
        }
        if (cost > this.remaining) {
          return this.fail(
            "UNRESOLVED_REQUIRED_GROUP",
            members,
            `required group exceeds remaining budget: ${members.join(", ")}`,
          );
        }
        this.commit(closure, cost, "required");
        this.remaining -= cost;
      }
      for (const identity of sortedStrings(singleForms.keys())) {
        if (this.admittedContent.has(identity)) continue;
        const forms = [...(singleForms.get(identity) ?? [])].sort((a, b) => {
          const [ca] = this.marginalFor([a.candidateId]);
          const [cb] = this.marginalFor([b.candidateId]);
          if (ca !== cb) return ca - cb;
          return compareStrings(a.candidateId, b.candidateId);
        });
        let placed = false;
        for (const form of forms) {
          const [cost, closure] = this.marginalFor([form.candidateId]);
          if (cost > this.remaining) continue;
          const blocked = this.blockedNodes([form]);
          if (blocked) {
            return this.fail(
              "UNSATISFIED_DEPENDENCY",
              [form.candidateId],
              `required form blocked: ${blocked}`,
            );
          }
          this.commit(closure, cost, "required");
          this.remaining -= cost;
          placed = true;
          for (const other of forms) {
            if (other.candidateId !== form.candidateId) {
              this.record(
                other,
                "REJECTED_ALTERNATIVE",
                "alternative_selected",
                "another form of this content admitted",
                0,
                [],
                null,
              );
            }
          }
          break;
        }
        if (!placed) {
          return this.fail(
            "INSUFFICIENT_BUDGET",
            [identity],
            `required ${identity}: no fitting legal form`,
          );
        }
      }
    }
    return null;
  }

  blockedNodes(unit: readonly ContextCandidate[]): string {
    const wanted: string[] = [];
    for (const member of unit) {
      for (const node of closureIds(member.candidateId, this.byId)) {
        if (!this.admitted.has(node) && !wanted.includes(node)) {
          wanted.push(node);
        }
      }
    }
    for (const node of wanted) {
      const gate = this.gates.get(node);
      if (gate && !gate.eligible) {
        return `dependency-ineligible:${node}(${gate.reasonCode})`;
      }
      const other = this.byId.get(node);
      if (
        other &&
        this.admittedContent.has(other.contentIdentity) &&
        !unit.some((m) => m.candidateId === node)
      ) {
        return `alternative-collision:${node}`;
      }
    }
    return "";
  }

  bandUnits(band: RequirementClass): ContextCandidate[][] {
    const units: ContextCandidate[][] = [];
    const seenGroups = new Set<string>();
    for (const candidate of this.ordered) {
      if (this.entries.has(candidate.candidateId)) continue;
      if (this.effectiveBand(candidate) !== band) continue;
      if (!(this.gates.get(candidate.candidateId)?.eligible ?? false)) continue;
      if (this.admittedContent.has(candidate.contentIdentity)) continue;
      if (candidate.groupId && candidate.groupRequired) {
        if (seenGroups.has(candidate.groupId)) continue;
        seenGroups.add(candidate.groupId);
        const members = this.groupMembers(candidate.groupId).filter(
          (m) =>
            !this.entries.has(m.candidateId) &&
            (this.gates.get(m.candidateId)?.eligible ?? false) &&
            !this.admittedContent.has(m.contentIdentity) &&
            this.effectiveBand(m) === band,
        );
        if (members.length > 0) units.push(members);
        continue;
      }
      units.push([candidate]);
    }
    return units;
  }

  admitGreedy(band: RequirementClass): void {
    for (;;) {
      const options = this.bandUnits(band);
      const ranked: Array<
        [[number, number, number, string], ContextCandidate[]]
      > = [];
      for (const unit of options) {
        const [cost] = this.marginalFor(unit.map((m) => m.candidateId));
        if (this.blockedNodes(unit)) {
          for (const member of unit) {
            if (!this.entries.has(member.candidateId)) {
              this.record(
                member,
                "REJECTED_DEPENDENCY",
                "dependency-blocked",
                "dependency ineligible or collides",
                cost,
                [],
                null,
              );
            }
          }
          continue;
        }
        const unitKeys = new Set<string>();
        for (const m of unit) for (const k of m.coverageKeys) unitKeys.add(k);
        let newCov = 0;
        for (const k of unitKeys) if (!this.covered.has(k)) newCov++;
        const bestRel = Math.max(...unit.map((m) => m.relevance));
        if (cost > this.remaining) {
          for (const member of unit) {
            if (!this.entries.has(member.candidateId)) {
              this.record(
                member,
                "REJECTED_BUDGET",
                "budget",
                "unit exceeds remaining budget",
                cost,
                [],
                null,
              );
            }
          }
          continue;
        }
        if (bestRel < this.policy.minDiscretionaryRelevance && newCov === 0) {
          for (const member of unit) {
            if (!this.entries.has(member.candidateId)) {
              this.record(
                member,
                "REJECTED_REDUNDANT",
                "no-earn",
                "below relevance threshold with no new coverage",
                cost,
                [],
                null,
              );
            }
          }
          continue;
        }
        ranked.push([
          [-bestRel, -newCov, cost, unit[0]?.candidateId ?? ""],
          unit,
        ]);
      }
      if (ranked.length === 0) break;
      ranked.sort((a, b) => {
        const ka = a[0];
        const kb = b[0];
        if (ka[0] !== kb[0]) return ka[0] - kb[0];
        if (ka[1] !== kb[1]) return ka[1] - kb[1];
        if (ka[2] !== kb[2]) return ka[2] - kb[2];
        return compareStrings(ka[3], kb[3]);
      });
      const bestUnit = ranked[0]?.[1] ?? [];
      const [cost, closure] = this.marginalFor(
        bestUnit.map((m) => m.candidateId),
      );
      this.commit(closure, cost, `${band.toLowerCase()}-greedy`);
      this.remaining -= cost;
    }
  }

  closeOutAlternatives(band: RequirementClass): void {
    for (const candidate of this.ordered) {
      if (this.entries.has(candidate.candidateId)) continue;
      if (
        this.effectiveBand(candidate) === band &&
        this.admittedContent.has(candidate.contentIdentity)
      ) {
        this.record(
          candidate,
          "REJECTED_ALTERNATIVE",
          "alternative_selected",
          "another form of this content admitted",
          0,
          [],
          null,
        );
      }
    }
  }

  closeOutRemaining(): void {
    for (const candidate of this.ordered) {
      if (this.entries.has(candidate.candidateId)) continue;
      if (this.admittedContent.has(candidate.contentIdentity)) {
        this.record(
          candidate,
          "REJECTED_ALTERNATIVE",
          "alternative_selected",
          "another form of this content admitted",
          0,
          [],
          null,
        );
      } else {
        const [cost] = this.marginalFor([candidate.candidateId]);
        this.record(
          candidate,
          "REJECTED_BUDGET",
          "budget",
          "no remaining budget path admits this record",
          cost,
          [],
          null,
        );
      }
    }
  }

  renderedCost(live: readonly ContextCandidate[]): number {
    let total = live.reduce((sum, c) => sum + itemRenderCost(c), 0);
    total += Math.max(0, live.length - 1) * SEPARATOR_TOKENS;
    total += headerTokens(this.request);
    return total;
  }

  render(live: readonly ContextCandidate[]): ContextBundle {
    const made = live.map((c) =>
      makeItem({
        id: c.candidateId,
        source: c.sourceKind,
        kind: c.kind,
        content: c.content,
      }),
    );
    const exacted = made.map((item, index) => ({
      ...item,
      tokenCount: itemRenderCost(live[index] as ContextCandidate),
    }));
    return buildBundle({
      items: exacted,
      bundleId: `${this.request.requestId}-bundle`,
      createdAt: this.request.createdAt,
      evidenceClass: "synthetic",
    });
  }

  repair(
    live: ContextCandidate[],
    rendered: number,
  ): {
    live: ContextCandidate[];
    bundle: ContextBundle;
    rendered: number;
  } | null {
    let current = [...live];
    let cost = rendered;
    let bundle = this.render(current);
    while (cost > this.request.usableTokenBudget) {
      if (this.policy.repair !== "drop-last-discretionary") return null;
      const droppable = [...current]
        .reverse()
        .filter(
          (c) =>
            this.effectiveBand(c) === "DISCRETIONARY" &&
            !dependsOnId(c.candidateId, current),
        );
      if (droppable.length === 0) return null;
      const victim = droppable[0] as ContextCandidate;
      const victims = new Set<string>([victim.candidateId]);
      if (victim.groupId && victim.groupRequired) {
        for (const c of current) {
          if (c.groupId === victim.groupId) victims.add(c.candidateId);
        }
      }
      current = current.filter((c) => !victims.has(c.candidateId));
      for (const vid of victims) this.admitted.delete(vid);
      this.admittedContent = new Set(
        [...this.admitted.keys()].map(
          (vid) => (this.byId.get(vid) as ContextCandidate).contentIdentity,
        ),
      );
      for (const vid of sortedStrings(victims)) {
        const old = this.entries.get(vid);
        if (old) {
          this.entries.set(vid, {
            ...old,
            decision: "REJECTED_BUDGET",
            reasonCode: "repair-drop",
            reasonDetail: "removed by render-overrun repair",
            position: null,
          });
        }
      }
      bundle = this.render(current);
      cost = this.renderedCost(current);
    }
    this.remaining = this.request.usableTokenBudget - cost;
    return { live: current, bundle, rendered: cost };
  }

  validateBundle(
    bundle: ContextBundle,
    live: readonly ContextCandidate[],
  ): string[] {
    const problems: string[] = [];
    if (this.renderedCost(live) > this.request.usableTokenBudget) {
      problems.push("rendered cost exceeds budget");
    }
    const ids = bundle.items.map((item) => item.id);
    if (
      ids.length !== bundle.layoutTrace.length ||
      ids.some((id, index) => id !== bundle.layoutTrace[index])
    ) {
      problems.push("layout trace mismatch");
    }
    const liveIds = new Set(live.map((c) => c.candidateId));
    for (const item of bundle.items) {
      if (!liveIds.has(item.id)) {
        problems.push(`bundle item not admitted: ${item.id}`);
      }
    }
    return problems;
  }
}

export function dependsOnId(
  candidateId: string,
  live: readonly ContextCandidate[],
): boolean {
  const byId = new Map(live.map((c) => [c.candidateId, c]));
  const seen = new Set<string>();
  const stack = live
    .map((c) => c.candidateId)
    .filter((id) => id !== candidateId);
  while (stack.length > 0) {
    const node = stack.pop() as string;
    if (seen.has(node)) continue;
    seen.add(node);
    const candidate = byId.get(node);
    if (!candidate) continue;
    for (const dep of candidate.dependsOn) {
      if (dep === candidateId) return true;
      stack.push(dep);
    }
  }
  return false;
}
