import type { CommandDefinition, CommandRegistry, QueryRegistry } from "@tessera/core";
import { COMMAND_CATALOG } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { createLogger, Emitter, ok } from "@tessera/std";
import { expect, test } from "vitest";
import { createToolRegistry } from "./registry.js";
import type { RunPolicy, ToolContext } from "./types.js";

function policy(confirmDestructive: boolean): RunPolicy {
  return {
    enabledTiers: [0, 1, 2],
    maxSteps: 24,
    maxToolCallsPerStep: 16,
    maxInputTokens: 400_000,
    timeoutMs: 600_000,
    verify: "spatial",
    maxRepairRounds: 2,
    confirmDestructive,
    temperature: 0.2,
  };
}

function emptyQueries(): QueryRegistry {
  return {
    get: () => undefined,
    has: () => false,
    list: () => [],
    register: () => undefined,
  };
}

function memoryCommands(definitions: readonly CommandDefinition[]): CommandRegistry {
  const map = new Map(definitions.map((definition) => [definition.name, definition]));
  return {
    get: (name) => map.get(name),
    has: (name) => map.has(name),
    list: () => [...map.values()],
    register: (definition) => {
      map.set(definition.name, definition);
    },
  };
}

function toolContext(
  txRun: (name: string, input: unknown) => Result<unknown, TesseraError>,
  runPolicy: RunPolicy,
): ToolContext {
  return {
    runId: "r_test000001",
    stepIndex: 0,
    author: { kind: "agent", id: "test", runId: "r_test000001" },
    tx: { id: "t_test000001", run: txRun },
    queries: emptyQueries(),
    jobs: {
      enqueue: () => ({
        id: "j_abcdefghij",
        result: () => Promise.resolve(ok(undefined)),
      }),
      get: () => undefined,
      list: () => [],
      cancel: () => undefined,
      events: new Emitter(),
    },
    blobs: { has: () => false },
    policy: runPolicy,
    signal: new AbortController().signal,
    logger: createLogger([]),
  };
}

test("INV-AGT-06 destructive blocked without confirmDestructive", async () => {
  const command = COMMAND_CATALOG.find((entry) => entry.name === "asset.delete");
  expect(command).toBeDefined();
  if (command === undefined) {
    return;
  }
  let txRuns = 0;
  const registry = createToolRegistry();
  registry.deriveFromRegistries(
    memoryCommands([{ ...command, handle: () => ok({}) }]),
    emptyQueries(),
  );
  const tool = registry.get("asset.delete");
  expect(tool?.destructive).toBe(true);
  expect(tool).toBeDefined();
  if (tool === undefined) {
    return;
  }
  const blocked = await tool.execute(
    { target: "a_abcdefghij" },
    toolContext(() => {
      txRuns += 1;
      return ok({});
    }, policy(false)),
  );
  expect(blocked.ok).toBe(false);
  if (blocked.ok) {
    return;
  }
  expect(blocked.error.code).toBe("PERMISSION_DENIED");
  expect(blocked.error.details).toEqual({
    suggestion: "Ask the user with ask_user, then retry after confirmation.",
  });
  expect(txRuns).toBe(0);

  const allowed = await tool.execute(
    { target: "a_abcdefghij", force: true },
    toolContext(() => {
      txRuns += 1;
      return ok({});
    }, policy(true)),
  );
  expect(allowed.ok).toBe(true);
  expect(txRuns).toBe(1);
});
