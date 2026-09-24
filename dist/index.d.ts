/**
 * Package entrypoint. The default export is the OpenCode V2 plugin
 * (id `project-context.compiler`); named exports expose the
 * deterministic compiler library. Both are served from this one
 * Git package: `opencode plugin add
 * github:ernanhughes/project-context-compiler`.
 */
export * from "./core/index.ts";
export { default } from "./opencode/plugin.ts";
export { PLUGIN_ID } from "./opencode/plugin.ts";
//# sourceMappingURL=index.d.ts.map