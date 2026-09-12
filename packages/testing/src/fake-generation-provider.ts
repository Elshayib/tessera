import type {
  GenerationEstimate,
  GenerationPollResult,
  GenerationProvider,
  GenerationProviderDescriptor,
  GenerationRequest,
  GenerationResult,
  GenerationSubmitResult,
} from "@tessera/generation";
import type { BlobRef, License, Provenance } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";

/**
 * Scripted failure for {@link FakeGenerationProvider} (`13` §3).
 *
 * @public
 */
export type FakeGenerationFailure = TesseraError | "timeout" | "network";

/**
 * Options for {@link FakeGenerationProvider}.
 *
 * @public
 */
export interface FakeGenerationProviderOptions {
  readonly latencyMs?: number;
  readonly failEstimate?: FakeGenerationFailure;
  readonly failSubmit?: FakeGenerationFailure;
  readonly failPoll?: FakeGenerationFailure;
  readonly failFetch?: FakeGenerationFailure;
  readonly license?: License;
  readonly pollStates?: readonly GenerationPollResult["state"][];
  readonly resultBytes?: Uint8Array;
}

interface FakeJob {
  readonly request: GenerationRequest;
  state: GenerationPollResult["state"];
  cancelled: boolean;
}

const DEFAULT_DESCRIPTOR: GenerationProviderDescriptor = {
  id: "fake",
  displayName: "Fake generation",
  auth: "none",
  capabilities: {
    textToMesh: true,
    imageToMesh: true,
    textToTexture: true,
    meshToTexture: true,
    textToImage: true,
    textToEnvironment: true,
  },
  outputLicense: "CC0-1.0",
  typicalSeconds: { mesh: 1, texture: 1 },
  docsUrl: "https://example.invalid/generation",
};

/**
 * Deterministic {@link GenerationProvider} that never touches the network (`13` §3).
 *
 * @example
 * ```ts
 * const provider = new FakeGenerationProvider();
 * const submitted = await provider.submit({ kind: "mesh", pbr: true, prompt: "barrel" }, new AbortController().signal);
 * ```
 *
 * @public
 */
export class FakeGenerationProvider implements GenerationProvider {
  readonly descriptor: GenerationProviderDescriptor;
  readonly submitted: GenerationRequest[] = [];
  readonly cancelled: string[] = [];
  private readonly jobs = new Map<string, FakeJob>();
  private seq = 0;
  private readonly latencyMs: number;
  private readonly failEstimate: FakeGenerationFailure | undefined;
  private readonly failSubmit: FakeGenerationFailure | undefined;
  private readonly failPoll: FakeGenerationFailure | undefined;
  private readonly failFetch: FakeGenerationFailure | undefined;
  private readonly license: License;
  private readonly pollStates: readonly GenerationPollResult["state"][];
  private readonly resultBytes: Uint8Array | undefined;
  private pollCursor = 0;

  constructor(
    options: FakeGenerationProviderOptions = {},
    descriptor?: GenerationProviderDescriptor,
  ) {
    this.descriptor = descriptor ?? DEFAULT_DESCRIPTOR;
    this.latencyMs = options.latencyMs ?? 0;
    this.failEstimate = options.failEstimate;
    this.failSubmit = options.failSubmit;
    this.failPoll = options.failPoll;
    this.failFetch = options.failFetch;
    this.license = options.license ?? "CC0-1.0";
    this.pollStates = options.pollStates ?? ["succeeded"];
    this.resultBytes = options.resultBytes;
  }

  async estimate(request: GenerationRequest): Promise<Result<GenerationEstimate, TesseraError>> {
    const failed = this.failure(this.failEstimate);
    if (failed !== undefined) {
      return failed;
    }
    await delay(this.latencyMs);
    const seconds =
      request.kind === "texture"
        ? this.descriptor.typicalSeconds.texture
        : this.descriptor.typicalSeconds.mesh;
    return ok({ seconds });
  }

  async submit(
    request: GenerationRequest,
    signal: AbortSignal,
  ): Promise<Result<GenerationSubmitResult, TesseraError>> {
    if (signal.aborted) {
      return err(tesseraError("CANCELLED", "generation submit cancelled"));
    }
    const failed = this.failure(this.failSubmit);
    if (failed !== undefined) {
      return failed;
    }
    await delay(this.latencyMs);
    this.seq += 1;
    const remoteJobId = `fake-gen-${String(this.seq)}`;
    this.submitted.push(request);
    this.jobs.set(remoteJobId, { request, state: "queued", cancelled: false });
    return ok({ remoteJobId });
  }

