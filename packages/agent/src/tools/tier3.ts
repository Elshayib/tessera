import type { AssetService, SearchItem } from "@tessera/assets";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import { z } from "zod";
import type { ToolDefinition } from "./types.js";

const JobHandleSchema = z.object({
  jobId: z.string().min(1),
  etaSeconds: z.number(),
});

const AwaitInput = z.object({
  jobId: z.string().min(1),
  timeoutMs: z.number().int().positive(),
});

/**
 * Tier-3 asset/generate/job tools (`06` §5, `08` §10, Q-0180).
 *
 * @example
 * ```ts
 * for (const tool of createTier3Tools(assets)) registry.register(tool);
 * ```
 *
 * @public
 */
function field(record: Record<string, unknown>, key: string): unknown {
  return record[key];
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    out[index] = binary.charCodeAt(index);
  }
  return out;
}

function isSearchItem(value: unknown): value is SearchItem {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record: Record<string, unknown> = { ...value };
  const kind = field(record, "kind");
  return (
    typeof field(record, "id") === "string" &&
    typeof field(record, "name") === "string" &&
    (kind === "model" || kind === "texture" || kind === "hdri") &&
    typeof field(record, "license") === "string"
  );
}

export function createTier3Tools(assets: AssetService): readonly ToolDefinition[] {
  const handleOf = async (
    result: Result<{ readonly id: string; readonly etaSeconds: number }, TesseraError>,
  ): Promise<Result<{ jobId: string; etaSeconds: number }, TesseraError>> => {
    if (!result.ok) {
      return result;
    }
    return ok({ jobId: result.value.id, etaSeconds: result.value.etaSeconds });
  };
  return [
    {
      name: "asset.search",
      description: "Search an asset library. Returns untrusted names.",
      tier: 3,
      group: "assets",
      input: z.object({
        sourceId: z.string().min(1),
        text: z.string(),
        kind: z.enum(["model", "texture", "hdri"]),
      }),
      output: z.object({ items: z.array(z.unknown()) }),
      destructive: false,
      async execute(raw, ctx) {
        const parsed = z
          .object({
            sourceId: z.string().min(1),
            text: z.string(),
            kind: z.enum(["model", "texture", "hdri"]),
          })
          .safeParse(raw);
        if (!parsed.success) {
          return err(tesseraError("INVALID_INPUT", "asset.search input"));
        }
        const input = parsed.data;
        const page = await assets.search(
          input.sourceId,
          { text: input.text, kind: input.kind },
          ctx.signal,
        );
        if (!page.ok) {
          return page;
        }
        return ok({ items: page.value.items });
      },
    },
    {
      name: "asset.add",
      description: "Add a library search hit to the document as a job.",
      tier: 3,
      group: "assets",
      input: z.object({
        sourceId: z.string().min(1),
        item: z.unknown(),
      }),
      output: JobHandleSchema,
      destructive: false,
      async execute(raw, ctx) {
        const parsed = z.object({ sourceId: z.string().min(1), item: z.unknown() }).safeParse(raw);
        if (!parsed.success || !isSearchItem(parsed.data.item)) {
          return err(tesseraError("INVALID_INPUT", "asset.add needs a search item"));
        }
        return handleOf(
          await assets.addFromSource(
            parsed.data.sourceId,
            parsed.data.item,
            {
              author: ctx.author,
            },
            ctx.signal,
          ),
        );
      },
    },
    {
      name: "asset.generateMesh",
      description: "Generate a mesh and import it as a job.",
      tier: 3,
      group: "generate",
      input: z.object({
        providerId: z.string().min(1),
        prompt: z.string().min(1),
        style: z.enum(["realistic", "stylized", "lowpoly"]).optional(),
      }),
      output: JobHandleSchema,
      destructive: false,
      async execute(raw, ctx) {
        const parsed = z
          .object({
            providerId: z.string().min(1),
            prompt: z.string().min(1),
            style: z.enum(["realistic", "stylized", "lowpoly"]).optional(),
          })
          .safeParse(raw);
        if (!parsed.success) {
          return err(tesseraError("INVALID_INPUT", "asset.generateMesh input"));
        }
        const input = parsed.data;
        return handleOf(
          await assets.generate(
            input.providerId,
            {
              kind: "mesh",
              pbr: true,
              prompt: input.prompt,
              ...(input.style === undefined ? {} : { style: input.style }),
            },
            { author: ctx.author },
            ctx.signal,
          ),
        );
      },
    },
    {
      name: "asset.generateTexture",
      description: "Generate a texture and import it as a job.",
      tier: 3,
      group: "generate",
      input: z.object({
        providerId: z.string().min(1),
        prompt: z.string().min(1),
      }),
      output: JobHandleSchema,
      destructive: false,
      async execute(raw, ctx) {
        const parsed = z
          .object({ providerId: z.string().min(1), prompt: z.string().min(1) })
          .safeParse(raw);
        if (!parsed.success) {
          return err(tesseraError("INVALID_INPUT", "asset.generateTexture input"));
        }
        const input = parsed.data;
        return handleOf(
          await assets.generate(
            input.providerId,
            { kind: "texture", prompt: input.prompt, resolution: 1024, maps: ["baseColor"] },
            { author: ctx.author },
            ctx.signal,
          ),
        );
      },
    },
    {
      name: "asset.generateEnvironment",
      description: "Generate an environment HDRI as a job.",
      tier: 3,
      group: "generate",
      input: z.object({
        providerId: z.string().min(1),
        prompt: z.string().min(1),
      }),
      output: JobHandleSchema,
      destructive: false,
      async execute(raw, ctx) {
        const parsed = z
          .object({ providerId: z.string().min(1), prompt: z.string().min(1) })
          .safeParse(raw);
        if (!parsed.success) {
          return err(tesseraError("INVALID_INPUT", "asset.generateEnvironment input"));
        }
        const input = parsed.data;
        return handleOf(
          await assets.generate(
            input.providerId,
            { kind: "environment", prompt: input.prompt, resolution: 2048 },
            { author: ctx.author },
            ctx.signal,
          ),
        );
      },
    },
    {
      name: "asset.import",
      description: "Import local files as a job.",
      tier: 3,
      group: "assets",
      input: z.object({
        blob: z.object({
          fileName: z.string().min(1),
          bytesBase64: z.string().min(1),
          mime: z.string().optional(),
        }),
      }),
      output: JobHandleSchema,
      destructive: false,
      async execute(raw, ctx) {
        const parsed = z
          .object({
            blob: z.object({
              fileName: z.string().min(1),
              bytesBase64: z.string().min(1),
              mime: z.string().optional(),
            }),
          })
          .safeParse(raw);
        if (!parsed.success) {
          return err(tesseraError("INVALID_INPUT", "asset.import needs fileName and bytesBase64"));
        }
        const blob = parsed.data.blob;
        const bytes = base64ToBytes(blob.bytesBase64);
        const file = {
          name: blob.fileName,
          type: blob.mime ?? "",
          size: bytes.byteLength,
          async arrayBuffer(): Promise<ArrayBuffer> {
            const copy = new Uint8Array(bytes.byteLength);
            copy.set(bytes);
            return copy.buffer;
          },
        };
        const started = await assets.importFiles([file], { author: ctx.author }, ctx.signal);
        if (!started.ok) {
          return started;
        }
        const handle = started.value[0];
        if (handle === undefined) {
          return err(tesseraError("INVARIANT_VIOLATION", "asset.import produced no job"));
        }
        return ok({ jobId: handle.id, etaSeconds: handle.etaSeconds });
      },
    },
    {
      name: "jobs.await",
      description: "Wait for a job to finish. timeoutMs must be ≤ 120000.",
      tier: 3,
      group: "assets",
      input: AwaitInput,
      output: z.object({ state: z.string() }),
      destructive: false,
      async execute(raw, ctx) {
        const parsed = AwaitInput.safeParse(raw);
        if (!parsed.success) {
          return err(tesseraError("INVALID_INPUT", "jobs.await input"));
        }
        const input = parsed.data;
        if (input.timeoutMs > 120_000) {
          return err(tesseraError("INVALID_INPUT", "jobs.await timeoutMs must be ≤ 120000"));
        }
        const started = Date.now();
        while (Date.now() - started <= input.timeoutMs) {
          if (ctx.signal.aborted) {
            return err(tesseraError("CANCELLED", "jobs.await cancelled"));
          }
          const status = ctx.jobs.get(input.jobId);
          if (status === undefined) {
            return err(tesseraError("NOT_FOUND", "job not found"));
          }
          if (
            status.state === "succeeded" ||
            status.state === "failed" ||
            status.state === "cancelled"
          ) {
            return ok({ state: status.state });
          }
          await new Promise((resolve) => {
            setTimeout(resolve, 5);
          });
        }
        return err(tesseraError("TIMEOUT", "jobs.await timed out"));
      },
    },
  ];
}
