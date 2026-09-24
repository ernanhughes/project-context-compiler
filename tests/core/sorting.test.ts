/**
 * Deterministic string ordering. The engine must not use
 * locale-sensitive comparison for decision ordering.
 */

import { deepStrictEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import { compareStrings } from "../../src/core/engine.ts";

test("code-point order, not locale order", () => {
  const ids = ["b-2", "a-10", "A-1", "a-2", "Z", "z", "0", "9", "-", "_"];
  deepStrictEqual([...ids].sort(compareStrings), [...ids].sort());
  // Uppercase sorts before lowercase in code-point order.
  equal(compareStrings("Z", "a") < 0, true);
  equal(compareStrings("a", "a"), 0);
  equal(compareStrings("a", "b") < 0, true);
});

test("comparator is total and deterministic", () => {
  const ids = ["inc-anchor", "inc-full", "mand-a", "scope-out", "tool-def"];
  const once = [...ids].sort(compareStrings);
  const twice = [...ids].sort(compareStrings);
  deepStrictEqual(once, twice);
  deepStrictEqual(once, [
    "inc-anchor",
    "inc-full",
    "mand-a",
    "scope-out",
    "tool-def",
  ]);
});
