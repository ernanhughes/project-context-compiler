/**
 * Source adapters: heterogeneous available information in,
 * normalized SourceObservations out.
 *
 * Each adapter exposes one function over its own typed inputs.
 * No adapter reads the filesystem, network, clock, or a model.
 * Malformed inputs become rejections, never guessed candidates.
 */
import type { AvailableInformation, BuildRejection, SourceObservation } from "./types.ts";
export interface Discovery {
    readonly observations: readonly SourceObservation[];
    readonly rejections: readonly BuildRejection[];
    readonly sourcesConsulted: readonly string[];
    readonly availableItems: number;
}
/**
 * Discover observations from heterogeneous available information.
 * Deterministic: observations are sorted by observationId.
 */
export declare function discover(available: AvailableInformation): Discovery;
//# sourceMappingURL=adapters.d.ts.map