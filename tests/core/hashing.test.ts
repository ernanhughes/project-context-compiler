/**
 * Bundle identity tests: exact SHA-256 replication, NUL separators,
 * UTF-8 handling, order sensitivity.
 */

import { equal, notEqual, ok } from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  buildBundle,
  contentHash,
  type ContextBundle,
} from "../../src/core/bundle.ts";
import { makeItem } from "../../src/core/items.ts";

function bundleOf(contents: Array<[string, string]>): ContextBundle {
  return buildBundle({
    items: contents.map(([id, content]) =>
      makeItem({ id, source: "s", kind: "k", content }),
    ),
    bundleId: "b",
    createdAt: "2026-09-24T00:00:00Z",
  });
}

test("hash replicates id+NUL+content+NUL per item", () => {
  const bundle = bundleOf([
    ["a", "alpha"],
    ["b", "beta"],
  ]);
  const expected = createHash("sha256");
  for (const [id, content] of [
    ["a", "alpha"],
    ["b", "beta"],
  ]) {
    expected.update(id, "utf-8");
    expected.update(Buffer.from([0]));
    expected.update(content, "utf-8");
    expected.update(Buffer.from([0]));
  }
  equal(contentHash(bundle), expected.digest("hex"));
});

test("reordered bundles hash differently", () => {
  const forward = bundleOf([
    ["a", "alpha"],
    ["b", "beta"],
    ["c", "gamma"],
  ]);
  const backward = bundleOf([
    ["c", "gamma"],
    ["b", "beta"],
    ["a", "alpha"],
  ]);
  notEqual(contentHash(forward), contentHash(backward));
});

test("UTF-8 content hashes by bytes, not chars", () => {
  const bundle = bundleOf([["u", "héllo wörld ✓"]]);
  const expected = createHash("sha256")
    .update("u", "utf-8")
    .update(Buffer.from([0]))
    .update("héllo wörld ✓", "utf-8")
    .update(Buffer.from([0]))
    .digest("hex");
  equal(contentHash(bundle), expected);
  ok(/^[0-9a-f]{64}$/.test(contentHash(bundle)));
});

test("hash matches the Python golden for a real case", async () => {
  const { readFileSync } = await import("node:fs");
  const { bundleFromJSON } = await import("../../src/core/bundle.ts");
  const url = new URL(
    "../../conformance/golden/python-v0.1.0/heterogeneous-basic-medium.json",
    import.meta.url,
  );
  const golden = JSON.parse(readFileSync(url, "utf-8")) as {
    bundle: unknown;
    bundle_hash: string;
  };
  const bundle = bundleFromJSON(golden.bundle);
  equal(contentHash(bundle), golden.bundle_hash);
});
