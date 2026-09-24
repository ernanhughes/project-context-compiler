/**
 * Local token estimation with exact Python v1 compatibility.
 *
 * The historical rule is `max(1, round(words * 1.3))` for non-empty
 * text, else 0, where `round` is Python banker's rounding
 * (ties-to-even) and words come from Python `str.split()` (arbitrary
 * whitespace runs). JavaScript `Math.round` rounds half up, so a
 * compatibility helper reproduces the v1 rule exactly.
 */
export declare function pythonRoundHalfEven(value: number): number;
/**
 * Python `str.split()` semantics: split on arbitrary whitespace runs,
 * discard empties. Covers spaces, tabs, newlines, and Unicode
 * whitespace via `\s` with the `u` flag.
 */
export declare function splitWords(text: string): string[];
export declare function estimateTokens(text: string): [number, string];
//# sourceMappingURL=tokens.d.ts.map