  async poll(
    remoteJobId: string,
    signal: AbortSignal,
  ): Promise<Result<GenerationPollResult, TesseraError>> {
    if (signal.aborted) {
      return err(tesseraError("CANCELLED", "generation poll cancelled"));
    }
    const failed = this.failure(this.failPoll);
    if (failed !== undefined) {
      return failed;
    }
    const job = this.jobs.get(remoteJobId);
    if (job === undefined) {
      return err(tesseraError("NOT_FOUND", "generation job not found"));
    }
    if (job.cancelled) {
      return err(tesseraError("CANCELLED", "generation job cancelled"));
    }
    const state =
      this.pollStates[Math.min(this.pollCursor, this.pollStates.length - 1)] ?? "succeeded";
    this.pollCursor += 1;
    job.state = state;
    return ok({
      state,
      progress: state === "succeeded" ? 1 : 0.5,
      message: state,
    });
  }

  async fetchResult(
    remoteJobId: string,
    blobs: {
      write(
        bytes: Uint8Array,
        mime: string,
        fileName?: string,
        signal?: AbortSignal,
      ): Promise<Result<BlobRef, TesseraError>>;
    },
    signal: AbortSignal,
  ): Promise<Result<GenerationResult, TesseraError>> {
    if (signal.aborted) {
      return err(tesseraError("CANCELLED", "generation fetch cancelled"));
    }
    const failed = this.failure(this.failFetch);
    if (failed !== undefined) {
      return failed;
    }
    const job = this.jobs.get(remoteJobId);
    if (job === undefined) {
      return err(tesseraError("NOT_FOUND", "generation job not found"));
    }
    if (job.cancelled) {
      return err(tesseraError("CANCELLED", "generation job cancelled"));
    }
    const written = await blobs.write(
      this.resultBytes ?? new Uint8Array([0x67, 0x6c, 0x54, 0x46]),
      mimeFor(job.request.kind),
      fileNameFor(job.request.kind),
      signal,
    );
    if (!written.ok) {
      return written;
    }
    const prompt = promptOf(job.request);
    const provenance: Provenance = {
      source: "generated",
      importedAt: "2026-01-01T00:00:00.000Z",
      generator: {
        provider: this.descriptor.id,
        promptHash: hashPrompt(prompt),
        jobId: remoteJobId,
      },
    };
    return ok({
      kind: job.request.kind,
      blobs: [written.value],
      license: this.license,
      provenance,
      stats: { seconds: this.latencyMs / 1000 },
    });
  }

  async cancel(remoteJobId: string): Promise<void> {
    this.cancelled.push(remoteJobId);
    const job = this.jobs.get(remoteJobId);
    if (job !== undefined) {
      job.cancelled = true;
      job.state = "failed";
    }
  }

  private failure(
    value: FakeGenerationFailure | undefined,
  ): Result<never, TesseraError> | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === "timeout") {
      return err(tesseraError("TIMEOUT", "fake generation timed out"));
    }
    if (value === "network") {
      return err(tesseraError("PROVIDER_ERROR", "fake generation network error"));
    }
    return err(value);
  }
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function mimeFor(kind: GenerationRequest["kind"]): string {
  if (kind === "mesh") {
    return "model/gltf-binary";
  }
  if (kind === "environment") {
    return "image/vnd.radiance";
  }
  return "image/png";
}

function fileNameFor(kind: GenerationRequest["kind"]): string {
  if (kind === "mesh") {
    return "generated.glb";
  }
  if (kind === "environment") {
    return "generated.hdr";
  }
  if (kind === "texture") {
    return "generated.png";
  }
  return "generated.png";
}

function promptOf(request: GenerationRequest): string {
  if (request.kind === "mesh") {
    return request.prompt ?? "";
  }
  return request.prompt;
}

function hashPrompt(prompt: string): string {
  let hash = 0;
  for (let i = 0; i < prompt.length; i += 1) {
    hash = (hash * 31 + prompt.charCodeAt(i)) | 0;
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return `sha256-${hex}${"0".repeat(56)}`;
}
