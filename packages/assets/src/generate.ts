import type { GenerationProvider, GenerationRequest, GenerationResult } from "@tessera/generation";
import type { AssetId } from "@tessera/schema";
import { AssetIdSchema } from "@tessera/schema";
import type { Clock, Result, TesseraError } from "@tessera/std";
import { err, invariant, ok, tesseraError } from "@tessera/std";
import type { BlobStore } from "@tessera/storage";
import type { ImportPlan } from "./import-plan.js";
import { importGltf } from "./import-worker.js";

const POLL_START_MS = 2000;
const POLL_CAP_MS = 10_000;

/**
 * Delay used between generation polls (`07` §8.1). Tests inject a no-op.
 *
 * @public
 */
export type DelayFn = (ms: number, signal: AbortSignal) => Promise<void>;

/**
 * Default wall-clock delay.
 *
 * @public
 */
export function defaultDelay(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new Error("generation poll cancelled"));
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Submit → poll → fetchResult → ImportPlan (`07` §8.1, INV-PRV-05).
 *
 * @example
 * ```ts
 * await generateToPlan({ provider, request, blobs, clock, signal: AbortSignal.timeout(1) });
 * ```
 *
 * @public
 */
export async function generateToPlan(input: {
  readonly provider: GenerationProvider;
  readonly request: GenerationRequest;
  readonly blobs: BlobStore;
  readonly clock: Clock;
  readonly signal: AbortSignal;
  readonly delay?: DelayFn;
  readonly progress?: (p: number, message?: string) => void;
}): Promise<Result<ImportPlan, TesseraError>> {
  const delay = input.delay ?? defaultDelay;
  input.progress?.(0.05, "submit");
  const submitted = await input.provider.submit(input.request, input.signal);
  if (!submitted.ok) {
    return submitted;
  }
  const remoteJobId = submitted.value.remoteJobId;
  let wait = POLL_START_MS;
  let state: "queued" | "running" | "succeeded" | "failed" = "queued";
  while (state === "queued" || state === "running") {
    if (input.signal.aborted) {
      return err(tesseraError("CANCELLED", "generation cancelled"));
    }
    const polled = await input.provider.poll(remoteJobId, input.signal);
    if (!polled.ok) {
      return polled;
    }
    state = polled.value.state;
    input.progress?.(polled.value.progress ?? 0.4, polled.value.message);
    if (state === "failed") {
      return err(tesseraError("PROVIDER_ERROR", polled.value.message ?? "generation failed"));
    }
    if (state === "queued" || state === "running") {
      try {
        await delay(wait, input.signal);
      } catch (caught) {
        if (caught instanceof Error) {
          return err(tesseraError("CANCELLED", caught.message));
        }
        return err(tesseraError("CANCELLED", "generation poll cancelled"));
      }
      wait = Math.min(wait + POLL_START_MS, POLL_CAP_MS);
    }
  }
  input.progress?.(0.8, "fetch");
  const fetched = await input.provider.fetchResult(remoteJobId, input.blobs, input.signal);
  if (!fetched.ok) {
    return fetched;
  }
  if (fetched.value.license === "unknown") {
    return err(tesseraError("INVARIANT_VIOLATION", "generated asset license must not be unknown"));
  }
  return planFromGeneration({
    result: fetched.value,
    request: input.request,
    blobs: input.blobs,
    clock: input.clock,
    signal: input.signal,
  });
}

async function planFromGeneration(input: {
  readonly result: GenerationResult;
  readonly request: GenerationRequest;
  readonly blobs: BlobStore;
  readonly clock: Clock;
  readonly signal: AbortSignal;
}): Promise<Result<ImportPlan, TesseraError>> {
  const blob = input.result.blobs[0];
  if (blob === undefined) {
    return err(tesseraError("INVALID_INPUT", "generation result has no blob"));
  }
  if (input.result.kind === "mesh") {
    const body = await input.blobs.read(blob.hash, input.signal);
    if (!body.ok) {
      return body;
    }
    const bytes = new Uint8Array(await body.value.arrayBuffer());
    const plan = await importGltf({
      bytes,
      fileName: blob.fileName ?? "generated.glb",
      blobs: input.blobs,
      clock: input.clock,
      signal: input.signal,
    });
    if (!plan.ok) {
      return plan;
    }
    return ok(stampGenerated(plan.value, input.result));
  }
  const kind = input.result.kind === "environment" ? "environment" : "texture";
  if (kind === "environment") {
    return ok({
      blobs: input.result.blobs,
      assets: [
        {
          id: tempAssetId(),
          kind: "environment",
          name: nameFrom(input.request),
          license: input.result.license,
          provenance: input.result.provenance,
          source: { kind: "hdri", blob },
          rotation: 0,
          intensity: 1,
        },
      ],
      warnings: [],
    });
  }
  return ok({
    blobs: input.result.blobs,
    assets: [
      {
        id: tempAssetId(),
        kind: "texture",
        name: nameFrom(input.request),
        license: input.result.license,
        provenance: input.result.provenance,
        blob,
        colorSpace: "srgb",
        wrapS: "repeat",
        wrapT: "repeat",
        size: [1024, 1024],
        hasAlpha: false,
      },
    ],
    warnings: [],
  });
}

function stampGenerated(plan: ImportPlan, result: GenerationResult): ImportPlan {
  return {
    ...plan,
    assets: plan.assets.map((asset) => ({
      ...asset,
      license: result.license,
      provenance: result.provenance,
    })),
  };
}

function tempAssetId(): AssetId {
  const parsed = AssetIdSchema.safeParse("a_0000000000");
  invariant(parsed.success, "temporary asset id");
  return parsed.data;
}

function nameFrom(request: GenerationRequest): string {
  if (request.kind === "mesh") {
    return request.prompt ?? "generated";
  }
  return request.prompt;
}
