/**
 * OpenCode plugin tests: tool registration, tool behaviour, and the
 * side-effect-light contract. No model calls; the host is faked.
 */

import { deepStrictEqual, equal, ok } from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import plugin, { PLUGIN_ID } from "../../src/opencode/plugin.ts";
import { TOOL_NAMES } from "../../src/opencode/tools.ts";
import { resolveWorktreeFile } from "../../src/opencode/files.ts";

type ToolDef = {
  name: string;
  description: string;
  input: unknown;
  execute: (input: unknown) => Promise<{ content: string }>;
};

function fakeHost() {
  const added: ToolDef[] = [];
  const sessionHooks: string[] = [];
  return {
    added,
    ctx: {
      app: { version: "2.0.16" },
      location: { directory: "C:\\work" },
      tool: {
        transform: async (
          callback: (editor: { add: (tool: ToolDef) => void }) => void,
        ) => {
          callback({ add: (tool) => added.push(tool) });
          return { dispose: async () => {} };
        },
      },
      session: {
        hook: async (name: string) => {
          sessionHooks.push(name);
          return { dispose: async () => {} };
        },
      },
    },
    sessionHooks,
  };
}

test("plugin id is stable", () => {
  equal(PLUGIN_ID, "project-context.compiler");
});

test("setup registers exactly three namespaced tools", async () => {
  const { added, ctx } = fakeHost();
  await (plugin as unknown as { setup: (ctx: unknown) => Promise<void> }).setup(
    ctx,
  );
  deepStrictEqual(
    added.map((t) => t.name),
    [...TOOL_NAMES],
  );
});

test("setup registers no session hooks", async () => {
  const { ctx, sessionHooks } = fakeHost();
  await (plugin as unknown as { setup: (ctx: unknown) => Promise<void> }).setup(
    ctx,
  );
  deepStrictEqual(sessionHooks, []);
});

function fixtureDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "cc-tools-"));
  writeFileSync(
    join(dir, "request.json"),
    JSON.stringify({
      request_id: "r",
      task_id: "t",
      usable_token_budget: 1000,
      created_at: "2026-09-24T00:00:00Z",
      active_scope: "s",
      policy_version: "compiler-policy-v1",
    }),
    "utf-8",
  );
  writeFileSync(
    join(dir, "candidates.json"),
    JSON.stringify({
      candidates: [
        {
          candidate_id: "m1",
          content_identity: "m1",
          representation_id: "full",
          form_rank: 3,
          min_rank: 0,
          source_kind: "ledger",
          source_ref: "r",
          kind: "evidence",
          content: "keep this",
          token_count: 10,
          requirement: "MANDATORY",
          order_role: "evidence",
          scope_eligible: true,
          freshness_eligible: true,
          authority_eligible: true,
        },
      ],
    }),
    "utf-8",
  );
  writeFileSync(
    join(dir, "policy.json"),
    JSON.stringify({
      policy_version: "compiler-policy-v1",
      min_discretionary_relevance: 0.3,
      mandatory_form: "cheapest",
      order_roles: [
        "instruction",
        "task",
        "state",
        "evidence",
        "support",
        "tool",
      ],
      repair: "drop-last-discretionary",
    }),
    "utf-8",
  );
  return dir;
}

async function toolNamed(name: string, dir: string): Promise<ToolDef> {
  const added: ToolDef[] = [];
  const ctx = {
    location: { directory: dir },
    tool: {
      transform: async (
        callback: (editor: { add: (tool: ToolDef) => void }) => void,
      ) => {
        callback({ add: (tool) => added.push(tool) });
        return { dispose: async () => {} };
      },
    },
  };
  await (plugin as unknown as { setup: (ctx: unknown) => Promise<void> }).setup(
    ctx,
  );
  const tool = added.find((t) => t.name === name);
  ok(tool, `tool ${name} registered`);
  return tool as ToolDef;
}

test("compile tool compiles files and returns the bundle", async () => {
  const dir = fixtureDir();
  const tool = await toolNamed("context_compiler_compile", dir);
  const out = JSON.parse(
    (
      await tool.execute({
        request_file: "request.json",
        candidates_file: "candidates.json",
        policy_file: "policy.json",
        include_rendered: true,
      })
    ).content,
  ) as Record<string, unknown>;
  equal(out["ok"], true);
  equal(out["success"], true);
  const bundle = out["bundle"] as { items: Array<{ id: string }> };
  deepStrictEqual(
    bundle.items.map((i) => i.id),
    ["m1"],
  );
  ok((out["rendered_text"] as string).includes("[CONTEXT BUNDLE]"));
});

test("compile tool reports explicit failure, not a guess", async () => {
  const dir = fixtureDir();
  writeFileSync(
    join(dir, "request.json"),
    JSON.stringify({
      request_id: "r",
      task_id: "t",
      usable_token_budget: 1,
      created_at: "2026-09-24T00:00:00Z",
      active_scope: "s",
      policy_version: "compiler-policy-v1",
    }),
    "utf-8",
  );
  const tool = await toolNamed("context_compiler_compile", dir);
  const out = JSON.parse(
    (
      await tool.execute({
        request_file: "request.json",
        candidates_file: "candidates.json",
        policy_file: "policy.json",
      })
    ).content,
  ) as Record<string, unknown>;
  equal(out["ok"], true);
  equal(out["success"], false);
  const result = out["result"] as { failure: { reason: string } };
  equal(result.failure.reason, "INSUFFICIENT_BUDGET");
});

test("validate tool checks an envelope", async () => {
  const dir = fixtureDir();
  const compile = await toolNamed("context_compiler_compile", dir);
  const compiled = JSON.parse(
    (
      await compile.execute({
        request_file: "request.json",
        candidates_file: "candidates.json",
        policy_file: "policy.json",
      })
    ).content,
  ) as { bundle: unknown; result: unknown };
  writeFileSync(
    join(dir, "compilation.json"),
    JSON.stringify(compiled),
    "utf-8",
  );
  const validate = await toolNamed("context_compiler_validate", dir);
  const out = JSON.parse(
    (
      await validate.execute({
        compilation_file: "compilation.json",
        request_file: "request.json",
        candidates_file: "candidates.json",
        policy_file: "policy.json",
      })
    ).content,
  ) as Record<string, unknown>;
  deepStrictEqual(out, { ok: true, problems: [] });
});

test("inspect tool summarizes a trace", async () => {
  const dir = fixtureDir();
  const compile = await toolNamed("context_compiler_compile", dir);
  const compiled = JSON.parse(
    (
      await compile.execute({
        request_file: "request.json",
        candidates_file: "candidates.json",
        policy_file: "policy.json",
      })
    ).content,
  ) as { result: { trace: unknown } };
  const inspect = await toolNamed("context_compiler_inspect", dir);
  const out = JSON.parse(
    (
      await inspect.execute({
        trace: JSON.stringify(compiled.result.trace),
        candidate_id: "m1",
      })
    ).content,
  ) as {
    ok: boolean;
    entries: Array<{ candidate_id: string; decision: string }>;
  };
  equal(out.ok, true);
  deepStrictEqual(
    out.entries.map((e) => e.candidate_id),
    ["m1"],
  );
  equal(out.entries[0]?.decision, "ADMITTED");
});

test("path traversal outside the worktree is rejected", () => {
  let message = "";
  try {
    resolveWorktreeFile("C:\\work", "..\\outside.json");
  } catch (error) {
    message = String(error);
  }
  ok(message.includes("escapes the worktree"));
  equal(
    resolveWorktreeFile("C:\\work", "sub\\file.json"),
    "C:\\work\\sub\\file.json",
  );
});
