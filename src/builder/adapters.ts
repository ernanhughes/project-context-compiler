/**
 * Source adapters: heterogeneous available information in,
 * normalized SourceObservations out.
 *
 * Each adapter exposes one function over its own typed inputs.
 * No adapter reads the filesystem, network, clock, or a model.
 * Malformed inputs become rejections, never guessed candidates.
 */

import { createHash } from "node:crypto";
import type {
  AvailableInformation,
  BuildRejection,
  FileInput,
  InstructionInput,
  MemoryInput,
  RetrievalInput,
  SourceObservation,
  StateInput,
  ToolInput,
} from "./types.ts";

export interface Discovery {
  readonly observations: readonly SourceObservation[];
  readonly rejections: readonly BuildRejection[];
  readonly sourcesConsulted: readonly string[];
  readonly availableItems: number;
}

function shortHash(text: string): string {
  return createHash("sha256").update(text, "utf-8").digest("hex").slice(0, 12);
}

function observationId(
  sourceType: string,
  sourceIdentity: string,
  version: string,
): string {
  return `obs-${shortHash(`${sourceType}:${sourceIdentity}:${version}`)}`;
}

function relevanceOf(score: unknown): {
  relevance: number;
  provenance: "declared" | "neutral";
} {
  if (typeof score === "number" && Number.isFinite(score)) {
    const clamped = Math.min(1, Math.max(0, score));
    return { relevance: clamped, provenance: "declared" };
  }
  return { relevance: 0.5, provenance: "neutral" };
}

function fileObservations(
  files: readonly FileInput[] | undefined,
  observations: SourceObservation[],
  rejections: BuildRejection[],
): void {
  for (const file of files ?? []) {
    if (!file.path || !file.revision || typeof file.content !== "string") {
      rejections.push({
        observationId: `obs-malformed-file-${rejections.length}`,
        code: "MALFORMED_OBSERVATION",
        reason: `file observation missing path/revision/content`,
      });
      continue;
    }
    if (file.content.length === 0) {
      rejections.push({
        observationId: observationId("file", file.path, file.revision),
        code: "MALFORMED_OBSERVATION",
        reason: `file ${file.path}@${file.revision}: empty payload carries no information`,
      });
      continue;
    }
    observations.push({
      observationId: observationId("file", file.path, file.revision),
      sourceType: "file",
      sourceIdentity: `file:${file.path}@${file.revision}`,
      locator: file.path,
      observedVersion: file.revision,
      payload: file.content,
      provenance: `file ${file.path}@${file.revision}`,
      declaredScope: file.declaredScope ?? null,
      authorityClass: file.authorityClass ?? "repository-source",
      retention: file.retention ?? null,
      declaredRequirement: file.requirement ?? null,
      superseded: file.superseded ?? false,
      validatorStatus: file.validatorStatus ?? null,
      validatorId: file.validatorId ?? null,
      observedAt: file.observedAt ?? null,
      conflictKey: `file:${file.path}`,
      coverageKeys: [file.path],
      relevance: 0.5,
      relevanceProvenance: "neutral",
    });
  }
}

function instructionObservations(
  instructions: readonly InstructionInput[] | undefined,
  observations: SourceObservation[],
  rejections: BuildRejection[],
): void {
  for (const instruction of instructions ?? []) {
    if (!instruction.instructionId || typeof instruction.text !== "string") {
      rejections.push({
        observationId: `obs-malformed-instruction-${rejections.length}`,
        code: "MALFORMED_OBSERVATION",
        reason: `instruction observation missing id/text`,
      });
      continue;
    }
    if (instruction.text.length === 0) {
      rejections.push({
        observationId: observationId(
          "instruction",
          instruction.instructionId,
          "v1",
        ),
        code: "MALFORMED_OBSERVATION",
        reason: `instruction ${instruction.instructionId}: empty payload`,
      });
      continue;
    }
    observations.push({
      observationId: observationId(
        "instruction",
        instruction.instructionId,
        "v1",
      ),
      sourceType: "instruction",
      sourceIdentity: `instruction:${instruction.instructionId}`,
      locator: instruction.instructionId,
      observedVersion: "v1",
      payload: instruction.text,
      provenance: `instruction ${instruction.instructionId}`,
      declaredScope: instruction.scope ?? null,
      authorityClass: instruction.authorityClass ?? "project-rule",
      retention: instruction.retention ?? "pin",
      declaredRequirement: instruction.requirement ?? null,
      superseded: instruction.superseded ?? false,
      validatorStatus: instruction.validatorStatus ?? null,
      validatorId: instruction.validatorId ?? null,
      observedAt: instruction.observedAt ?? null,
      conflictKey: `instruction:${instruction.instructionId}`,
      coverageKeys: [instruction.instructionId],
      relevance: 0.5,
      relevanceProvenance: "neutral",
    });
  }
}

