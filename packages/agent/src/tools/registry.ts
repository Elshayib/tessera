import type { CommandRegistry, QueryRegistry } from "@tessera/core";
import { invariant, ok } from "@tessera/std";
import { deriveCommandTool, deriveQueryTool } from "./derive.js";
import { createMetaTools } from "./meta.js";
import type { ToolDefinition, ToolGroup, ToolRegistry } from "./types.js";

/**
 * In-memory {@link ToolRegistry} with meta-tools pre-registered.
 *
 * @example
 * ```ts
 * const tools = createToolRegistry();
 * tools.deriveFromRegistries(bus.registry, queries.registry);
 * ```
 *
 * @public
 */
export function createToolRegistry(): ToolRegistry {
  const tools = new Map<string, ToolDefinition>();
  const extra = new Set<ToolGroup>();
  const registry: ToolRegistry = {
    register(tool) {
      invariant(!tools.has(tool.name), `duplicate tool ${tool.name}`);
      tools.set(tool.name, tool);
    },
    list(filter) {
      const all = [...tools.values()];
      if (filter === undefined) {
        return all;
      }
      const tiers = filter.tiers === undefined ? undefined : new Set(filter.tiers);
      const groups = filter.groups === undefined ? undefined : new Set(filter.groups);
      return all.filter((tool) => {
        if (tiers !== undefined && !tiers.has(tool.tier)) {
          return false;
        }
        if (groups !== undefined && !groups.has(tool.group)) {
          return false;
        }
        return true;
      });
    },
    get(name) {
      return tools.get(name);
    },
    deriveFromRegistries(commands: CommandRegistry, queries: QueryRegistry) {
      for (const command of commands.list()) {
        const tool = deriveCommandTool(command);
        if (tool !== undefined && !tools.has(tool.name)) {
          tools.set(tool.name, tool);
        }
      }
      for (const query of queries.list()) {
        const tool = deriveQueryTool(query);
        if (tool !== undefined && !tools.has(tool.name)) {
          tools.set(tool.name, tool);
        }
      }
    },
    enableGroup(group) {
      extra.add(group);
      return ok(undefined);
    },
    enabledGroups() {
      return extra;
    },
  };
  for (const tool of createMetaTools(registry)) {
    registry.register(tool);
  }
  return registry;
}
