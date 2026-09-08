import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { validateDocument } from "@tessera/schema";
import { runExport } from "./export.js";

const PROJECT_FILE = "project.tessera.json";
const USAGE = "usage: tessera validate <path>\n       tessera export gltf <path> --out <dir>\n";

/**
 * Process-free CLI result for `tessera` (T-0009, T-0121).
 *
 * @public
 */
export interface CliResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Runs the CLI against `argv` after the binary name (Q-0024).
 *
 * @example
 * ```ts
 * const result = await runCli(["validate", "project.tessera.json"]);
 * ```
 *
 * @public
 */
export async function runCli(argv: readonly string[]): Promise<CliResult> {
  if (argv[0] === "export") {
    return runExport(argv.slice(1));
  }
  if (argv[0] !== "validate") {
    return { exitCode: 1, stdout: "", stderr: USAGE };
  }
  const target = argv[1];
  if (target === undefined || target === "") {
    return { exitCode: 1, stdout: "", stderr: USAGE };
  }
  return validatePath(target);
}

function validatePath(inputPath: string): CliResult {
  const resolved = resolveSnapshotPath(inputPath);
  if (!resolved.ok) {
    return resolved.error;
  }
  const read = readUtf8(resolved.path);
  if (!read.ok) {
    return read.error;
  }
  const parsed = parseJson(read.text);
  if (!parsed.ok) {
    return parsed.error;
  }
  const report = validateDocument(parsed.value);
  const stdout = `${JSON.stringify(report, null, 2)}\n`;
  if (!report.ok) {
    return { exitCode: 2, stdout, stderr: "" };
  }
  return { exitCode: 0, stdout, stderr: "" };
}

function resolveSnapshotPath(
  inputPath: string,
): { ok: true; path: string } | { ok: false; error: CliResult } {
  try {
    const stats = statSync(inputPath);
    if (stats.isDirectory()) {
      return { ok: true, path: join(inputPath, PROJECT_FILE) };
    }
    return { ok: true, path: inputPath };
  } catch (caught) {
    return { ok: false, error: ioError(caught) };
  }
}

function readUtf8(filePath: string): { ok: true; text: string } | { ok: false; error: CliResult } {
  try {
    return { ok: true, text: readFileSync(filePath, "utf8") };
  } catch (caught) {
    return { ok: false, error: ioError(caught) };
  }
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false; error: CliResult } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (caught) {
    return { ok: false, error: ioError(caught) };
  }
}

function ioError(caught: unknown): CliResult {
  const message = caught instanceof Error ? caught.message : "I/O failed";
  return { exitCode: 1, stdout: "", stderr: `${message}\n` };
}
