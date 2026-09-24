/**
 * ContextBundle record (v1 schema preserved). One exact ordered
 * rendering for one computation: layout_trace equals item order
 * exactly, and the content hash is order-sensitive.
 *
 * Hashing replicates the Python reference byte-for-byte:
 * UTF-8(item.id) + NUL + UTF-8(item.content) + NUL per item in
 * order, then SHA-256. Provenance is an opaque passthrough.
 */
import { type ContextItem } from "./items.ts";
export declare const BUNDLE_SCHEMA = "project_context.context_bundle.v1";
export declare const ITEM_SCHEMA_VERSION = "project_context.context_item.v1";
export interface ContextBundle {
    readonly id: string;
    readonly items: readonly ContextItem[];
    readonly createdAt: string;
    readonly layoutTrace: readonly string[];
    readonly evidenceClass: string;
    readonly provenance: Record<string, unknown> | null;
}
export declare function bundleToJSON(bundle: ContextBundle): Record<string, unknown>;
export declare function bundleFromJSON(data: unknown): ContextBundle;
export declare function checkLayout(bundle: ContextBundle): void;
export declare function renderedTokenTotal(bundle: ContextBundle): number;
export declare function contentHash(bundle: ContextBundle): string;
export declare function buildBundle(input: {
    items: readonly ContextItem[];
    bundleId?: string | null;
    createdAt: string;
    evidenceClass?: string;
    provenance?: Record<string, unknown> | null;
}): ContextBundle;
//# sourceMappingURL=bundle.d.ts.map