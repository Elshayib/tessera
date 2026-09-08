import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const YJS_IMPORT_ALLOW = ["packages/core/", "packages/storage/"];
const TRANSACT_ALLOW = ["packages/core/"];

const YJS_IMPORT = /from\s+["']yjs(?:\/[^"']*)?["']/;
const TRANSACT = /\.transact\s*\(/;

export interface SourceFile {
  readonly path: string;
  readonly text: string;
}

/**
 * Returns paths that import yjs or call `.transact(` outside `@tessera/core`.
 */
export function findForbiddenYjsUsages(files: readonly SourceFile[]): readonly string[] {
  const hits: string[] = [];
  for (const file of files) {
    const normalized = file.path.replaceAll("\\", "/");
    if (YJS_IMPORT_ALLOW.some((prefix) => normalized.includes(prefix))) {
      if (
        TRANSACT.test(file.text) &&
        !TRANSACT_ALLOW.some((prefix) => normalized.includes(prefix))
      ) {
        hits.push(normalized);
      }
      continue;
    }
    if (YJS_IMPORT.test(file.text) || TRANSACT.test(file.text)) {
      hits.push(normalized);
    }
  }
  return hits;
}

function walk(dir: string, files: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === "dist" || entry === "coverage") {
        continue;
      }
      walk(full, files);
      continue;
    }
    if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      files.push(full);
    }
  }
}

function runCheckNoDirectYjs(): number {
  const roots = ["packages", "apps"];
  const files: SourceFile[] = [];
  for (const root of roots) {
    const collected: string[] = [];
    try {
      walk(root, collected);
    } catch {
      continue;
    }
    for (const path of collected) {
      files.push({
        path: relative(process.cwd(), path).replaceAll("\\", "/"),
        text: readFileSync(path, "utf8"),
      });
    }
  }
  const hits = findForbiddenYjsUsages(files);
  if (hits.length > 0) {
    process.stderr.write(`forbidden yjs usage:\n${hits.join("\n")}\n`);
    return 1;
  }
  return 0;
}

const entry = process.argv[1];
if (entry !== undefined && fileURLToPath(import.meta.url) === resolve(entry)) {
  process.exitCode = runCheckNoDirectYjs();
}
