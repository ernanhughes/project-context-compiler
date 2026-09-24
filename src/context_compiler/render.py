"""Deterministic generic text renderer for ContextBundle.

Turns an exact ordered bundle into exact text for demonstration and
integration. This is NOT the compiler's selection logic (engine.py)
and NOT a transport adapter: downstream transports wrap this text
further (for example, the OpenCode runtime block) without changing
what was admitted.

Deliberately free of transport markers such as `[CONTEXT RUNTIME]`.
"""

from __future__ import annotations

from context_compiler.bundle import ContextBundle
from context_compiler.engine import SEPARATOR

BUNDLE_OPEN = "[CONTEXT BUNDLE]"
BUNDLE_CLOSE = "[/CONTEXT BUNDLE]"


def render_bundle_text(bundle: ContextBundle) -> str:
    """Render ordered item contents between stable markers.

    Deterministic: same bundle bytes in, same text out. Item order is
    the bundle's layout order; separators match the engine's render
    accounting so token math stays consistent.
    """
    body = SEPARATOR.join(item.content for item in bundle.items)
    lines = [BUNDLE_OPEN, f"id: {bundle.id}", f"items: {len(bundle.items)}"]
    if body:
        lines.extend(["---", body])
    lines.append(BUNDLE_CLOSE)
    return "\n".join(lines) + "\n"
