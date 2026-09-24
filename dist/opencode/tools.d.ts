/**
 * Explicit compiler tools for OpenCode. Each tool is a thin adapter:
 * parse file inputs, call the canonical `compileContext()` (or the
 * validators / trace inspection) in `src/core`, return JSON text.
 * No compilation logic lives here.
 */
import type { Info as ToolInfo } from "@opencode/plugin/promise/tool";
export declare const TOOL_NAMESPACE = "context_compiler";
export declare const TOOL_NAMES: readonly ["context_compiler_compile", "context_compiler_validate", "context_compiler_inspect"];
export declare function compileTool(workdir: () => string): ToolInfo;
export declare function validateTool(workdir: () => string): ToolInfo;
export declare function inspectTool(): ToolInfo;
//# sourceMappingURL=tools.d.ts.map