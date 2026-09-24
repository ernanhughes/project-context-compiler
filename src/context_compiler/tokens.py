"""Local token estimation. Approximation only, never provider-observed.

`estimate_tokens` implements the historical fixture convention
(max(1, round(words * 1.3)) for non-empty text, else 0) with provenance
always "approximation". Callers with real counts should supply
`token_count`/`token_source` directly on the candidate instead.
"""

from __future__ import annotations


def estimate_tokens(text: str) -> tuple[int, str]:
    """Naive local token estimate. NOT a real tokenizer.

    Returns (estimate, provenance). Never store this as
    provider-observed telemetry.
    """
    words = len(text.split())
    if words == 0:
        return 0, "approximation"
    return max(1, round(words * 1.3)), "approximation"
