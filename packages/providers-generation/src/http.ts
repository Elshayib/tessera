import type { Result, TesseraError } from "@tessera/std";
import { err, ok } from "@tessera/std";
import { mapGenerationError } from "./map-provider-error.js";

/**
 * Injected HTTP for generation adapters. Tests replay fixtures.
 *
 * @public
 */
export interface GenerationHttp {
  request(
    input: {
      readonly method: "GET" | "POST" | "DELETE";
      readonly url: string;
      readonly headers?: Readonly<Record<string, string>>;
      readonly body?: string;
    },
    signal: AbortSignal,
  ): Promise<Result<{ readonly status: number; readonly body: string }, TesseraError>>;
}

/**
 * JSON helper over {@link GenerationHttp}.
 *
 * @public
 */
export async function requestJson(
  http: GenerationHttp,
  input: {
    readonly method: "GET" | "POST" | "DELETE";
    readonly url: string;
    readonly headers?: Readonly<Record<string, string>>;
    readonly body?: unknown;
  },
  signal: AbortSignal,
): Promise<Result<unknown, TesseraError>> {
  const sent = await http.request(
    {
      method: input.method,
      url: input.url,
      headers: { accept: "application/json", ...input.headers },
      ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
    },
    signal,
  );
  if (!sent.ok) {
    return sent;
  }
  if (sent.value.status === 204) {
    return ok(undefined);
  }
  if (sent.value.status >= 400) {
    return err(
      mapGenerationError({
        kind: "http",
        status: sent.value.status,
        vendorBody: sent.value.body,
      }),
    );
  }
  if (sent.value.body.length === 0) {
    return ok(undefined);
  }
  try {
    return ok(JSON.parse(sent.value.body) as unknown);
  } catch {
    return err(mapGenerationError({ kind: "network" }));
  }
}

/**
 * Fetch-backed {@link GenerationHttp}. Unused in unit tests.
 *
 * @public
 */
/**
 * In-memory {@link GenerationHttp} for recorded-fixture tests.
 *
 * @public
 */
export function createMemoryGenerationHttp(
  handler: (input: {
    readonly method: string;
    readonly url: string;
    readonly body?: string;
  }) => { readonly status: number; readonly body: string } | undefined,
): GenerationHttp {
  return {
    async request(input, signal) {
      if (signal.aborted) {
        return err(mapGenerationError({ kind: "abort" }));
      }
      const found = handler({
        method: input.method,
        url: input.url,
        ...(input.body === undefined ? {} : { body: input.body }),
      });
      if (found === undefined) {
        return ok({ status: 404, body: "{}" });
      }
      return ok(found);
    },
  };
}

/**
 * Fetch-backed {@link GenerationHttp}. Unused in unit tests.
 *
 * @public
 */
export function createFetchGenerationHttp(): GenerationHttp {
  return {
    async request(input, signal) {
      if (signal.aborted) {
        return err(mapGenerationError({ kind: "abort" }));
      }
      try {
        const response = await fetch(input.url, {
          method: input.method,
          signal,
          ...(input.headers === undefined ? {} : { headers: input.headers }),
          ...(input.body === undefined ? {} : { body: input.body }),
        });
        return ok({ status: response.status, body: await response.text() });
      } catch (caught) {
        if (signal.aborted) {
          return err(mapGenerationError({ kind: "abort" }));
        }
        const message = caught instanceof Error ? caught.message : "";
        if (message.toLowerCase().includes("timeout")) {
          return err(mapGenerationError({ kind: "timeout" }));
        }
        return err(mapGenerationError({ kind: "network" }));
      }
    },
  };
}
