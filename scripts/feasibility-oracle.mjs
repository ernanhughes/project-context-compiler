// Finite feasibility oracle: enumerates every subset of a fixture's candidates and tests it against
// the compiler's declared structural constraints, then compares with the compiler's own result.
//
//   node scripts/feasibility-oracle.mjs <fixture-dir> [policy.json]
//
// Legal subset = every member passes the four hard gates; every dependency is present; required groups
// are all-or-none; at most one form per content identity; every content identity that has a MANDATORY or
// REQUIRED candidate (after promotion of explicitly required ids) is present; explicitly required ids are
// present; and the rendered-cost estimate fits the budget. The oracle shares the compiler's cost units and
// its content-exclusivity assumption, so it is an independent search, not an independent specification.
// Analysis harness only: it is not part of the published package.

import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = (p) => pathToFileURL(join(here, "..", "src", p)).href;
const eng = await import(src("core/engine.ts"));
const ld = await import(src("conformance/loader.ts"));
const pol = await import(src("core/policy.ts"));

const dir = resolve(
  process.argv[2] ?? join(here, "..", "conformance", "compiler-v1"),
);
const policyPath =
  process.argv[3] ??
  join(here, "..", "conformance", "compiler-v1", "compiler-policy-v1.json");
const policy = pol.policyFromJSON(
  JSON.parse(readFileSync(policyPath, "utf-8")),
);
const manifestPath = join(dir, "manifest.json");
const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf-8"))
  : null;
const fixtures = ld.loadFixtureSet(dir);

const illegal = (c) =>
  !(
    c.scopeEligible === true &&
    c.freshnessEligible === true &&
    c.authorityEligible === true &&
    c.formRank >= c.minRank
  );

let falseSuccess = 0;
let falseRefusal = 0;
let total = 0;
for (const name of Object.keys(fixtures).sort()) {
  const cands = ld.loadCandidateFile(fixtures[name].candidates);
  const baseReq = ld.loadRequestFile(fixtures[name].request);
  const budgets = manifest?.budgets?.[name] ?? {
    requested: baseReq.usableTokenBudget,
  };
  for (const [label, budget] of Object.entries(budgets)) {
    const req = { ...baseReq, usableTokenBudget: budget };
    const out = eng.compileContext(req, cands, policy);
    const eff = (c) =>
      req.requiredIds.includes(c.candidateId)
        ? c.requirement === "MANDATORY"
          ? "MANDATORY"
          : "REQUIRED"
        : c.requirement;
    const groups = new Map();
    for (const c of cands)
      if (c.groupId && c.groupRequired)
        (
          groups.get(c.groupId) ?? groups.set(c.groupId, []).get(c.groupId)
        ).push(c);
    const obligations = new Set(
      cands
        .filter((c) => ["MANDATORY", "REQUIRED"].includes(eff(c)))
        .map((c) => c.contentIdentity),
    );
    const legal = new Set();
    for (let m = 0; m < 1 << cands.length; m++) {
      const mem = cands.filter((_, i) => m & (1 << i));
      const ids = new Set(mem.map((c) => c.candidateId));
      if (mem.some(illegal)) continue;
      if (mem.some((c) => c.dependsOn.some((d) => !ids.has(d)))) continue;
      let ok = true;
      for (const [, mm] of groups) {
        const p = mm.filter((x) => ids.has(x.candidateId)).length;
        if (p > 0 && p !== mm.length) ok = false;
        if (["MANDATORY", "REQUIRED"].includes(eff(mm[0])) && p !== mm.length)
          ok = false;
      }
      const seen = new Set();
      for (const c of mem) {
        if (seen.has(c.contentIdentity)) ok = false;
        seen.add(c.contentIdentity);
      }
      for (const idn of obligations) if (!seen.has(idn)) ok = false;
      for (const rid of req.requiredIds) if (!ids.has(rid)) ok = false;
      if (!ok) continue;
      const cost =
        mem.reduce((s, c) => s + eng.itemRenderCost(c), 0) +
        Math.max(0, mem.length - 1) * eng.SEPARATOR_TOKENS +
        eng.headerTokens(req);
      if (cost > budget) continue;
      legal.add(
        mem
          .map((c) => c.candidateId)
          .sort()
          .join("|"),
      );
    }
    const success = out.result.success;
    const compiled = success
      ? out.bundle.items
          .map((i) => i.id)
          .sort()
          .join("|")
      : null;
    let verdict = "consistent";
    if (success && !legal.has(compiled)) {
      verdict = "FALSE SUCCESS";
      falseSuccess++;
    }
    if (!success && legal.size > 0) {
      verdict = "FALSE REFUSAL";
      falseRefusal++;
    }
    total++;
    console.log(
      `${name}/${label}\tbudget=${budget}\tcompiler=${success ? "bundle" : out.result.failure.reason}\tlegal_sets=${legal.size}\t${verdict}`,
    );
  }
}
console.log(
  `\ncompilations: ${total}\tfalse successes: ${falseSuccess}\tfalse refusals: ${falseRefusal}`,
);
