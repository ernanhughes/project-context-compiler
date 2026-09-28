/**
 * Builder boundary tests: src/builder is deterministic and
 * side-effect-light like core. It imports only node:crypto besides
 * the core records and token estimator. The single clock read
 * (build-latency observability) is excluded from the replay
 * contract: same inputs give same candidates and trace; only
 * metrics.buildLatencyMs may differ.
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

test("builder imports nothing from opencode, models, network, or fs", () => {
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
    "Math.random",
    "randomUUID",
    "fetch(",
  ];
  for (const file of files("builder")) {
    const text = readFileSync(join(root, "builder", file), "utf-8");
    for (const token of forbidden) {
      equal(text.includes(token), false, `builder/${file} contains ${token}`);
    }
  }
});

test("builder never compares or parses time: age is not freshness", () => {
  for (const file of files("builder")) {
    const text = readFileSync(join(root, "builder", file), "utf-8");
    ok(!text.includes("observedAt <"), `builder/${file} compares time`);
    ok(!text.includes("observedAt >"), `builder/${file} compares time`);
    ok(!text.includes("Date.parse"), `builder/${file} parses time`);
  }
});

test("eligibility verdicts never consult relevance", () => {
  const builder = readFileSync(join(root, "builder", "builder.ts"), "utf-8");
  const scope = builder.slice(
    builder.indexOf("function scopeVerdict"),
    builder.indexOf("function freshnessVerdict"),
  );
  const freshness = builder.slice(
    builder.indexOf("function freshnessVerdict"),
    builder.indexOf("function authorityVerdict"),
  );
  const authority = builder.slice(
    builder.indexOf("function authorityVerdict"),
    builder.indexOf("function requirementOf"),
  );
  for (const [name, body] of [
    ["scope", scope],
    ["freshness", freshness],
    ["authority", authority],
  ] as const) {
    ok(!body.includes("relevance"), `${name} verdict consults relevance`);
  }
});
