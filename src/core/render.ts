/**
 * Deterministic generic text renderer. Port of the Python reference:
 * ordered item contents between stable markers. No transport markers.
 */

import { SEPARATOR } from "./engine.ts";
import type { ContextBundle } from "./bundle.ts";

export const BUNDLE_OPEN = "[CONTEXT BUNDLE]";
export const BUNDLE_CLOSE = "[/CONTEXT BUNDLE]";

export function renderBundleText(bundle: ContextBundle): string {
  const body = bundle.items.map((item) => item.content).join(SEPARATOR);
  const lines = [
    BUNDLE_OPEN,
    `id: ${bundle.id}`,
    `items: ${bundle.items.length}`,
  ];
  if (body) {
    lines.push("---", body);
  }
  lines.push(BUNDLE_CLOSE);
  return lines.join("\n") + "\n";
}