function toolObservations(
  tools: readonly ToolInput[] | undefined,
  observations: SourceObservation[],
  rejections: BuildRejection[],
): void {
  for (const tool of tools ?? []) {
    if (!tool.callId || !tool.toolName) {
      rejections.push({
        observationId: `obs-malformed-tool-${rejections.length}`,
        code: "MALFORMED_OBSERVATION",
        reason: `tool observation missing callId/toolName`,
      });
      continue;
    }
    if (typeof tool.definition === "string" && tool.definition.length > 0) {
      observations.push({
        observationId: observationId(
          "tool-definition",
          `${tool.toolName}:${tool.callId}`,
          "v1",
        ),
        sourceType: "tool",
        sourceIdentity: `tool-definition:${tool.toolName}:${tool.callId}`,
        locator: `${tool.toolName}:${tool.callId}`,
        observedVersion: "v1",
        payload: tool.definition,
        provenance: `tool definition ${tool.toolName} for call ${tool.callId}`,
        declaredScope: tool.declaredScope ?? null,
        authorityClass: "tool-definition",
        retention: null,
        declaredRequirement: null,
        superseded: false,
        validatorStatus: null,
        validatorId: null,
        observedAt: tool.observedAt ?? null,
        conflictKey: null,
        coverageKeys: [tool.toolName, tool.callId],
        relevance: 0.5,
        relevanceProvenance: "neutral",
      });
    }
    if (typeof tool.output !== "string" || tool.output.length === 0) {
      rejections.push({
        observationId: observationId(
          "tool-output",
          `${tool.toolName}:${tool.callId}`,
          "v1",
        ),
        code: "MALFORMED_OBSERVATION",
        reason: `tool ${tool.toolName} call ${tool.callId}: empty output`,
      });
      continue;
    }
    const rel = relevanceOf(null);
    observations.push({
      observationId: observationId(
        "tool-output",
        `${tool.toolName}:${tool.callId}`,
        "v1",
      ),
      sourceType: "tool",
      sourceIdentity: `tool-output:${tool.toolName}:${tool.callId}`,
      locator: `${tool.toolName}:${tool.callId}`,
      observedVersion: "v1",
      payload: tool.output,
      provenance: `tool output ${tool.toolName} call ${tool.callId} status ${tool.status}`,
      declaredScope: tool.declaredScope ?? null,
      authorityClass: tool.authorityClass ?? "tool-output",
      retention: null,
      declaredRequirement: null,
      superseded: false,
      validatorStatus: null,
      validatorId: null,
      observedAt: tool.observedAt ?? null,
      conflictKey: null,
      coverageKeys: [tool.toolName, tool.callId],
      relevance: rel.relevance,
      relevanceProvenance: rel.provenance,
    });
  }
}

function stateObservations(
  states: readonly StateInput[] | undefined,
  memories: readonly MemoryInput[] | undefined,
  observations: SourceObservation[],
  rejections: BuildRejection[],
): void {
  for (const state of states ?? []) {
    if (!state.noteId || typeof state.text !== "string") {
      rejections.push({
        observationId: `obs-malformed-state-${rejections.length}`,
        code: "MALFORMED_OBSERVATION",
        reason: `working-state observation missing noteId/text`,
      });
      continue;
    }
    if (state.text.length === 0) {
      rejections.push({
        observationId: observationId("working-state", state.noteId, "v1"),
        code: "MALFORMED_OBSERVATION",
        reason: `working-state ${state.noteId}: empty payload`,
      });
      continue;
    }
    observations.push({
      observationId: observationId("working-state", state.noteId, "v1"),
      sourceType: "working-state",
      sourceIdentity: `working-state:${state.noteId}`,
      locator: state.noteId,
      observedVersion: "v1",
      payload: state.text,
      provenance: `working-state ${state.noteId} status ${state.status}`,
      declaredScope: state.declaredScope ?? null,
      authorityClass: state.authorityClass ?? "working-state",
      retention: null,
      declaredRequirement: null,
      superseded: state.status === "superseded",
      validatorStatus: state.status === "superseded" ? "superseded" : null,
      validatorId:
        state.status === "superseded" ? "working-state-status" : null,
      observedAt: state.observedAt ?? null,
      conflictKey: `note:${state.noteId}`,
      coverageKeys: [state.noteId],
      relevance: 0.5,
      relevanceProvenance: "neutral",
    });
  }
  for (const memory of memories ?? []) {
    if (!memory.memoryId || typeof memory.text !== "string") {
      rejections.push({
        observationId: `obs-malformed-memory-${rejections.length}`,
        code: "MALFORMED_OBSERVATION",
        reason: `memory observation missing memoryId/text`,
      });
      continue;
    }
    if (memory.text.length === 0) {
      rejections.push({
        observationId: observationId("memory", memory.memoryId, "v1"),
        code: "MALFORMED_OBSERVATION",
        reason: `memory ${memory.memoryId}: empty payload`,
      });
      continue;
    }
    const validity = memory.validity ?? "unknown";
    observations.push({
      observationId: observationId("memory", memory.memoryId, "v1"),
      sourceType: "memory",
      sourceIdentity: `memory:${memory.memoryId}`,
      locator: memory.memoryId,
      observedVersion: "v1",
      payload: memory.text,
      provenance: `memory ${memory.memoryId} validity ${validity}`,
      declaredScope: memory.declaredScope ?? null,
      authorityClass: memory.authorityClass ?? "memory",
      retention: null,
      declaredRequirement: null,
      superseded: validity === "superseded" || validity === "stale",
      validatorStatus:
        validity === "current"
          ? "current"
          : validity === "unknown"
            ? null
            : validity,
      validatorId: validity === "unknown" ? null : "memory-validity",
      observedAt: memory.observedAt ?? null,
      conflictKey: `memory:${memory.memoryId}`,
      coverageKeys: [memory.memoryId],
      relevance: 0.5,
      relevanceProvenance: "neutral",
    });
  }
}

