"""A single identifiable unit participating in a context bundle.

Minimal extraction of the historical item record: identity,
rendered content, and token accounting with explicit provenance.
`id` identifies this representation instance; `semantic_id`
optionally identifies the underlying information across
representations.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from context_compiler.tokens import estimate_tokens

SCHEMA_VERSION = "project_context.context_item.v1"

__all__ = ["SCHEMA_VERSION", "ContextItem", "estimate_tokens", "make_item"]


@dataclass(frozen=True)
class ContextItem:
    id: str
    source: str
    kind: str
    content: str
    position: int = 0
    token_count: int = 0
    token_provenance: str = "approximation"
    authority: str | None = None
    scope: str | None = None
    observed_at: str | None = None
    semantic_id: str | None = None
    ref: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": SCHEMA_VERSION,
            "id": self.id,
            "source": self.source,
            "kind": self.kind,
            "content": self.content,
            "position": self.position,
            "token_count": self.token_count,
            "token_provenance": self.token_provenance,
            "authority": self.authority,
            "scope": self.scope,
            "observed_at": self.observed_at,
            "semantic_id": self.semantic_id,
            "ref": self.ref,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ContextItem":
        version = data.get("schema_version", SCHEMA_VERSION)
        if version != SCHEMA_VERSION:
            raise ValueError(f"unsupported ContextItem schema: {version!r}")
        return cls(
            id=data["id"],
            source=data["source"],
            kind=data["kind"],
            content=data["content"],
            position=data.get("position", 0),
            token_count=data.get("token_count", 0),
            token_provenance=data.get("token_provenance", "approximation"),
            authority=data.get("authority"),
            scope=data.get("scope"),
            observed_at=data.get("observed_at"),
            semantic_id=data.get("semantic_id"),
            ref=data.get("ref"),
        )


def make_item(
    *,
    id: str,
    source: str,
    kind: str,
    content: str,
    authority: str | None = None,
    scope: str | None = None,
    semantic_id: str | None = None,
) -> ContextItem:
    """Build an item with a local token estimate. Position is assigned by
    the bundle builder, not here."""
    count, provenance = estimate_tokens(content)
    return ContextItem(
        id=id,
        source=source,
        kind=kind,
        content=content,
        token_count=count,
        token_provenance=provenance,
        authority=authority,
        scope=scope,
        semantic_id=semantic_id,
    )
