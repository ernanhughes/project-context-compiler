/**
 * OpenCode V2 plugin: explicit compiler tools, side-effect-light.
 *
 * Installing this plugin registers three namespaced tools and
 * nothing else: no context hooks, no capture, no injection, no
 * model calls. Transport/observation stays in
 * project-context-opencode. Each tool delegates to the canonical
 * `compileContext()` in `src/core`.
 */
import { Plugin } from "@opencode/plugin";
export declare const PLUGIN_ID = "project-context.compiler";
declare const _default: Plugin.Plugin;
export default _default;
//# sourceMappingURL=plugin.d.ts.map