function retrievalObservations(
  retrievals: readonly RetrievalInput[] | undefined,
  observations: SourceObservation[],
  rejections: BuildRejection[],
): void {
  for (const retrieval of retrievals ?? []) {
    if (!retrieval.retrievalId || typeof retrieval.text !== "string") {
      rejections.push({
        observationId: `obs-malformed-retrieval-${rejections.length}`,
        code: "MALFORMED_OBSERVATION",
        reason: `retrieval observation missing retrievalId/text`,
      });
      continue;
    }
    if (retrieval.text.length === 0) {
      rejections.push({
        observationId: observationId("retrieval", retrieval.retrievalId, "v1"),
        code: "MALFORMED_OBSERVATION",
        reason: `retrieval ${retrieval.retrievalId}: empty payload`,
      });
      continue;
    }
    const rel = relevanceOf(retrieval.score);
    observations.push({
      observationId: observationId("retrieval", retrieval.retrievalId, "v1"),
      sourceType: "retrieval",
      sourceIdentity: `retrieval:${retrieval.retrievalId}`,
      locator: retrieval.sourceRef,
      observedVersion: "v1",
      payload: retrieval.text,
      provenance: `retrieval ${retrieval.retrievalId} from ${retrieval.sourceRef}`,
      declaredScope: retrieval.declaredScope ?? null,
      authorityClass: retrieval.authorityClass ?? "retrieved-external",
      retention: null,
      declaredRequirement: null,
      superseded: false,
      validatorStatus: null,
      validatorId: null,
      observedAt: retrieval.observedAt ?? null,
      conflictKey: null,
      coverageKeys: [retrieval.retrievalId],
      relevance: rel.relevance,
      relevanceProvenance: rel.provenance,
    });
  }
}

/**
 * Discover observations from heterogeneous available information.
 * Deterministic: observations are sorted by observationId.
 */
export function discover(available: AvailableInformation): Discovery {
  const observations: SourceObservation[] = [];
  const rejections: BuildRejection[] = [];
  const consulted: string[] = [];
  let availableItems = 0;

  if (available.files !== undefined) {
    consulted.push("file");
    availableItems += available.files.length;
    fileObservations(available.files, observations, rejections);
  }
  if (available.instructions !== undefined) {
    consulted.push("instruction");
    availableItems += available.instructions.length;
    instructionObservations(available.instructions, observations, rejections);
  }
  if (available.tools !== undefined) {
    consulted.push("tool");
    availableItems += available.tools.length;
    toolObservations(available.tools, observations, rejections);
  }
  if (available.states !== undefined || available.memories !== undefined) {
    consulted.push("state");
    availableItems += (available.states ?? []).length;
    availableItems += (available.memories ?? []).length;
    stateObservations(
      available.states,
      available.memories,
      observations,
      rejections,
    );
  }
  if (available.retrievals !== undefined) {
    consulted.push("retrieval");
    availableItems += available.retrievals.length;
    retrievalObservations(available.retrievals, observations, rejections);
  }

  observations.sort((a, b) =>
    a.observationId < b.observationId
      ? -1
      : a.observationId > b.observationId
        ? 1
        : 0,
  );
  return {
    observations,
    rejections,
    sourcesConsulted: consulted,
    availableItems,
  };
}
