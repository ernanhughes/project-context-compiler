/**
 * Independent validators, ported from the Python reference. Every
 * success legality is recomputed from explicit inputs rather than
 * trusted from engine internals.
 */

import type { ContextBundle } from "./bundle.ts";
import type {
  CompilationResult,
  ContextCandidate,
  ContextRequest,
  RequirementClass,
} from "./domain.ts";
import { eligibility } from "./engine.ts";
import type { CompilerPolicy } from "./policy.ts";

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
    const [eligible, code] = eligibility(candidate);
    if (!eligible) {
      problems.push(`admitted hard-ineligible candidate ${itemId}: ${code}`);
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
  return problems;
}
