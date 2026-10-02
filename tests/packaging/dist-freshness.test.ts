import { describe, test } from "node:test";
import { equal, ok } from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Packaging parity guard (Hardening Pass A): the tracked `dist/` output
 * must match the current sources. A stale dist ships a packed root entry
 * without builder exports while the export map promises them.
 * Run `npm run build` before committing source changes.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("dist freshness", () => {
  test("dist/builder output exists (builder is part of the root entry)", () => {
    ok(
      existsSync(join(ROOT, "dist", "builder", "index.js")),
      "dist/builder/index.js missing; run npm run build",
    );
  });

  test("dist root entry re-exports the builder surface", () => {
    const indexJs = readFileSync(join(ROOT, "dist", "index.js"), "utf8");
    ok(
      indexJs.includes("./builder/index.js"),
      "dist/index.js must re-export ./builder/index.js; run npm run build",
    );
    const builderJs = readFileSync(
      join(ROOT, "dist", "builder", "index.js"),
      "utf8",
    );
    ok(
      builderJs.includes("buildCandidates"),
      "dist/builder/index.js must export buildCandidates",
    );
    ok(
      indexJs.includes("compileContext") || indexJs.includes("./core/index.js"),
      "dist/index.js must serve the core surface",
    );
  });

  test("export map still serves the built entry points", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    equal(pkg.exports["."].default, "./dist/index.js");
    equal(pkg.exports["./core"].default, "./dist/core/index.js");
    ok(
      (pkg.files as string[]).includes("dist"),
      "package files must include dist",
    );
  });
});
