/**
 * Hostnames allowed by the CI fetch guard (`INV-TST-01`).
 *
 * @public
 */
export const FETCH_GUARD_LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "::1"] as const;

/**
 * True when `url` is loopback HTTP(S).
 *
 * @example
 * ```ts
 * isLoopbackFetchUrl("http://127.0.0.1:11434/v1");
 * ```
 *
 * @public
 */
export function isLoopbackFetchUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^\[/, "").replace(/\]$/, "");
    for (const allowed of FETCH_GUARD_LOOPBACK_HOSTS) {
      if (host === allowed) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

/**
 * Installs a `fetch` guard that fails on non-loopback hosts (`INV-TST-01`).
 *
 * @returns Restore function for the previous `fetch`.
 *
 * @example
 * ```ts
 * const restore = installFetchGuard();
 * restore();
 * ```
 *
 * @public
 */
export function installFetchGuard(): () => void {
  const original = globalThis.fetch;
  function guarded(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = requestUrl(input);
    if (!isLoopbackFetchUrl(url)) {
      return Promise.reject(new Error(`INV-TST-01 fetch guard rejected non-loopback host: ${url}`));
    }
    return original(input, init);
  }
  globalThis.fetch = guarded;
  return () => {
    globalThis.fetch = original;
  };
}
