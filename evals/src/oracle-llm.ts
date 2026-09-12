import type {
  LlmClient,
  LlmMessage,
  LlmRequest,
  LlmResponse,
  LlmStreamEvent,
  ModelDescriptor,
  ProviderDescriptor,
  ToolCallPart,
} from "@tessera/llm";
import { assistantText, assistantToolCalls } from "@tessera/llm";
import type { Result, TesseraError } from "@tessera/std";
import { ok } from "@tessera/std";

const PROVIDER: ProviderDescriptor = {
  id: "oracle",
  displayName: "Oracle",
  auth: "none",
  baseUrl: { configurable: false },
  browserDirect: "yes",
  listsModels: false,
  docsUrl: "https://example.invalid",
};

const STAMP = "2026-01-01T00:00:00.000Z";
const WARM = "#ff8800";

/**
 * Scripted eval client that emits catalog tools for core-20 prompts.
 *
 * @public
 */
export class OracleLlmClient implements LlmClient {
  readonly provider = PROVIDER;
  private readonly caseId: string;

  constructor(caseId: string) {
    this.caseId = caseId;
  }

  async listModels(): Promise<Result<readonly ModelDescriptor[], TesseraError>> {
    return ok([]);
  }

  async testConnection(): Promise<Result<{ latencyMs: number }, TesseraError>> {
    return ok({ latencyMs: 0 });
  }

  async generate(request: LlmRequest): Promise<Result<LlmResponse, TesseraError>> {
    const calls = toolsFor(this.caseId, request.messages);
    const text = doneText(this.caseId);
    if (this.caseId === "core.describe") {
      const parts = [...calls, { kind: "text" as const, text }];
      return ok({
        message: { role: "assistant", parts },
        usage: { inputTokens: 1, outputTokens: 1 },
        finishReason: calls.length > 0 ? "tool_calls" : "stop",
        modelId: request.model.modelId,
      });
    }
    if (calls.length === 0) {
      return ok(textResponse(request, text));
    }
    return ok({
      message: assistantToolCalls(calls),
      usage: { inputTokens: 1, outputTokens: 1 },
      finishReason: "tool_calls",
      modelId: request.model.modelId,
    });
  }

  async *stream(request: LlmRequest): AsyncIterable<LlmStreamEvent> {
    const generated = await this.generate(request);
    if (!generated.ok) {
      return;
    }
    yield { type: "done", response: generated.value };
  }
}

function textResponse(request: LlmRequest, text: string): LlmResponse {
  return {
    message: assistantText(text),
    usage: { inputTokens: 1, outputTokens: 1 },
    finishReason: "stop",
    modelId: request.model.modelId,
  };
}

function doneText(caseId: string): string {
  if (caseId === "core.describe") {
    return "The scene has 1 entity named hero.";
  }
  return "Done. The scene has the requested entities.";
}

function toolsFor(caseId: string, messages: readonly LlmMessage[]): readonly ToolCallPart[] {
  const turn = messages.filter((message) => message.role === "assistant").length;
  const ids = outputIds(messages);
  if (caseId === "core.describe") {
    return describeScene(turn);
  }
  if (caseId === "core.red-cube") {
    return redCube(turn, ids);
  }
  if (caseId === "core.table-chairs") {
    return tableChairs(turn, ids);
  }
  if (caseId === "core.campfire") {
    return campfire(turn, ids);
  }
  if (caseId === "core.scatter-trees") {
    return scatterTrees(turn, ids);
  }
  if (caseId === "core.sunset") {
    return sunset(turn);
  }
  if (caseId === "core.wood-floor") {
    return woodFloor(turn);
  }
  if (caseId === "core.frame-camera") {
    return frameCamera(turn, ids);
  }
  if (caseId === "core.stack-boxes") {
    return stackBoxes(turn, ids);
  }
  if (caseId === "core.grid-crates") {
    return gridCrates(turn);
  }
  if (caseId === "core.lamp-sofa") {
    return lampSofa(turn);
  }
  if (caseId === "core.delete-trees") {
    return deleteTrees(turn);
  }
  if (caseId === "core.rename-chairs") {
    return renameChairs(turn);
  }
  if (caseId === "core.add-colliders") {
    return addColliders(turn);
  }
  if (caseId === "core.simple-room") {
    return simpleRoom(turn, ids);
  }
  if (caseId === "core.shiny-metal") {
    return shinyMetal(turn);
  }
  if (caseId === "core.streetlights") {
    return streetlights(turn);
  }
  if (caseId === "core.hdri") {
    return hdri(turn, ids);
  }
  if (caseId === "core.generate-barrel") {
    return barrel(turn, ids);
  }
  if (caseId === "core.fix-scene") {
    return fixScene(turn);
  }
  return [];
}

