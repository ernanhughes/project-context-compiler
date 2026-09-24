/**
 * Explicit compiler tools for OpenCode. Each tool is a thin adapter:
 * parse file inputs, call the canonical `compileContext()` (or the
 * validators / trace inspection) in `src/core`, return JSON text.
 * No compilation logic lives here.
 */

import type { Info as ToolInfo } from "@opencode/plugin/promise/tool";
import {
  bundleToJSON,
  compileContext,
  defaultPolicy,
  renderBundleText,
  resultToJSON,
  validateBundle,
  validateResult,
} from "../core/index.ts";
import {
  bundleFromJSON,
  candidateFromJSON,
  policyFromJSON,
  requestFromJSON,
  resultFromJSON,
  traceFromJSON,
} from "../core/index.ts";
import { readJSONFile } from "./files.ts";

export const TOOL_NAMESPACE = "context_compiler";
export const TOOL_NAMES = [
  "context_compiler_compile",
  "context_compiler_validate",
  "context_compiler_inspect",
] as const;

function asRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null) {
    throw new Error("tool input must be an object");
  }
  return input as Record<string, unknown>;
}

function strInput(
  args: Record<string, unknown>,
  key: string,
  required: boolean,
): string | null {
  const value = args[key];
  if (value === undefined || value === null) {
    if (required) throw new Error(`missing required input: ${key}`);
    return null;
  }
  if (typeof value !== "string")
    throw new Error(`invalid input ${key}: expected string`);
  return value;
}

function candidateList(
  root: string,
  args: Record<string, unknown>,
): ReturnType<typeof candidateFromJSON>[] {
  const inline = args["candidates"];
  if (typeof inline === "string") {
    const parsed = JSON.parse(inline) as unknown;
    const list = (parsed as Record<string, unknown[]>)["candidates"] ?? parsed;
    if (!Array.isArray(list))
      throw new Error("inline candidates must be a list");
    return (list as Record<string, unknown>[]).map(candidateFromJSON);
  }
  const file = strInput(args, "candidates_file", true) as string;
  const parsed = readJSONFile(root, file) as unknown;
  const list = (parsed as Record<string, unknown[]>)["candidates"];
  if (!Array.isArray(list))
    throw new Error("candidates file must hold {candidates: [...]}");
  return (list as Record<string, unknown>[]).map(candidateFromJSON);
}

function requestDoc(root: string, args: Record<string, unknown>) {
  const inline = args["request"];
  if (typeof inline === "string") {
    return requestFromJSON(JSON.parse(inline) as unknown);
  }
  const file = strInput(args, "request_file", true) as string;
  return requestFromJSON(readJSONFile(root, file));
}

function policyDoc(root: string, args: Record<string, unknown>) {
  const inline = args["policy"];
  if (typeof inline === "string") {
    return policyFromJSON(JSON.parse(inline) as unknown);
  }
  const file = args["policy_file"];
  if (typeof file === "string") {
    return policyFromJSON(readJSONFile(root, file));
  }
  return defaultPolicy();
}

function textResult(value: unknown): { content: string } {
  return { content: JSON.stringify(value, null, 2) };
}

export function compileTool(workdir: () => string): ToolInfo {
  return {
    name: "context_compiler_compile",
    description:
      "Deterministically compile explicit context candidates under a policy and budget. " +
      "Reads request/candidates/policy from worktree files (or inline JSON strings). " +
      "Returns success/failure, bundle, result, trace, hash, tokens, and optional rendered text. " +
      "Pure local computation: no model, no network. Installing this tool never rewrites context by itself.",
    input: {
      type: "object",
      properties: {
        request_file: {
          type: "string",
          description: "Worktree-relative request JSON path",
        },
        candidates_file: {
          type: "string",
          description: "Worktree-relative candidates JSON path",
        },
        policy_file: {
          type: "string",
          description: "Worktree-relative policy JSON path (optional)",
        },
        request: {
          type: "string",
          description: "Inline request JSON (alternative to request_file)",
        },
        candidates: {
          type: "string",
          description:
            "Inline candidates JSON (alternative to candidates_file)",
        },
        policy: {
          type: "string",
          description: "Inline policy JSON (alternative to policy_file)",
        },
        include_rendered: {
          type: "boolean",
          description: "Include generic rendered bundle text",
        },
      },
      additionalProperties: false,
    },
    async execute(input) {
      const root = workdir();
      const args = asRecord(input);
      const request = requestDoc(root, args);
      const candidates = candidateList(root, args);
      const policy = policyDoc(root, args);
      const output = compileContext(request, candidates, policy);
      const problems = [...validateResult(output.result, request, candidates)];
      if (output.result.success && output.bundle) {
        problems.push(
          ...validateBundle(output.bundle, request, candidates, policy),
        );
      }
      if (problems.length > 0) {
        return textResult({ ok: false, problems });
      }
      const includeRendered = args["include_rendered"] === true;
      return textResult({
        ok: true,
        success: output.result.success,
        bundle: output.bundle ? bundleToJSON(output.bundle) : null,
        result: resultToJSON(output.result),
        bundle_hash: output.result.bundleHash,
        bundle_tokens: output.result.bundleTokens,
        rendered_text:
          output.bundle && includeRendered
            ? renderBundleText(output.bundle)
            : null,
      });
    },
  };
}

