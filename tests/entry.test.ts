/**
 * Package entry shape: default export is the OpenCode plugin,
 * named exports expose the library, and ./core is importable.
 */

import { deepStrictEqual, equal, ok } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import rootDefault, { PLUGIN_ID } from "../src/index.ts";
import * as core from "../src/core/index.ts";

test("root default export is the plugin", () => {
  ok(rootDefault);
  equal(PLUGIN_ID, "project-context.compiler");
});

test("root exposes the library", () => {
  equal(typeof core.compileContext, "function");
  equal(typeof core.defaultPolicy, "function");
  equal(typeof core.validateBundle, "function");
  equal(typeof core.validateResult, "function");
  equal(typeof core.renderBundleText, "function");
});

test("core subpath exposes the same compiler", async () => {
  const sub = (await import("../src/core/index.ts")) as typeof core;
  equal(sub.compileContext, core.compileContext);
  deepStrictEqual(sub.defaultPolicy(), core.defaultPolicy());
});

test("package.json declares dual entries and plugin dependency", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const manifest = JSON.parse(
    readFileSync(join(root, "package.json"), "utf-8"),
  ) as {
    name: string;
    version: string;
    exports: Record<string, string>;
    dependencies: Record<string, string>;
  };
  equal(manifest.name, "project-context-compiler");
  equal(manifest.version, "0.3.0");
  deepStrictEqual(manifest.exports, {
    ".": "./src/index.ts",
    "./core": "./src/core/index.ts",
  });
  ok(manifest.dependencies["@opencode/plugin"].startsWith("^2."));
});
