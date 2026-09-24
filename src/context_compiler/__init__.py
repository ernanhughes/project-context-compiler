"""Context Compiler: deterministic, policy-governed context assembly.

The compiler answers one question: given a computation request,
candidate representations, explicit policy, and finite budget, what
exact ordered context bundle may legally be supplied?

It never executes a model and never judges whether an answer was
good. It performs no IO, uses no clock, no randomness, no network.
Identical explicit inputs yield identical outputs.
"""

from context_compiler.bundle import (
    ContextBundle,
    build_bundle,
)
from context_compiler.domain import (
    COMPILATION_RESULT_SCHEMA,
    COMPILE_FAILURE_SCHEMA,
    CONTEXT_CANDIDATE_SCHEMA,
    CONTEXT_REQUEST_SCHEMA,
    DECISION_TRACE_SCHEMA,
    CompilationResult,
    CompileFailure,
    ContextCandidate,
    ContextRequest,
    DecisionTrace,
    FailureReason,
    RequirementClass,
    TraceDecision,
    TraceEntry,
)
from context_compiler.engine import (
    SEPARATOR,
    CompileOutput,
    compile_context,
    eligibility,
)
from context_compiler.items import (
    ContextItem,
    estimate_tokens,
    make_item,
)
from context_compiler.policy import (
    COMPILER_POLICY_SCHEMA,
    DEFAULT_POLICY_VERSION,
    CompilerPolicy,
    default_policy,
)
from context_compiler.render import render_bundle_text
from context_compiler.validation import validate_bundle, validate_result

__version__ = "0.1.0"

__all__ = [
    "__version__",
    "COMPILATION_RESULT_SCHEMA",
    "COMPILER_POLICY_SCHEMA",
    "COMPILE_FAILURE_SCHEMA",
    "CONTEXT_CANDIDATE_SCHEMA",
    "CONTEXT_REQUEST_SCHEMA",
    "DECISION_TRACE_SCHEMA",
    "SEPARATOR",
    "CompilationResult",
    "CompileFailure",
    "CompileOutput",
    "CompilerPolicy",
    "ContextBundle",
    "ContextCandidate",
    "ContextItem",
    "ContextRequest",
    "DecisionTrace",
    "FailureReason",
    "RequirementClass",
    "TraceDecision",
    "TraceEntry",
    "build_bundle",
    "compile_context",
    "default_policy",
    "DEFAULT_POLICY_VERSION",
    "eligibility",
    "estimate_tokens",
    "make_item",
    "render_bundle_text",
    "validate_bundle",
    "validate_result",
]
