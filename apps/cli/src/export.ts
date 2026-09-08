import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { createGltfExporter, GltfExportOptionsSchema } from "@tessera/exporters";
import { DocumentSchema, validateDocument } from "@tessera/schema";
import { MemoryBlobStore } from "@tessera/storage";

const PROJECT_FILE = "project.tessera.json";
const USAGE = "usage: tessera export gltf <path> --out <dir>\n";

/**
 * Process-free result of {@link runExport}.
 *
 * @public
 */
export interface ExportCliResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * `tessera export gltf <path> --out <dir>` (`09`, INV-ARCH-06).
 *
 * @example
 * ```ts
 * await runExport(["gltf", "campfire.json", "--out", "./out"]);
 * ```
 *
 * @public
 */
export async function runExport(argv: readonly string[]): Promise<ExportCliResult> {
  const parsed = parseExportArgs(argv);
  if (!parsed.ok) {
    return parsed.error;
  }
  const loaded = loadSnapshot(parsed.path);
  if (!loaded.ok) {
    return loaded.error;
  }
  const report = validateDocument(loaded.value);
  if (!report.ok) {
    return { exitCode: 2, stdout: `${JSON.stringify(report, null, 2)}\n`, stderr: "" };
  }
  const document = DocumentSchema.safeParse(loaded.value);
  if (!document.success) {
    return { exitCode: 2, stdout: "", stderr: "invalid document\n" };
  }
  const options = GltfExportOptionsSchema.safeParse({
    outputName: outputName(parsed.path),
  });
  if (!options.success) {
    return { exitCode: 2, stdout: "", stderr: "invalid export options\n" };
  }
  const exporter = createGltfExporter();
  const exported = await exporter.export({
    document: document.data,
    blobs: new MemoryBlobStore(),
    options: options.data,
  });
  if (!exported.ok) {
    return { exitCode: 2, stdout: "", stderr: `${exported.error.message}\n` };
  }
  return writeFiles(parsed.out, exported.value.files);
}

function parseExportArgs(
  argv: readonly string[],
): { ok: true; path: string; out: string } | { ok: false; error: ExportCliResult } {
  if (argv[0] !== "gltf") {
    return { ok: false, error: { exitCode: 1, stdout: "", stderr: USAGE } };
  }
  const rest = argv.slice(1);
  const outAt = rest.indexOf("--out");
  const out = outAt >= 0 ? rest[outAt + 1] : undefined;
  if (outAt < 0 || out === undefined || out.length === 0) {
    return { ok: false, error: { exitCode: 1, stdout: "", stderr: USAGE } };
  }
  const pathParts: string[] = [];
  for (let i = 0; i < rest.length; i += 1) {
    if (i === outAt || i === outAt + 1) {
      continue;
    }
    const part = rest[i];
    if (part !== undefined) {
      pathParts.push(part);
    }
  }
  const inputPath = pathParts[0];
  if (inputPath === undefined || inputPath.length === 0 || pathParts.length !== 1) {
    return { ok: false, error: { exitCode: 1, stdout: "", stderr: USAGE } };
  }
  return { ok: true, path: inputPath, out };
}

function outputName(inputPath: string): string {
  const file = basename(inputPath);
  if (file.endsWith(".tessera.json")) {
    return file.slice(0, -".tessera.json".length);
  }
  if (file.endsWith(".json")) {
    return file.slice(0, -".json".length);
  }
  return file.length > 0 ? file : "export";
}

function loadSnapshot(
  inputPath: string,
): { ok: true; value: unknown } | { ok: false; error: ExportCliResult } {
  try {
    const stats = statSync(inputPath);
    const filePath = stats.isDirectory() ? join(inputPath, PROJECT_FILE) : inputPath;
    const text = readFileSync(filePath, "utf8");
    return { ok: true, value: JSON.parse(text) };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "I/O failed";
    return { ok: false, error: { exitCode: 1, stdout: "", stderr: `${message}\n` } };
  }
}

async function writeFiles(
  outDir: string,
  files: readonly { readonly path: string; readonly blob: Blob }[],
): Promise<ExportCliResult> {
  try {
    mkdirSync(outDir, { recursive: true });
    for (const file of files) {
      const bytes = new Uint8Array(await file.blob.arrayBuffer());
      writeFileSync(join(outDir, file.path), bytes);
    }
    return { exitCode: 0, stdout: "", stderr: "" };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "I/O failed";
    return { exitCode: 1, stdout: "", stderr: `${message}\n` };
  }
}