export function validateTool(workdir: () => string): ToolInfo {
  return {
    name: "context_compiler_validate",
    description:
      "Validate an existing bundle/result envelope against request/candidates/policy. " +
      "Returns explicit validation problems; empty means legal. Pure local computation.",
    input: {
      type: "object",
      properties: {
        request_file: {
          type: "string",
          description: "Worktree-relative request JSON path",
        },
        candidates_file: {
          type: "string",
          description: "Worktree-relative candidates JSON path",
        },
        policy_file: {
          type: "string",
          description: "Worktree-relative policy JSON path (optional)",
        },
        compilation_file: {
          type: "string",
          description: "Worktree-relative {bundle, result} JSON path",
        },
        request: {
          type: "string",
          description: "Inline request JSON (alternative to request_file)",
        },
        candidates: {
          type: "string",
          description:
            "Inline candidates JSON (alternative to candidates_file)",
        },
        policy: {
          type: "string",
          description: "Inline policy JSON (alternative to policy_file)",
        },
        compilation: {
          type: "string",
          description:
            "Inline {bundle, result} JSON (alternative to compilation_file)",
        },
      },
      additionalProperties: false,
    },
    async execute(input) {
      const root = workdir();
      const args = asRecord(input);
      const request = requestDoc(root, args);
      const candidates = candidateList(root, args);
      const policy = policyDoc(root, args);
      const inline = args["compilation"];
      const doc =
        typeof inline === "string"
          ? (JSON.parse(inline) as { bundle: unknown; result: unknown })
          : (readJSONFile(
              root,
              strInput(args, "compilation_file", true) as string,
            ) as {
              bundle: unknown;
              result: unknown;
            });
      const result = resultFromJSON(doc.result);
      const problems = [...validateResult(result, request, candidates)];
      if (doc.bundle === null || doc.bundle === undefined) {
        if (result.success) problems.push("success without bundle");
      } else {
        const bundle = bundleFromJSON(doc.bundle);
        problems.push(...validateBundle(bundle, request, candidates, policy));
      }
      return textResult({ ok: problems.length === 0, problems });
    },
  };
}

export function inspectTool(): ToolInfo {
  return {
    name: "context_compiler_inspect",
    description:
      "Inspect a DecisionTrace (inline JSON or worktree file), optionally filtered to one " +
      "candidate ID. Returns concise deterministic decision information. No model, no network.",
    input: {
      type: "object",
      properties: {
        trace: { type: "string", description: "Inline DecisionTrace JSON" },
        trace_file: {
          type: "string",
          description: "Worktree-relative trace JSON path",
        },
        candidate_id: {
          type: "string",
          description: "Filter to one candidate ID (optional)",
        },
        workdir: {
          type: "string",
          description: "Worktree root for trace_file resolution",
        },
      },
      additionalProperties: false,
    },
    async execute(input) {
      const args = asRecord(input);
      const inline = args["trace"];
      const root =
        typeof args["workdir"] === "string" ? args["workdir"] : process.cwd();
      const doc =
        typeof inline === "string"
          ? (JSON.parse(inline) as unknown)
          : readJSONFile(root, strInput(args, "trace_file", true) as string);
      const trace = traceFromJSON(doc);
      const only = args["candidate_id"];
      const entries =
        typeof only === "string"
          ? trace.entries.filter((e) => e.candidateId === only)
          : [...trace.entries];
      return textResult({
        ok: true,
        request_id: trace.requestId,
        policy_version: trace.policyVersion,
        entries: entries.map((e) => ({
          candidate_id: e.candidateId,
          decision: e.decision,
          reason_code: e.reasonCode,
          reason_detail: e.reasonDetail,
          priority_band: e.priorityBand,
          marginal_cost: e.marginalCost,
          position: e.position,
        })),
      });
    },
  };
}
