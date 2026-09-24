/**
 * Deterministic generic text renderer. Port of the Python reference:
 * ordered item contents between stable markers. No transport markers.
 */
import type { ContextBundle } from "./bundle.ts";
export declare const BUNDLE_OPEN = "[CONTEXT BUNDLE]";
export declare const BUNDLE_CLOSE = "[/CONTEXT BUNDLE]";
export declare function renderBundleText(bundle: ContextBundle): string;
//# sourceMappingURL=render.d.ts.map