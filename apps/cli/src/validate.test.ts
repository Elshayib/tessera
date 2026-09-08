import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { runCli } from "./validate.js";

const campfire = fileURLToPath(
  new URL("../../../packages/schema/fixtures/documents/0.1.0/campfire.json", import.meta.url),
);
const invalid = fileURLToPath(new URL("../fixtures/invalid.json", import.meta.url));
const projectDir = fileURLToPath(new URL("../fixtures/valid-project", import.meta.url));
const missing = fileURLToPath(new URL("../fixtures/missing.json", import.meta.url));
const notJson = fileURLToPath(new URL("../fixtures/not-json.txt", import.meta.url));
const emptyDir = fileURLToPath(new URL("../fixtures/empty-dir", import.meta.url));

test("validate good fixture", async () => {
  const result = await runCli(["validate", campfire]);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('"ok": true');
});

test("validate bad fixture exit 2", async () => {
  const result = await runCli(["validate", invalid]);
  expect(result.exitCode).toBe(2);
  expect(result.stdout).toContain("INV-DOC-02");
});

test("validate project folder", async () => {
  const result = await runCli(["validate", projectDir]);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('"ok": true');
});

test("missing file exit 1", async () => {
  const result = await runCli(["validate", missing]);
  expect(result.exitCode).toBe(1);
  expect(result.stderr.length).toBeGreaterThan(0);
});

test("invalid json exit 1", async () => {
  const result = await runCli(["validate", notJson]);
  expect(result.exitCode).toBe(1);
  expect(result.stderr.length).toBeGreaterThan(0);
});

test("folder without project file exit 1", async () => {
  const result = await runCli(["validate", emptyDir]);
  expect(result.exitCode).toBe(1);
});

test("usage without path exit 1", async () => {
  const result = await runCli(["validate"]);
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("usage: tessera validate");
});

test("unknown command exit 1", async () => {
  const result = await runCli(["inspect", campfire]);
  expect(result.exitCode).toBe(1);
});

test("empty path exit 1", async () => {
  const result = await runCli(["validate", ""]);
  expect(result.exitCode).toBe(1);
});
