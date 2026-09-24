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
import { compileTool, inspectTool, validateTool } from "./tools.ts";

export const PLUGIN_ID = "project-context.compiler";

type ToolEditor = {
  add: (tool: unknown) => void;
};

type PluginHost = {
  tool: {
    transform: (callback: (editor: ToolEditor) => void) => Promise<unknown>;
  };
  location: { directory: string };
};

export default Plugin.define({
  id: PLUGIN_ID,
  async setup(ctx) {
    const host = ctx as unknown as PluginHost;
    const workdir = () => host.location.directory;
    await host.tool.transform((editor) => {
      editor.add(compileTool(workdir));
      editor.add(validateTool(workdir));
      editor.add(inspectTool());
    });
  },
});
