import { describe, expect, test } from "vitest";
import { tesseraError } from "./error.js";
import { andThen, err, isErr, isOk, map, ok } from "./result.js";

describe("Result", () => {
  test("ok wraps a value", () => {
    const result = ok(3);
    expect(isOk(result)).toBe(true);
    expect(result).toEqual({ ok: true, value: 3 });
  });

  test("err wraps a TesseraError", () => {
    const error = tesseraError("NOT_FOUND", "missing");
    const result = err(error);
    expect(isErr(result)).toBe(true);
    expect(result).toEqual({ ok: false, error });
  });

  test("map transforms Ok and leaves Err unchanged", () => {
    const mapped = map(ok(2), (n) => n * 2);
    expect(mapped).toEqual(ok(4));

    const error = tesseraError("INVALID_INPUT", "bad");
    expect(map(err(error), (n: number) => n * 2)).toEqual(err(error));
  });

  test("andThen flat-maps Ok and leaves Err unchanged", () => {
    const next = andThen(ok(2), (n) => ok(String(n)));
    expect(next).toEqual(ok("2"));

    const error = tesseraError("CONFLICT", "taken");
    expect(andThen(err(error), (n: number) => ok(n))).toEqual(err(error));
  });
});
