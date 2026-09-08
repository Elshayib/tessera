import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { emitJsonSchemaText } from "../packages/schema/src/json-schema.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "packages/schema/src/generated/catalog.json");
writeFileSync(out, emitJsonSchemaText(), "utf8");
