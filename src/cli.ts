/**
 * context-compiler CLI. File IO lives here, never in src/core.
 * Usage:
 *   node src/cli.ts version
 *   node src/cli.ts conformance
 *   node src/cli.ts inspect <fixture> [--budget tight|medium|roomy]
 *   node src/cli.ts compile --request R --candidates C --policy P [--output O]
 *   node src/cli.ts validate --compilation M --request R --candidates C --policy P
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  bundleToJSON,
  resultToJSON,
  type CompilationResult,
} from "./core/index.ts";
import {
  bundleFromJSON,
  candidateFromJSON,
  policyFromJSON,
  requestFromJSON,
  resultFromJSON,
} from "./core/index.ts";
import { compileContext } from "./core/index.ts";
import { renderBundleText } from "./core/index.ts";
import { validateBundle, validateResult } from "./core/index.ts";
import {
  formatReport,
  loadManifest,
  loadPolicy,
  runCase,
  runConformance,
} from "./conformance/index.ts";

const VERSION = "0.2.1";

function readJSON(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8")) as unknown;
}

function cmdVersion(): number {
  console.log(`context-compiler ${VERSION}`);
  return 0;
}

function cmdConformance(): number {
  const report = runConformance();
  process.stdout.write(formatReport(report));
  return report.passed ? 0 : 1;
}

function cmdInspect(fixture: string, budget: string): number {
  try {
    const manifest = loadManifest();
    const policy = loadPolicy();
    const { outcome } = runCase(fixture, budget, manifest, policy);
    console.log(
      `${outcome.fixture}/${outcome.budget}: success=${outcome.success}`,
    );
    if (!outcome.success) {
      console.log(`reason: ${outcome.reason}`);
    } else {
      console.log(`admitted: ${JSON.stringify(outcome.admittedIds)}`);
      console.log(
        `tokens: ${outcome.bundleTokens} hash: ${outcome.bundleHash}`,
      );
    }
    if (outcome.validationProblems.length > 0) {
      console.log(`validation: ${outcome.validationProblems.join("; ")}`);
      return 1;
    }
    return 0;
  } catch (error) {
    console.error(`unknown fixture: ${fixture} (${String(error)})`);
    return 2;
  }
}

function cmdCompile(args: Record<string, string>): number {
  const request = requestFromJSON(readJSON(args["request"] as string));
  const candidates = (
    readJSON(args["candidates"] as string) as {
      candidates: Record<string, unknown>[];
    }
  ).candidates.map(candidateFromJSON);
  const policy = policyFromJSON(readJSON(args["policy"] as string));
  const output = compileContext(request, candidates, policy);
  const problems = [...validateResult(output.result, request, candidates)];
  if (output.result.success && output.bundle) {
    problems.push(
      ...validateBundle(output.bundle, request, candidates, policy),
    );
  }
  if (problems.length > 0) {
    console.error(`INVALID: ${problems.join("; ")}`);
    return 1;
  }
  const doc = {
    bundle: output.bundle ? bundleToJSON(output.bundle) : null,
    result: resultToJSON(output.result),
  };
  const text = JSON.stringify(doc, null, 2);
  if (args["output"]) {
    writeFileSync(args["output"] as string, text + "\n", "utf-8");
  } else {
    console.log(text);
  }
  if (output.bundle) {
    process.stderr.write(renderBundleText(output.bundle));
  } else {
    const failure = (output.result as CompilationResult).failure;
    process.stderr.write(
      `explicit failure: ${failure ? failure.reason : "unknown"}\n`,
    );
  }
  return 0;
}

function cmdValidate(args: Record<string, string>): number {
  const doc = readJSON(args["compilation"] as string) as {
    bundle: unknown;
    result: unknown;
  };
  const result = resultFromJSON(doc.result);
  const request = requestFromJSON(readJSON(args["request"] as string));
  const candidates = (
    readJSON(args["candidates"] as string) as {
      candidates: Record<string, unknown>[];
    }
  ).candidates.map(candidateFromJSON);
  const policy = policyFromJSON(readJSON(args["policy"] as string));
  const problems = [...validateResult(result, request, candidates)];
  if (doc.bundle === null || doc.bundle === undefined) {
    if (result.success) problems.push("success without bundle");
  } else {
    const bundle = bundleFromJSON(doc.bundle);
    problems.push(...validateBundle(bundle, request, candidates, policy));
  }
  if (problems.length > 0) {
    console.error(`INVALID: ${problems.join("; ")}`);
    return 1;
  }
  console.log("valid");
  return 0;
}

function parseArgs(argv: string[]): {
  command: string;
  flags: Record<string, string>;
  rest: string[];
} {
  const [command = "", ...tail] = argv;
  const flags: Record<string, string> = {};
  const rest: string[] = [];
  for (let i = 0; i < tail.length; i++) {
    const token = tail[i] as string;
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = tail[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = "true";
      }
    } else {
      rest.push(token);
    }
  }
  return { command, flags, rest };
}

export function main(argv: string[] = process.argv.slice(2)): number {
  const { command, flags, rest } = parseArgs(argv);
  switch (command) {
    case "version":
      return cmdVersion();
    case "conformance":
      return cmdConformance();
    case "inspect":
      return cmdInspect(rest[0] ?? "", flags["budget"] ?? "medium");
    case "compile":
      return cmdCompile(flags);
    case "validate":
      return cmdValidate(flags);
    default:
      console.error(
        "usage: context-compiler <version|conformance|inspect|compile|validate>",
      );
      return 2;
  }
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  process.exit(main());
}
