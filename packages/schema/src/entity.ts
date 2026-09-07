import { z } from "zod";
import { ComponentsSchema } from "./components/index.js";
import { EntityIdSchema } from "./ids.js";
import { NameSchema } from "./primitives.js";

export const EntitySchema = z.object({
  id: EntityIdSchema,
  name: NameSchema,
  parent: EntityIdSchema.nullable(),
  order: z.string().min(1),
  components: ComponentsSchema,
  enabled: z.boolean().default(true),
});

export type Entity = z.infer<typeof EntitySchema>;
