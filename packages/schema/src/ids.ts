import { z } from "zod";

const ID_BODY = "[0-9a-z]{10}";

export const EntityIdSchema = z.string().regex(new RegExp(`^e_${ID_BODY}$`));
export const AssetIdSchema = z.string().regex(new RegExp(`^a_${ID_BODY}$`));
export const BehaviorIdSchema = z.string().regex(new RegExp(`^b_${ID_BODY}$`));
export const ProjectIdSchema = z.string().regex(new RegExp(`^p_${ID_BODY}$`));

export type EntityId = z.infer<typeof EntityIdSchema>;
export type AssetId = z.infer<typeof AssetIdSchema>;
export type BehaviorId = z.infer<typeof BehaviorIdSchema>;
export type ProjectId = z.infer<typeof ProjectIdSchema>;
