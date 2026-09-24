/**
 * ContextItem record (v1 schema preserved). Minimal port of the
 * historical item primitive: identity, rendered content, and token
 * accounting with explicit provenance.
 */
export declare const ITEM_SCHEMA = "project_context.context_item.v1";
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
export declare function itemToJSON(item: ContextItem): Record<string, unknown>;
export declare function itemFromJSON(data: unknown): ContextItem;
export declare function makeItem(input: {
    id: string;
    source: string;
    kind: string;
    content: string;
    authority?: string | null;
    scope?: string | null;
    semanticId?: string | null;
}): ContextItem;
//# sourceMappingURL=items.d.ts.map