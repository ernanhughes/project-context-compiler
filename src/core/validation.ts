/**
 * Independent validators. Every success legality is recomputed from
 * explicit inputs rather than trusted from engine internals. That
 * includes the four hard-eligibility predicates, which are written out
 * again here on purpose: a checker that asked the engine whether a
 * candidate was legal could only agree with the engine.
 */

import type { ContextBundle } from "./bundle.ts";
import type {
  CompilationResult,
  ContextCandidate,
  ContextRequest,
  RequirementClass,
} from "./domain.ts";
import type { CompilerPolicy } from "./policy.ts";

/**
 * The hard-eligibility rules, restated independently of the engine.
 * Returns the name of the first failed rule, or null when legal.
 */
function illegality(c: ContextCandidate): string | null {
  if (c.scopeEligible !== true) return "scope";
  if (c.freshnessEligible !== true) return "freshness";
  if (c.authorityEligible !== true) return "authority";
  if (c.formRank < c.minRank) return "floor";
  return null;
}

export function validateBundle(
  bundle: ContextBundle,
  request: ContextRequest,
  candidates: readonly ContextCandidate[],
  _policy: CompilerPolicy,
): string[] {
  void _policy;
  const problems: string[] = [];
  const byId = new Map(candidates.map((c) => [c.candidateId, c]));
  const liveIds = bundle.items.map((item) => item.id);

  if (
    liveIds.length !== bundle.layoutTrace.length ||
    liveIds.some((id, index) => id !== bundle.layoutTrace[index])
  ) {
    problems.push("layout trace must equal item order exactly");
  }

  const total = bundle.items.reduce((sum, item) => sum + item.tokenCount, 0);
  if (total > request.usableTokenBudget) {
    problems.push(
      `rendered cost ${total} exceeds budget ${request.usableTokenBudget}`,
    );
  }

  for (const itemId of liveIds) {
    const candidate = byId.get(itemId);
    if (!candidate) {
      problems.push(`bundle item not a candidate: ${itemId}`);
      continue;
    }
    const failed = illegality(candidate);
    if (failed !== null) {
      problems.push(`admitted hard-ineligible candidate ${itemId}: ${failed}`);
    }
    if (candidate.formRank < candidate.minRank) {
      problems.push(`admitted candidate below floor: ${itemId}`);
    }
  }

  const requiredIds = new Set(request.requiredIds);
  const effective = (c: ContextCandidate): RequirementClass => {
    if (requiredIds.has(c.candidateId)) {
      return c.requirement === "MANDATORY" ? "MANDATORY" : "REQUIRED";
    }
    return c.requirement;
  };
  for (const requiredId of request.requiredIds) {
    if (!liveIds.includes(requiredId)) {
      const candidate = byId.get(requiredId);
      const band = candidate ? effective(candidate) : null;
      if (band === "MANDATORY" || band === "REQUIRED") {
        problems.push(`explicitly required candidate absent: ${requiredId}`);
      }
    }
  }

  for (const itemId of liveIds) {
    const candidate = byId.get(itemId);
    if (!candidate) continue;
    for (const dep of candidate.dependsOn) {
      if (!liveIds.includes(dep)) {
        problems.push(`unsatisfied dependency: ${itemId} needs ${dep}`);
      }
    }
  }

  const groups = new Map<string, string[]>();
  for (const candidate of candidates) {
    if (candidate.groupId && candidate.groupRequired) {
      const list = groups.get(candidate.groupId) ?? [];
      list.push(candidate.candidateId);
      groups.set(candidate.groupId, list);
    }
  }
  for (const [groupId, members] of groups) {
    const present = members.filter((mid) => liveIds.includes(mid));
    if (present.length > 0 && present.length !== members.length) {
      problems.push(`required group partially admitted: ${groupId}`);
    }
  }

  const seenContent = new Set<string>();
  for (const itemId of liveIds) {
    const candidate = byId.get(itemId);
    if (!candidate) continue;
    if (seenContent.has(candidate.contentIdentity)) {
      problems.push(
        `duplicate representation admitted: ${candidate.contentIdentity}`,
      );
    }
    seenContent.add(candidate.contentIdentity);
  }
  return problems;
}

export function validateResult(
  result: CompilationResult,
  request: ContextRequest,
  candidates: readonly ContextCandidate[],
): string[] {
  const problems: string[] = [];
  const traced = new Set(result.trace.entries.map((e) => e.candidateId));
  const considered = new Set(candidates.map((c) => c.candidateId));
  if (result.success) {
    if (
      traced.size !== considered.size ||
      [...considered].some((id) => !traced.has(id))
    ) {
      problems.push(
        `trace covers ${traced.size} of ${considered.size} considered candidates`,
      );
    }
  } else if ([...traced].some((id) => !considered.has(id))) {
    problems.push("trace references unconsidered candidates");
  }
  if (result.trace.requestId !== request.requestId) {
    problems.push("trace request mismatch");
  }
  if (result.success && result.failure !== null) {
    problems.push("success carries a failure");
  }
  if (!result.success && result.failure === null) {
    problems.push("failure carries no failure record");
  }
  if (!result.success && result.bundleId !== null) {
    problems.push("failure carries a bundle identity");
  }
  if (result.trace.legacySchema !== "v1") {
    problems.push(...traceSemantics(result, candidates));
  }
  return problems;
}

/** Transitive dependencies in discovery order, excluding the start. */
function transitiveDependencies(
  start: string,
  byId: ReadonlyMap<string, ContextCandidate>,
): string[] {
  const seen = new Set<string>([start]);
  const order: string[] = [];
  const visit = (id: string): void => {
    for (const dep of byId.get(id)?.dependsOn ?? []) {
      if (seen.has(dep)) continue;
      seen.add(dep);
      order.push(dep);
      visit(dep);
    }
  };
  visit(start);
  return order;
}

/**
 * v2 trace semantics: an admission must show the budget it spent and,
 * where the candidate has dependencies, the closure that came with it.
 * These are exactly the two fields a v1 trace left meaningless.
 */
function traceSemantics(
  result: CompilationResult,
  candidates: readonly ContextCandidate[],
): string[] {
  const problems: string[] = [];
  const byId = new Map(candidates.map((c) => [c.candidateId, c]));
  for (const entry of result.trace.entries) {
    const candidate = byId.get(entry.candidateId);
    if (!candidate) continue;
    const expectedClosure = transitiveDependencies(entry.candidateId, byId);
    if (
      entry.dependencyClosure.length !== expectedClosure.length ||
      entry.dependencyClosure.some((id, i) => id !== expectedClosure[i])
    ) {
      problems.push(`trace closure wrong for ${entry.candidateId}`);
    }
    if (entry.decision === "ADMITTED") {
      if (entry.budgetBefore - entry.budgetAfter < candidate.tokenCount) {
        problems.push(`trace budget did not advance for ${entry.candidateId}`);
      }
    } else if (entry.budgetAfter > entry.budgetBefore) {
      problems.push(`trace budget rose for ${entry.candidateId}`);
    }
    if (entry.pulledInBy.length > 0 && entry.decision !== "ADMITTED") {
      problems.push(`trace pulled-in-by on non-admission ${entry.candidateId}`);
    }
  }
  return problems;
}
