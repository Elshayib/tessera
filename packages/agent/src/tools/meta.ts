import { err, ok, tesseraError } from "@tessera/std";
import { z } from "zod";
import { TOOL_GROUPS } from "./derive.js";
import { attachSuggestion } from "./suggestions.js";
import type { ToolContext, ToolDefinition, ToolGroup, ToolRegistry } from "./types.js";

const PlanItemSchema = z.object({
  text: z.string().min(1),
  done: z.boolean(),
});

const PlanSetInputSchema = z.object({
  items: z.array(PlanItemSchema),
});

const EmptyInputSchema = z.object({});

const EnableInputSchema = z.object({
  group: z.enum([
    "read",
    "entities",
    "components",
    "materials",
    "assets",
    "layout",
    "camera",
    "environment",
    "generate",
    "code",
    "meta",
  ]),
});

const AskUserInputSchema = z.object({
  question: z.string().min(1),
});

function isToolGroup(value: string): value is ToolGroup {
  for (const group of TOOL_GROUPS) {
    if (group === value) {
      return true;
    }
  }
  return false;
}

/**
 * Meta-tools from `06` §5.
 *
 * @public
 */
export function createMetaTools(registry: ToolRegistry): readonly ToolDefinition[] {
  const planSet: ToolDefinition = {
    name: "plan.set",
    description: "Publish a checklist of remaining work for this run.",
    tier: 0,
    group: "meta",
    input: PlanSetInputSchema,
    output: PlanSetInputSchema,
    destructive: false,
    execute: async (input) => {
      const parsed = PlanSetInputSchema.safeParse(input);
      if (!parsed.success) {
        return attachSuggestion(
          "meta",
          err(tesseraError("INVALID_INPUT", "plan.set needs items.")),
        );
      }
      return ok(parsed.data);
    },
  };
  const catalog: ToolDefinition = {
    name: "tools.catalog",
    description: "List available tool names, groups, and tiers for this run.",
    tier: 0,
    group: "meta",
    input: EmptyInputSchema,
    output: z.object({
      tools: z.array(
        z.object({
          name: z.string(),
          group: EnableInputSchema.shape.group,
          tier: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
          description: z.string(),
        }),
      ),
    }),
    destructive: false,
    execute: async () => {
      return ok({
        tools: registry.list().map((tool) => ({
          name: tool.name,
          group: tool.group,
          tier: tool.tier,
          description: tool.description,
        })),
      });
    },
  };
  const enable: ToolDefinition = {
    name: "tools.enable",
    description: "Enable a tool group for the rest of this run.",
    tier: 0,
    group: "meta",
    input: EnableInputSchema,
    output: EnableInputSchema,
    destructive: false,
    execute: async (input, ctx: ToolContext) => {
      void ctx;
      const parsed = EnableInputSchema.safeParse(input);
      if (!parsed.success) {
        return attachSuggestion(
          "meta",
          err(tesseraError("INVALID_INPUT", "tools.enable needs a group.")),
        );
      }
      if (!isToolGroup(parsed.data.group)) {
        return attachSuggestion("meta", err(tesseraError("INVALID_INPUT", "unknown tool group")));
      }
      const enabled = registry.enableGroup(parsed.data.group);
      if (!enabled.ok) {
        return enabled;
      }
      return ok(parsed.data);
    },
  };
  const askUser: ToolDefinition = {
    name: "ask_user",
    description: "Ask the user a question and wait for the reply before continuing.",
    tier: 0,
    group: "meta",
    input: AskUserInputSchema,
    output: AskUserInputSchema,
    destructive: false,
    execute: async (input) => {
      const parsed = AskUserInputSchema.safeParse(input);
      if (!parsed.success) {
        return attachSuggestion(
          "meta",
          err(tesseraError("INVALID_INPUT", "ask_user needs a question.")),
        );
      }
      return ok(parsed.data);
    },
  };
  return [planSet, catalog, enable, askUser];
}