function redCube(turn: number, ids: readonly string[]): readonly ToolCallPart[] {
  if (turn === 0) {
    return [
      call("c1", "asset.create", { asset: boxGeometry("cube_mesh", [1, 1, 1]) }),
      call("c2", "material.create", {
        name: "red_mat",
        material: { baseColor: "#ff0000", roughness: 0.6, metallic: 0 },
      }),
    ];
  }
  const geom = ids[0];
  const mat = ids[1];
  if (turn === 1 && geom !== undefined && mat !== undefined) {
    return [
      call("c3", "entity.create", {
        name: "red_cube",
        components: meshAt(geom, [mat], [0, 0.5, 0]),
      }),
    ];
  }
  return [];
}

function tableChairs(turn: number, ids: readonly string[]): readonly ToolCallPart[] {
  if (turn === 0) {
    return [call("c1", "asset.create", { asset: boxGeometry("furniture", [1, 1, 1]) })];
  }
  const geom = ids[0];
  if (turn === 1 && geom !== undefined) {
    return [
      call("c2", "entity.create", {
        name: "table",
        components: meshAt(geom, [], [0, 0.5, 0], [1.2, 0.8, 1.2]),
      }),
      call("c3", "entity.create", {
        name: "chair_n",
        components: meshAt(geom, [], [0, 0.5, 1.2], [0.5, 1, 0.5]),
      }),
      call("c4", "entity.create", {
        name: "chair_s",
        components: meshAt(geom, [], [0, 0.5, -1.2], [0.5, 1, 0.5]),
      }),
      call("c5", "entity.create", {
        name: "chair_e",
        components: meshAt(geom, [], [1.2, 0.5, 0], [0.5, 1, 0.5]),
      }),
      call("c6", "entity.create", {
        name: "chair_w",
        components: meshAt(geom, [], [-1.2, 0.5, 0], [0.5, 1, 0.5]),
      }),
    ];
  }
  return [];
}

function campfire(turn: number, ids: readonly string[]): readonly ToolCallPart[] {
  if (turn === 0) {
    return [call("c1", "asset.create", { asset: boxGeometry("log_mesh", [0.4, 0.3, 1.2]) })];
  }
  const geom = ids[0];
  if (turn === 1 && geom !== undefined) {
    return [
      call("c2", "entity.create", {
        name: "log_a",
        components: meshAt(geom, [], [0.6, 0.15, 0]),
      }),
      call("c3", "entity.create", {
        name: "log_b",
        components: meshAt(geom, [], [-0.3, 0.15, 0.5]),
      }),
      call("c4", "entity.create", {
        name: "log_c",
        components: meshAt(geom, [], [-0.3, 0.15, -0.5]),
      }),
      call("c5", "entity.create", {
        name: "campfire_light",
        components: {
          transform: { position: [0, 1.2, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          light: { type: "point", color: WARM, intensity: 80 },
        },
      }),
    ];
  }
  return [];
}

function scatterTrees(turn: number, ids: readonly string[]): readonly ToolCallPart[] {
  if (turn === 0) {
    return [call("c1", "asset.create", { asset: boxGeometry("tree_mesh", [0.4, 2, 0.4]) })];
  }
  const geom = ids[0];
  if (turn === 1 && geom !== undefined) {
    const calls: ToolCallPart[] = [];
    for (let i = 0; i < 12; i += 1) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      calls.push(
        call(`t${String(i)}`, "entity.create", {
          name: `tree_${String(i + 1)}`,
          components: meshAt(geom, [], [col * 3, 1, row * 3], [0.4, 2, 0.4]),
        }),
      );
    }
    return calls;
  }
  return [];
}

function sunset(turn: number): readonly ToolCallPart[] {
  if (turn !== 0) {
    return [];
  }
  return [
    call("c1", "entity.create", {
      name: "sun",
      components: {
        transform: { position: [0, 10, 0], rotation: [12, 40, 0], scale: [1, 1, 1] },
        light: { type: "directional", color: WARM, intensity: 3 },
      },
    }),
    call("c2", "environment.set", { patch: { exposure: 1 } }),
  ];
}

function woodFloor(turn: number): readonly ToolCallPart[] {
  if (turn !== 0) {
    return [];
  }
  return [
    call("c1", "material.set", {
      target: "a_0000000001",
      patch: { baseColor: "#4a3728", roughness: 0.7 },
    }),
  ];
}

function frameCamera(turn: number, ids: readonly string[]): readonly ToolCallPart[] {
  if (turn === 0) {
    return [
      call("c1", "entity.create", {
        name: "Shot",
        parent: { path: "prop" },
        components: {
          transform: { position: [4, 3, 4], rotation: [-20, 45, 0], scale: [1, 1, 1] },
          camera: { type: "perspective", fov: 50, near: 0.1, far: 1000, orthoSize: 5 },
        },
      }),
    ];
  }
  const cameraId = ids[0];
  if (turn === 1 && cameraId !== undefined) {
    return [call("c2", "camera.setMain", { target: cameraId })];
  }
  return [];
}

function stackBoxes(turn: number, ids: readonly string[]): readonly ToolCallPart[] {
  if (turn === 0) {
    return [call("c1", "asset.create", { asset: boxGeometry("box_mesh", [1, 1, 1]) })];
  }
  const geom = ids[0];
  if (turn === 1 && geom !== undefined) {
    return [
      call("c2", "entity.create", {
        name: "box_large",
        components: meshAt(geom, [], [0, 0.5, 0], [1, 1, 1]),
      }),
      call("c3", "entity.create", {
        name: "box_mid",
        components: meshAt(geom, [], [0, 1.4, 0], [0.7, 0.7, 0.7]),
      }),
      call("c4", "entity.create", {
        name: "box_small",
        components: meshAt(geom, [], [0, 2.05, 0], [0.4, 0.4, 0.4]),
      }),
    ];
  }
  return [];
}

function gridCrates(turn: number): readonly ToolCallPart[] {
  if (turn !== 0) {
    return [];
  }
  const targets = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ path: `crate_${String(i)}` }));
  return [
    call("c1", "layout.arrangeGrid", {
      targets,
      columns: 3,
      spacing: [1.5, 1.5],
      origin: [0, 0.5, 0],
      plane: "xz",
    }),
  ];
}

