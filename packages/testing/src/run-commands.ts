import type { ErrorCode, Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";

/**
 * Duck-typed command bus so `@tessera/testing` does not import `@tessera/core` (Q-0019).
 *
 * @public
 */
export interface CommandRunner {
  execute(
    name: string,
    input: unknown,
    options: {
      readonly author: {
        readonly kind: "user" | "agent" | "remote" | "system";
        readonly id: string;
        readonly runId?: string;
      };
      readonly label?: string;
      readonly runId?: string;
    },
  ): unknown;
}

export interface CommandRun {
  readonly name: string;
  readonly input: unknown;
}

/**
 * Executes commands in order, stopping at the first `Err`.
 *
 * @example
 * ```ts
 * const result = runCommands(bus, [{ name: "entity.create", input: { name: "oak" } }], {
 *   author: { kind: "user", id: "tester" },
 * });
 * ```
 *
 * @public
 */
export function runCommands(
  bus: CommandRunner,
  commands: readonly CommandRun[],
  options: {
    readonly author: {
      readonly kind: "user" | "agent" | "remote" | "system";
      readonly id: string;
      readonly runId?: string;
    };
    readonly label?: string;
    readonly runId?: string;
  },
): Result<readonly unknown[], TesseraError> {
  const outputs: unknown[] = [];
  for (const command of commands) {
    const executed = bus.execute(command.name, command.input, options);
    const parsed = parseExecuteResult(executed);
    if (!parsed.ok) {
      return parsed;
    }
    outputs.push(parsed.value);
  }
  return ok(outputs);
}

function parseExecuteResult(value: unknown): Result<unknown, TesseraError> {
  if (!isRecord(value) || typeof value["ok"] !== "boolean") {
    return err(tesseraError("INVARIANT_VIOLATION", "execute did not return a Result"));
  }
  if (value["ok"] === false) {
    const parsedError = parseTesseraError(value["error"]);
    if (parsedError === undefined) {
      return err(tesseraError("INVARIANT_VIOLATION", "execute Err is malformed"));
    }
    return err(parsedError);
  }
  const wrapped = value["value"];
  if (isRecord(wrapped) && "output" in wrapped) {
    return ok(wrapped["output"]);
  }
  return ok(wrapped);
}

function parseTesseraError(value: unknown): TesseraError | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const code = value["code"];
  const message = value["message"];
  if (typeof code !== "string" || typeof message !== "string" || !isErrorCode(code)) {
    return undefined;
  }
  const details = value["details"];
  if (isRecord(details)) {
    return tesseraError(code, message, details);
  }
  return tesseraError(code, message);
}

function isErrorCode(code: string): code is ErrorCode {
  switch (code) {
    case "INVALID_INPUT":
    case "NOT_FOUND":
    case "CONFLICT":
    case "INVARIANT_VIOLATION":
    case "PERMISSION_DENIED":
    case "UNSUPPORTED":
    case "CANCELLED":
    case "TIMEOUT":
    case "PROVIDER_ERROR":
    case "IO_ERROR":
    case "BUDGET_EXCEEDED":
    case "RATE_LIMITED":
      return true;
    default:
      return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
