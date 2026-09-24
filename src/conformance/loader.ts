/**
 * Strict JSON loaders for compiler-v1 fixture files. Port of the
 * Python reference: unknown keys are rejected so malformed inputs
 * fail loudly. Truth files are never touched here.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  candidateFromJSON,
  requestFromJSON,
  type ContextCandidate,
  type ContextRequest,
} from "../core/domain.ts";

export const CANDIDATE_KEYS: ReadonlySet<string> = new Set([
  "candidate_id",
  "content_identity",
  "representation_id",
  "form_rank",
  "min_rank",
  "source_kind",
  "source_ref",
  "kind",
  "content",
  "token_count",
  "token_source",
  "requirement",
  "order_role",
  "scope_eligible",
  "scope_reason",
  "freshness_eligible",
  "freshness_reason",
  "authority_eligible",
  "authority_reason",
  "depends_on",
  "group_id",
  "group_required",
  "coverage_keys",
  "relevance",
  "is_default_form",
]);

export const REQUEST_KEYS: ReadonlySet<string> = new Set([
  "request_id",
  "task_id",
  "usable_token_budget",
  "created_at",
  "active_scope",
  "required_ids",
  "policy_version",
]);

const EVALUATOR_KEYS = ["eval_class", "oracle_"];

function rejectUnknown(
  record: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
  what: string,
): void {
  const unknown = Object.keys(record).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new Error(`unknown ${what} keys ${unknown.sort().join(",")} in ${path}`);
  }
  for (const key of Object.keys(record)) {
    if (EVALUATOR_KEYS.some((prefix) => key === prefix || key.startsWith(prefix))) {
      throw new Error(`evaluator key ${key} rejected in ${path}`);
    }
  }
}

export function loadCandidateFile(path: string): ContextCandidate[] {
  const raw = JSON.parse(readFileSync(path, "utf-8")) as unknown;
  if (
    typeof raw !== "object" ||
    raw === null ||
    !Array.isArray((raw as Record<string, unknown>)["candidates"])
  ) {
    throw new Error(`bad candidate file (need {'candidates': [...]}): ${path}`);
  }
  const loaded: ContextCandidate[] = [];
  for (const record of (raw as Record<string, unknown[]>)["candidates"] as Record<
    string,
    unknown
  >[]) {
    rejectUnknown(record, CANDIDATE_KEYS, path, "candidate");
    const candidate = candidateFromJSON(record);
    if (!Number.isInteger(candidate.tokenCount) || candidate.tokenCount < 0) {
      throw new Error(`invalid token_count in ${path}: ${candidate.candidateId}`);
    }
    if (!(candidate.relevance >= 0.0 && candidate.relevance <= 1.0)) {
      throw new Error(`relevance out of range in ${path}: ${candidate.candidateId}`);
    }
    loaded.push(candidate);
  }
  return loaded;
}

export function loadRequestFile(path: string): ContextRequest {
  const raw = JSON.parse(readFileSync(path, "utf-8")) as unknown;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`bad request file (need object): ${path}`);
  }
  const record = raw as Record<string, unknown>;
  rejectUnknown(record, REQUEST_KEYS, path, "request");
  return requestFromJSON(record);
}

export function loadFixtureSet(
  root: string,
): Record<string, { candidates: string; request: string }> {
  const found: Record<string, { candidates: string; request: string }> = {};
  for (const entry of readdirSync(root).sort()) {
    if (!entry.endsWith(".candidates.json")) continue;
    const name = entry.slice(0, -".candidates.json".length);
    const requestPath = join(root, `${name}.request.json`);
    if (!existsSync(requestPath)) {
      throw new Error(`fixture ${name}: missing ${name}.request.json`);
    }
    found[name] = {
      candidates: join(root, entry),
      request: requestPath,
    };
  }
  return found;
}