function lampSofa(turn: number): readonly ToolCallPart[] {
  if (turn !== 0) {
    return [];
  }
  return [
    call("c1", "transform.set", {
      target: { path: "lamp" },
      position: [1.2, 0.5, 0],
    }),
  ];
}

function deleteTrees(turn: number): readonly ToolCallPart[] {
  if (turn !== 0) {
    return [];
  }
  return [
    call("c1", "entity.delete", { target: { path: "tree_1" } }),
    call("c2", "entity.delete", { target: { path: "tree_2" } }),
  ];
}

function renameChairs(turn: number): readonly ToolCallPart[] {
  if (turn !== 0) {
    return [];
  }
  return [
    call("c1", "entity.rename", { target: { path: "seat_a" }, name: "chair_1" }),
    call("c2", "entity.rename", { target: { path: "seat_b" }, name: "chair_2" }),
    call("c3", "entity.rename", { target: { path: "seat_c" }, name: "chair_3" }),
    call("c4", "entity.rename", { target: { path: "seat_d" }, name: "chair_4" }),
  ];
}

function addColliders(turn: number): readonly ToolCallPart[] {
  if (turn !== 0) {
    return [];
  }
  return [
    call("c1", "component.add", {
      target: { path: "prop_a" },
      type: "collider",
      value: { shape: "box", fit: "auto" },
    }),
    call("c2", "component.add", {
      target: { path: "prop_b" },
      type: "collider",
      value: { shape: "box", fit: "auto" },
    }),
  ];
}

function simpleRoom(turn: number, ids: readonly string[]): readonly ToolCallPart[] {
  if (turn === 0) {
    return [call("c1", "asset.create", { asset: boxGeometry("wall_mesh", [1, 3, 0.2]) })];
  }
  const geom = ids[0];
  if (turn === 1 && geom !== undefined) {
    return [
      call("c2", "entity.create", {
        name: "wall_n",
        components: meshAt(geom, [], [0, 1.5, 2], [6, 3, 0.2]),
      }),
      call("c3", "entity.create", {
        name: "wall_s",
        components: meshAt(geom, [], [0, 1.5, -2], [6, 3, 0.2]),
      }),
      call("c4", "entity.create", {
        name: "wall_e",
        components: meshAt(geom, [], [3, 1.5, 0], [0.2, 3, 4]),
      }),
      call("c5", "entity.create", {
        name: "wall_w",
        components: meshAt(geom, [], [-3, 1.5, 0], [0.2, 3, 4]),
      }),
    ];
  }
  return [];
}

