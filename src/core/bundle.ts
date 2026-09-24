/**
 * ContextBundle record (v1 schema preserved). One exact ordered
 * rendering for one computation: layout_trace equals item order
 * exactly, and the content hash is order-sensitive.
 *
 * Hashing replicates the Python reference byte-for-byte:
 * UTF-8(item.id) + NUL + UTF-8(item.content) + NUL per item in
 * order, then SHA-256. Provenance is an opaque passthrough.
 */

import { createHash, randomUUID } from "node:crypto";
import { itemFromJSON, itemToJSON, type ContextItem } from "./items.ts";

export const BUNDLE_SCHEMA = "project_context.context_bundle.v1";
export const ITEM_SCHEMA_VERSION = "project_context.context_item.v1";

export interface ContextBundle {
  readonly id: string;
  readonly items: readonly ContextItem[];
  readonly createdAt: string;
  readonly layoutTrace: readonly string[];
  readonly evidenceClass: string;
  readonly provenance: Record<string, unknown> | null;
}

export function bundleToJSON(bundle: ContextBundle): Record<string, unknown> {
  return {
    schema_version: BUNDLE_SCHEMA,
    id: bundle.id,
    items: bundle.items.map(itemToJSON),
    created_at: bundle.createdAt,
    layout_trace: [...bundle.layoutTrace],
    evidence_class: bundle.evidenceClass,
    provenance: bundle.provenance ? { ...bundle.provenance } : null,
  };
}

export function bundleFromJSON(data: unknown): ContextBundle {
  if (typeof data !== "object" || data === null) {
    throw new Error("bundle is not an object");
  }
  const raw = data as Record<string, unknown>;
  const version = (raw["schema_version"] ?? BUNDLE_SCHEMA) as string;
  if (version !== BUNDLE_SCHEMA) {
    throw new Error(
      `unsupported ContextBundle schema: ${JSON.stringify(version)}`,
    );
  }
  const provenance = raw["provenance"] ?? null;
  if (provenance !== null && typeof provenance !== "object") {
    throw new Error("invalid bundle provenance");
  }
  const itemsRaw = raw["items"];
  if (!Array.isArray(itemsRaw)) throw new Error("invalid bundle items");
  const traceRaw = raw["layout_trace"];
  if (
    !Array.isArray(traceRaw) ||
    !traceRaw.every((v) => typeof v === "string")
  ) {
    throw new Error("invalid layout_trace");
  }
  const bundle: ContextBundle = {
    id: raw["id"] as string,
    items: itemsRaw.map(itemFromJSON),
    createdAt: raw["created_at"] as string,
    layoutTrace: [...(traceRaw as string[])],
    evidenceClass: (raw["evidence_class"] ?? "synthetic") as string,
    provenance: provenance
      ? { ...(provenance as Record<string, unknown>) }
      : null,
  };
  checkLayout(bundle);
  return bundle;
}

export function checkLayout(bundle: ContextBundle): void {
  const rendered = bundle.items.map((item) => item.id);
  if (
    rendered.length !== bundle.layoutTrace.length ||
    rendered.some((id, index) => id !== bundle.layoutTrace[index])
  ) {
    throw new Error("layout_trace must equal item order exactly");
  }
}

export function renderedTokenTotal(bundle: ContextBundle): number {
  return bundle.items.reduce((sum, item) => sum + item.tokenCount, 0);
}

export function contentHash(bundle: ContextBundle): string {
  const digest = createHash("sha256");
  for (const item of bundle.items) {
    digest.update(item.id, "utf-8");
    digest.update(Buffer.from([0]));
    digest.update(item.content, "utf-8");
    digest.update(Buffer.from([0]));
  }
  return digest.digest("hex");
}

export function buildBundle(input: {
  items: readonly ContextItem[];
  bundleId?: string | null;
  createdAt: string;
  evidenceClass?: string;
  provenance?: Record<string, unknown> | null;
}): ContextBundle {
  const ordered = input.items.map((item, index) => ({
    ...item,
    position: index,
  }));
  const bundle: ContextBundle = {
    id:
      input.bundleId ?? `bundle-${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    items: ordered,
    createdAt: input.createdAt,
    layoutTrace: ordered.map((item) => item.id),
    evidenceClass: input.evidenceClass ?? "synthetic",
    provenance: input.provenance ?? null,
  };
  checkLayout(bundle);
  return bundle;
}
