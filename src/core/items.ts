/**
 * ContextItem record (v1 schema preserved). Minimal port of the
 * historical item primitive: identity, rendered content, and token
 * accounting with explicit provenance.
 */

import { estimateTokens } from "./tokens.ts";

export const ITEM_SCHEMA = "project_context.context_item.v1";

export interface ContextItem {
  readonly id: string;
  readonly source: string;
  readonly kind: string;
  readonly content: string;
  readonly position: number;
  readonly tokenCount: number;
  readonly tokenProvenance: string;
  readonly authority: string | null;
  readonly scope: string | null;
  readonly observedAt: string | null;
  readonly semanticId: string | null;
  readonly ref: string | null;
}

export function itemToJSON(item: ContextItem): Record<string, unknown> {
  return {
    schema_version: ITEM_SCHEMA,
    id: item.id,
    source: item.source,
    kind: item.kind,
    content: item.content,
    position: item.position,
    token_count: item.tokenCount,
    token_provenance: item.tokenProvenance,
    authority: item.authority,
    scope: item.scope,
    observed_at: item.observedAt,
    semantic_id: item.semanticId,
    ref: item.ref,
  };
}

function reqStr(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  if (typeof value !== "string") throw new Error(`invalid ${key}`);
  return value;
}

function optStrNull(data: Record<string, unknown>, key: string): string | null {
  const value = data[key] ?? null;
  if (value !== null && typeof value !== "string") {
    throw new Error(`invalid ${key}`);
  }
  return value;
}

export function itemFromJSON(data: unknown): ContextItem {
  if (typeof data !== "object" || data === null) {
    throw new Error("item is not an object");
  }
  const raw = data as Record<string, unknown>;
  const version = (raw["schema_version"] ?? ITEM_SCHEMA) as string;
  if (version !== ITEM_SCHEMA) {
    throw new Error(
      `unsupported ContextItem schema: ${JSON.stringify(version)}`,
    );
  }
  const position = raw["position"] ?? 0;
  const tokenCount = raw["token_count"] ?? 0;
  if (typeof position !== "number" || typeof tokenCount !== "number") {
    throw new Error("invalid item numbers");
  }
  return {
    id: reqStr(raw, "id"),
    source: reqStr(raw, "source"),
    kind: reqStr(raw, "kind"),
    content: reqStr(raw, "content"),
    position,
    tokenCount,
    tokenProvenance:
      typeof raw["token_provenance"] === "string"
        ? (raw["token_provenance"] as string)
        : "approximation",
    authority: optStrNull(raw, "authority"),
    scope: optStrNull(raw, "scope"),
    observedAt: optStrNull(raw, "observed_at"),
    semanticId: optStrNull(raw, "semantic_id"),
    ref: optStrNull(raw, "ref"),
  };
}

export function makeItem(input: {
  id: string;
  source: string;
  kind: string;
  content: string;
  authority?: string | null;
  scope?: string | null;
  semanticId?: string | null;
}): ContextItem {
  const [count, provenance] = estimateTokens(input.content);
  return {
    id: input.id,
    source: input.source,
    kind: input.kind,
    content: input.content,
    position: 0,
    tokenCount: count,
    tokenProvenance: provenance,
    authority: input.authority ?? null,
    scope: input.scope ?? null,
    observedAt: null,
    semanticId: input.semanticId ?? null,
    ref: null,
  };
}
