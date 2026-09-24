/**
 * Worktree-relative file resolution for compiler tools.
 * Filesystem IO lives here, never in src/core.
 */

import { readFileSync } from "node:fs";
import { isAbsolute, normalize, resolve, sep } from "node:path";

export function resolveWorktreeFile(root: string, given: string): string {
  if (typeof given !== "string" || given.length === 0) {
    throw new Error("file path must be a non-empty string");
  }
  const absolute = isAbsolute(given) ? normalize(given) : resolve(root, given);
  const rootNorm = normalize(root);
  if (absolute !== rootNorm && !absolute.startsWith(rootNorm + sep)) {
    throw new Error(`path escapes the worktree: ${given}`);
  }
  return absolute;
}

export function readJSONFile(root: string, given: string): unknown {
  const path = resolveWorktreeFile(root, given);
  return JSON.parse(readFileSync(path, "utf-8")) as unknown;
}
