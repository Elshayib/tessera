import type {
  CommandDefinition,
  CommandRegistry,
  QueryDefinition,
  QueryRegistry,
} from "@tessera/core";
import { createCommandBus, createDocument, createQueryHost } from "@tessera/core";
import { COMMAND_CATALOG, QUERY_CATALOG } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { createLogger, Emitter, err, ok, tesseraError } from "@tessera/std";
import { expect, test } from "vitest";
import { z } from "zod";
import { createToolRegistry } from "./registry.js";
import type { RunPolicy, ToolContext } from "./types.js";

function policy(overrides: Partial<RunPolicy> = {}): RunPolicy {
  return {
    enabledTiers: [0, 1, 2],
    maxSteps: 24,
    maxToolCallsPerStep: 16,
    maxInputTokens: 400_000,
    timeoutMs: 600_000,
    verify: "spatial",
    maxRepairRounds: 2,
    confirmDestructive: false,
    temperature: 0.2,
    ...overrides,
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

function memoryQueries(
  definitions: readonly QueryDefinition[],
  query: (name: string, input: unknown) => Result<unknown, TesseraError>,
): QueryRegistry {
  const map = new Map(definitions.map((definition) => [definition.name, definition]));
  const registry: QueryRegistry = {
    get: (name) => map.get(name),
    has: (name) => map.has(name),
    list: () => [...map.values()],
    register: (definition) => {
      map.set(definition.name, definition);
    },
  };
  Object.defineProperty(registry, "query", { value: query, enumerable: true });
  return registry;
}

function toolContext(
  txRun: (name: string, input: unknown) => Result<unknown, TesseraError>,
  queries: QueryRegistry,
  runPolicy: RunPolicy = policy(),
): ToolContext {
  return {
    runId: "r_test000001",
    stepIndex: 0,
    author: { kind: "agent", id: "test", runId: "r_test000001" },
    tx: { id: "t_test000001", run: txRun },
    queries,
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

test("INV-AGT-03 tool input uses command Zod schema", () => {
  const command = COMMAND_CATALOG.find((entry) => entry.name === "entity.create");
  expect(command).toBeDefined();
  if (command === undefined) {
    return;
  }
  const registry = createToolRegistry();
  registry.deriveFromRegistries(
    memoryCommands([
      {
        ...command,
        handle: () => ok({ id: "e_abcdefghij" }),
      },
    ]),
    memoryQueries([], () => ok({})),
  );
  const tool = registry.get("entity.create");
  expect(tool?.input).toBe(command.input);
  expect(tool?.output).toBe(command.output);
});

test("INV-CMD-10 derived names match registries", () => {
  const { doc } = createDocument();
  const bus = createCommandBus(doc);
  const host = createQueryHost(doc, { history: () => [] });
  const registry = createToolRegistry();
  registry.deriveFromRegistries(bus.registry, host.registry);
  const names = new Set(registry.list().map((tool) => tool.name));
  for (const command of bus.registry.list()) {
    if (command.tier >= 3) {
      expect(names.has(command.name)).toBe(false);
      continue;
    }
    expect(names.has(command.name)).toBe(true);
  }
  for (const query of host.registry.list()) {
    expect(names.has(query.name)).toBe(true);
  }
  expect(names.has("history.undoLast")).toBe(false);
  const catalogNames = new Set([...COMMAND_CATALOG, ...QUERY_CATALOG].map((entry) => entry.name));
  for (const name of names) {
    if (name.startsWith("plan.") || name.startsWith("tools.") || name === "ask_user") {
      continue;
    }
    expect(catalogNames.has(name)).toBe(true);
  }
});

test("INV-AGT-05 query tools do not open a transaction", async () => {
  const describe = QUERY_CATALOG.find((entry) => entry.name === "scene.describe");
  expect(describe).toBeDefined();
  if (describe === undefined) {
    return;
  }
  let txRuns = 0;
  let queryRuns = 0;
  const queries = memoryQueries(
    [
      {
        ...describe,
        handle: () => ok({ text: "outline", truncated: false, entityCount: 0 }),
      },
    ],
    (name, input) => {
      queryRuns += 1;
      expect(name).toBe("scene.describe");
      expect(input).toEqual({ detail: "outline" });
      return ok({ text: "outline", truncated: false, entityCount: 0 });
    },
  );
  const registry = createToolRegistry();
  registry.deriveFromRegistries(memoryCommands([]), queries);
  const tool = registry.get("scene.describe");
  expect(tool?.tier).toBe(0);
  expect(tool).toBeDefined();
  if (tool === undefined) {
    return;
  }
  const result = await tool.execute(
    { detail: "outline" },
    toolContext((name) => {
      txRuns += 1;
      return err(tesseraError("INVARIANT_VIOLATION", `unexpected tx ${name}`));
    }, queries),
  );
  expect(result.ok).toBe(true);
  expect(txRuns).toBe(0);
  expect(queryRuns).toBe(1);
});

test("tiers 0-2 only; tier 3 commands omitted", () => {
  const { doc } = createDocument();
  const bus = createCommandBus(doc);
  const host = createQueryHost(doc, { history: () => [] });
  const skipped = z.object({});
  bus.registry.register({
    name: "asset.search",
    description: "Search an asset library.",
    input: skipped,
    output: skipped,
    tier: 3,
    tags: ["job"],
    handle: () => err(tesseraError("UNSUPPORTED", "omit")),
  });
  const registry = createToolRegistry();
  registry.deriveFromRegistries(bus.registry, host.registry);
  expect(registry.get("asset.import")).toBeUndefined();
  expect(registry.get("asset.search")).toBeUndefined();
  expect(registry.get("jobs.await")).toBeUndefined();
  expect(registry.get("script.run")).toBeUndefined();
  expect(registry.get("procedural.define")).toBeUndefined();
  expect(registry.get("behavior.attach")).toBeUndefined();
  expect(registry.get("asset.create")?.tier).toBe(1);
  expect(registry.get("entity.get")?.tier).toBe(0);
});

test("command tools execute through tx.run", async () => {
  const command = COMMAND_CATALOG.find((entry) => entry.name === "entity.rename");
  expect(command).toBeDefined();
  if (command === undefined) {
    return;
  }
  let ran: { name: string; input: unknown } | undefined;
  const queries = memoryQueries([], () => ok({}));
  const registry = createToolRegistry();
  registry.deriveFromRegistries(
    memoryCommands([{ ...command, handle: () => ok({ name: "oak" }) }]),
    queries,
  );
  const tool = registry.get("entity.rename");
  expect(tool).toBeDefined();
  if (tool === undefined) {
    return;
  }
  const result = await tool.execute(
    { target: "e_abcdefghij", name: "oak" },
    toolContext((name, input) => {
      ran = { name, input };
      return ok({ name: "oak" });
    }, queries),
  );
  expect(result.ok).toBe(true);
  expect(ran).toEqual({
    name: "entity.rename",
    input: { target: "e_abcdefghij", name: "oak" },
  });
});
