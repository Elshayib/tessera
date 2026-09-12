/**
 * Typed feature flags (`01` §15). Unfinished features default off.
 *
 * @public
 */
export interface Flags {
  readonly polyhaven: boolean;
  readonly agentVerifyLoop: boolean;
  readonly createMenu: boolean;
  readonly agentDryRun: boolean;
}

const FLAG_NAMES = ["polyhaven", "agentVerifyLoop", "createMenu", "agentDryRun"] as const;

/**
 * Defaults: Poly Haven on (T-0120); unfinished flags off.
 *
 * @public
 */
export function defaultFlags(): Flags {
  return { polyhaven: true, agentVerifyLoop: false, createMenu: true, agentDryRun: false };
}

/**
 * Bootstrap `RunPolicy.verify` from flags (`06` §8, T-0208).
 *
 * @example
 * ```ts
 * bootstrapVerifyMode(defaultFlags()) === "none";
 * ```
 *
 * @public
 */
export function bootstrapVerifyMode(flags: Flags): "none" | "spatial" | "spatial+vision" {
  return flags.agentVerifyLoop ? "spatial" : "none";
}

function enableKnown(flags: Flags, name: string): Flags {
  if (name === "polyhaven") {
    return { ...flags, polyhaven: true };
  }
  if (name === "agentVerifyLoop") {
    return { ...flags, agentVerifyLoop: true };
  }
  if (name === "createMenu") {
    return { ...flags, createMenu: true };
  }
  if (name === "agentDryRun") {
    return { ...flags, agentDryRun: true };
  }
  void FLAG_NAMES;
  return flags;
}

/**
 * Parses `?flag=name` in development. Production ignores the query string.
 *
 * @example
 * ```ts
 * parseFlags("?flag=polyhaven", true).polyhaven === true;
 * ```
 *
 * @public
 */
export function parseFlags(search: string, isDev: boolean): Flags {
  const flags = defaultFlags();
  if (!isDev) {
    return flags;
  }
  const query = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(query);
  let next = flags;
  for (const name of params.getAll("flag")) {
    next = enableKnown(next, name);
  }
  return next;
}
