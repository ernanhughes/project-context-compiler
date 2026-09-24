/**
 * Token-estimation parity tests. The v1 rule is Python
 * `max(1, round(words * 1.3))` with ties-to-even; JavaScript
 * `Math.round` rounds half up, so these cases pin the
 * compatibility helper. Expected values computed from CPython.
 */

import { deepStrictEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  estimateTokens,
  pythonRoundHalfEven,
  splitWords,
} from "../../src/core/tokens.ts";

test("ties go to even, not half up", () => {
  const cases: Array<[number, number]> = [
    [6.5, 6],
    [19.5, 20],
    [32.5, 32],
    [45.5, 46],
    [58.5, 58],
    [0.5, 0],
    [1.5, 2],
    [2.5, 2],
  ];
  for (const [input, want] of cases) {
    equal(pythonRoundHalfEven(input), want, `round(${input})`);
    // Math.round would disagree on most of these.
  }
  // Sanity: Math.round really differs (guard against vacuous tests).
  equal(Math.round(6.5) === 6, false);
});

test("word-count estimates match Python around .5 landings", () => {
  const words = (n: number) => Array(n).fill("w").join(" ");
  const cases: Array<[number, number]> = [
    [0, 0],
    [1, 1],
    [5, 6],
    [15, 20],
    [25, 32],
    [35, 46],
    [45, 58],
    [10, 13],
  ];
  for (const [n, want] of cases) {
    equal(estimateTokens(n === 0 ? "" : words(n))[0], want, `words=${n}`);
  }
});

test("provenance is always approximation", () => {
  equal(estimateTokens("hello world")[1], "approximation");
  equal(estimateTokens("")[1], "approximation");
});

test("splitting mirrors Python str.split()", () => {
  deepStrictEqual(splitWords("  a  b\tc\nd  "), ["a", "b", "c", "d"]);
  deepStrictEqual(splitWords(""), []);
  deepStrictEqual(splitWords("   "), []);
  deepStrictEqual(splitWords("a\u00A0b"), ["a", "b"]); // non-breaking space
  deepStrictEqual(splitWords("a\u2003b"), ["a", "b"]); // em space
  deepStrictEqual(splitWords(" single "), ["single"]);
  // A naive space-split would keep empties and miss tabs/newlines.
  equal("  a  b".split(" ").filter((s) => s.length > 0).length === 2, true);
  equal(splitWords("a\tb").length, 2);
});
