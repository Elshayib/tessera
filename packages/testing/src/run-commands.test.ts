import { err, isErr, isOk, ok, tesseraError } from "@tessera/std";
import { expect, test } from "vitest";
import { runCommands } from "./run-commands.js";

test("runCommands executes in order and stops on Err", () => {
  const names: string[] = [];
  const bus = {
    execute(name: string) {
      names.push(name);
      if (name === "entity.delete") {
        return err(tesseraError("NOT_FOUND", "missing"));
      }
      return ok({ output: { id: "e_aaaaaaaaaa" }, transaction: { id: "t_aaaaaaaaaa" } });
    },
  };
  const author = { kind: "user" as const, id: "tester" };
  const success = runCommands(
    bus,
    [
      { name: "entity.create", input: { name: "oak" } },
      { name: "entity.rename", input: { name: "pine" } },
    ],
    { author },
  );
  expect(isOk(success)).toBe(true);
  if (!success.ok) {
    return;
  }
  expect(success.value).toEqual([{ id: "e_aaaaaaaaaa" }, { id: "e_aaaaaaaaaa" }]);
  expect(names).toEqual(["entity.create", "entity.rename"]);
  const failed = runCommands(
    bus,
    [
      { name: "entity.create", input: {} },
      { name: "entity.delete", input: {} },
      { name: "entity.rename", input: {} },
    ],
    { author },
  );
  expect(isErr(failed) && failed.error.code === "NOT_FOUND").toBe(true);
  expect(names).toEqual(["entity.create", "entity.rename", "entity.create", "entity.delete"]);
  const malformed = runCommands({ execute: () => 1 }, [{ name: "x", input: {} }], { author });
  expect(isErr(malformed) && malformed.error.code === "INVARIANT_VIOLATION").toBe(true);
  const badErr = runCommands(
    { execute: () => ({ ok: false, error: { code: "NOPE", message: "x" } }) },
    [{ name: "x", input: {} }],
    { author },
  );
  expect(isErr(badErr) && badErr.error.code === "INVARIANT_VIOLATION").toBe(true);
  const withDetails = runCommands(
    {
      execute: () => err(tesseraError("NOT_FOUND", "gone", { id: "e_x" })),
    },
    [{ name: "x", input: {} }],
    { author },
  );
  expect(isErr(withDetails) && withDetails.error.code === "NOT_FOUND").toBe(true);
  const rawOk = runCommands({ execute: () => ok(7) }, [{ name: "x", input: {} }], { author });
  expect(isOk(rawOk) && rawOk.value[0] === 7).toBe(true);
});
