import { canonicalize, emptyDocument, entityCreateCommand } from "@tessera/schema";
import { err, isErr, isOk, tesseraError } from "@tessera/std";
import { expect, test } from "vitest";
import { createCommandBus } from "./command-bus.js";
import { createDocument } from "./create-document.js";
import { TransactionAbort } from "./transaction.js";

const author = { kind: "user" as const, id: "tester" };

test("INV-CMD-01 invalid input is a no-op", () => {
  const { doc, reader } = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(doc);
  const before = canonicalize(reader.snapshot());
  const result = bus.execute("entity.create", { name: "" }, { author });
  expect(isErr(result) && result.error.code === "INVALID_INPUT").toBe(true);
  expect(canonicalize(reader.snapshot())).toBe(before);
});

test("INV-CMD-02 handler Err aborts transaction", () => {
  const { doc, reader } = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(doc);
  bus.registry.register({
    name: "test.abortAfterWrite",
    description: "Write then fail",
    input: entityCreateCommand.input,
    output: entityCreateCommand.output,
    tier: 1,
    tags: ["mutating"],
    handle(ctx) {
      const created = ctx.run("entity.create", { name: "ghost" });
      if (!created.ok) {
        return created;
      }
      return err(tesseraError("CONFLICT", "forced abort"));
    },
  });
  const before = canonicalize(reader.snapshot());
  const result = bus.execute("test.abortAfterWrite", {}, { author });
  expect(isErr(result) && result.error.code === "CONFLICT").toBe(true);
  expect(canonicalize(reader.snapshot())).toBe(before);
});

test("INV-CMD-05 nested execute from handler is CONFLICT", () => {
  const { doc } = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(doc);
  bus.registry.register({
    name: "test.nestedExecute",
    description: "Illegal nested execute",
    input: entityCreateCommand.input,
    output: entityCreateCommand.output,
    tier: 1,
    tags: ["mutating"],
    handle() {
      return bus.execute("entity.create", { name: "nested" }, { author });
    },
  });
  const result = bus.execute("test.nestedExecute", {}, { author });
  expect(isErr(result) && result.error.code === "CONFLICT").toBe(true);
  expect(isErr(result) && result.error.details?.invariant === "INV-CMD-05").toBe(true);
});

test("unknown command is NOT_FOUND", () => {
  const { doc } = createDocument();
  const bus = createCommandBus(doc);
  const result = bus.execute("no.such", {}, { author });
  expect(isErr(result) && result.error.code === "NOT_FOUND").toBe(true);
});

test("execute is synchronous and commits entity.create", () => {
  const { doc, reader } = createDocument();
  const bus = createCommandBus(doc);
  const result = bus.execute("entity.create", { name: "oak" }, { author });
  expect(isOk(result)).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.value.output).toEqual({ id: expect.stringMatching(/^e_[0-9a-z]{10}$/) });
  expect([...reader.entities()]).toHaveLength(1);
});

test("author runId origin, transaction Err, duplicate register, and TransactionAbort", () => {
  const { doc } = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(doc);
  const agent = { kind: "agent" as const, id: "runner", runId: "r_abcdefghij" };
  const created = bus.execute(
    "entity.create",
    { name: "oak" },
    { author: agent, runId: "r_abcdefghij" },
  );
  expect(isOk(created)).toBe(true);
  if (!created.ok) {
    return;
  }
  expect(created.value.transaction.runId).toBe("r_abcdefghij");

  const rejected = bus.transaction({ author }, () => err(tesseraError("CONFLICT", "nope")));
  expect(isErr(rejected) && rejected.error.code === "CONFLICT").toBe(true);

  bus.registry.register({
    name: "test.abortClass",
    description: "throws TransactionAbort",
    input: entityCreateCommand.input,
    output: entityCreateCommand.output,
    tier: 1,
    tags: ["mutating"],
    handle() {
      throw new TransactionAbort(tesseraError("CONFLICT", "abort class"));
    },
  });
  expect(isErr(bus.execute("test.abortClass", {}, { author }))).toBe(true);

  expect(() =>
    bus.registry.register({
      name: "entity.create",
      description: "dup",
      input: entityCreateCommand.input,
      output: entityCreateCommand.output,
      tier: 1,
      tags: ["mutating"],
      handle() {
        return err(tesseraError("UNSUPPORTED", "dup"));
      },
    }),
  ).toThrow(/duplicate command/);
});