function shinyMetal(turn: number): readonly ToolCallPart[] {
  if (turn !== 0) {
    return [];
  }
  return [
    call("c1", "material.set", {
      target: "a_0000000001",
      patch: { metallic: 0.9, roughness: 0.2 },
    }),
  ];
}

function streetlights(turn: number): readonly ToolCallPart[] {
  if (turn !== 0) {
    return [];
  }
  return [
    call("c1", "entity.create", {
      name: "streetlight_b",
      parent: { path: "streetlight" },
      components: meshAt("a_0000000000", [], [10, 2, 0], [0.2, 4, 0.2]),
    }),
  ];
}

function describeScene(turn: number): readonly ToolCallPart[] {
  if (turn !== 0) {
    return [];
  }
  return [call("c1", "scene.stats", {})];
}

function hdri(turn: number, ids: readonly string[]): readonly ToolCallPart[] {
  if (turn === 0) {
    return [
      call("c1", "asset.create", {
        asset: {
          name: "forest_hdri",
          license: "CC0-1.0",
          provenance: { source: "polyhaven", importedAt: STAMP },
          kind: "environment",
          source: { kind: "color", color: "#1a3322" },
          rotation: 0,
          intensity: 1,
        },
      }),
    ];
  }
  const asset = ids[0];
  if (turn === 1 && asset !== undefined) {
    return [
      call("c2", "environment.set", {
        patch: { sky: { kind: "environment", asset } },
      }),
    ];
  }
  return [];
}

function barrel(turn: number, ids: readonly string[]): readonly ToolCallPart[] {
  if (turn === 0) {
    return [call("c1", "asset.create", { asset: generatedBox("barrel_mesh", [0.6, 0.9, 0.6]) })];
  }
  const geom = ids[0];
  if (turn === 1 && geom !== undefined) {
    return [
      call("c2", "entity.create", {
        name: "barrel",
        components: meshAt(geom, [], [1, 0.45, 0]),
      }),
    ];
  }
  return [];
}

function fixScene(turn: number): readonly ToolCallPart[] {
  if (turn !== 0) {
    return [];
  }
  return [
    call("c1", "layout.snapToGround", {
      targets: [{ path: "float_a" }, { path: "float_b" }],
      ground: "y0",
    }),
    call("c2", "layout.resolveOverlaps", {
      targets: [{ path: "float_a" }, { path: "float_b" }],
    }),
  ];
}

function generatedBox(name: string, size: readonly [number, number, number]) {
  const [x, y, z] = size;
  return {
    name,
    license: "CC0-1.0",
    provenance: {
      source: "generated",
      importedAt: STAMP,
      generator: { provider: "fake", promptHash: "sha256-barrel", jobId: "j_oraclegen" },
    },
    kind: "geometry" as const,
    source: { kind: "primitive" as const, primitive: { type: "box" as const, size } },
    bounds: { min: [-x / 2, -y / 2, -z / 2], max: [x / 2, y / 2, z / 2] },
    stats: { triangles: 12, vertices: 8, primitiveGroups: 1 },
  };
}

function boxGeometry(name: string, size: readonly [number, number, number]) {
  const [x, y, z] = size;
  return {
    name,
    license: "unknown",
    provenance: { source: "tessera", importedAt: STAMP },
    kind: "geometry" as const,
    source: { kind: "primitive" as const, primitive: { type: "box" as const, size } },
    bounds: { min: [-x / 2, -y / 2, -z / 2], max: [x / 2, y / 2, z / 2] },
    stats: { triangles: 12, vertices: 8, primitiveGroups: 1 },
  };
}

function meshAt(
  geometry: string,
  materials: readonly string[],
  position: readonly [number, number, number],
  scale: readonly [number, number, number] = [1, 1, 1],
) {
  return {
    transform: { position, rotation: [0, 0, 0], scale },
    meshRenderer: { geometry, materials, castShadow: true, receiveShadow: true, visible: true },
  };
}

function call(callId: string, name: string, input: unknown): ToolCallPart {
  return { kind: "toolCall", callId, name, input };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function outputIds(messages: readonly LlmMessage[]): readonly string[] {
  const ids: string[] = [];
  for (const message of messages) {
    if (message.role !== "tool") {
      continue;
    }
    for (const result of message.results) {
      if (result.isError) {
        continue;
      }
      const value = result.result;
      const idKey = "id";
      const id = isRecord(value) ? value[idKey] : undefined;
      if (typeof id === "string") {
        ids.push(id);
      }
    }
  }
  return ids;
}
