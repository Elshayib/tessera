import { fromYDoc } from "@tessera/core";
import { validateDocument } from "@tessera/schema";
import { MemoryProjectStore } from "@tessera/storage";
import { expect, test } from "vitest";
import { bootstrap } from "./bootstrap.js";

test("bootstrap empty document validates", () => {
  const ctx = bootstrap({ storage: new MemoryProjectStore() });
  const report = validateDocument(fromYDoc(ctx.document.ydoc));
  expect(report.ok).toBe(true);
  expect(ctx.flags.polyhaven).toBe(true);
  expect(ctx.agentVerify).toBe("none");
  expect(ctx.engine).toBeUndefined();
  expect(ctx.queries.list().length).toBeGreaterThan(0);
  expect(typeof Reflect.get(ctx.queries, "query")).toBe("function");
});

test("bootstrap includes KeyVault for Settings", () => {
  const ctx = bootstrap({ storage: new MemoryProjectStore() });
  expect("keyVault" in ctx).toBe(true);
  expect(typeof ctx.keyVault.get).toBe("function");
});
