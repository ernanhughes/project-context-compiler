/**
 * Architecture boundary tests: src/core is independent of OpenCode.
 */

import { equal, ok } from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src");

function files(dir: string): string[] {
  return readdirSync(join(root, dir)).filter((f) => f.endsWith(".ts"));
}

test("core imports nothing from opencode, models, or network", () => {
  const forbidden = [
    "@opencode/plugin",
    "src/opencode",
    "../opencode",
    "openai",
    "anthropic",
    "node:fs",
    "node:path",
    "node:url",
    "process.env",
  ];
  for (const file of files("core")) {
    const text = readFileSync(join(root, "core", file), "utf-8");
    for (const token of forbidden) {
      equal(text.includes(token), false, `core/${file} contains ${token}`);
    }
  }
});

test("core has no session hooks or tool registrations", () => {
  for (const file of files("core")) {
    const text = readFileSync(join(root, "core", file), "utf-8");
    ok(!text.includes("session.hook"), `core/${file}`);
    ok(!text.includes("tool.transform"), `core/${file}`);
  }
});

test("plugin contains no compilation logic", () => {
  for (const file of files("opencode")) {
    const text = readFileSync(join(root, "opencode", file), "utf-8");
    ok(!text.includes("admitBand"), `opencode/${file}`);
    ok(!text.includes("closeOut"), `opencode/${file}`);
    ok(!text.includes("marginalFor"), `opencode/${file}`);
  }
  const tools = readFileSync(join(root, "opencode", "tools.ts"), "utf-8");
  ok(tools.includes("compileContext"), "tools delegate to core");
});
