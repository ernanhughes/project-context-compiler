/**
 * Local token estimation with exact Python v1 compatibility.
 *
 * The historical rule is `max(1, round(words * 1.3))` for non-empty
 * text, else 0, where `round` is Python banker's rounding
 * (ties-to-even) and words come from Python `str.split()` (arbitrary
 * whitespace runs). JavaScript `Math.round` rounds half up, so a
 * compatibility helper reproduces the v1 rule exactly.
 */
export function pythonRoundHalfEven(value) {
    const floor = Math.floor(value);
    const diff = value - floor;
    if (diff < 0.5)
        return floor;
    if (diff > 0.5)
        return floor + 1;
    return floor % 2 === 0 ? floor : floor + 1;
}
/**
 * Python `str.split()` semantics: split on arbitrary whitespace runs,
 * discard empties. Covers spaces, tabs, newlines, and Unicode
 * whitespace via `\s` with the `u` flag.
 */
export function splitWords(text) {
    const parts = text.split(/\s+/u);
    return parts.filter((part) => part.length > 0);
}
export function estimateTokens(text) {
    const words = splitWords(text).length;
    if (words === 0)
        return [0, "approximation"];
    return [Math.max(1, pythonRoundHalfEven(words * 1.3)), "approximation"];
}
//# sourceMappingURL=tokens.js.map