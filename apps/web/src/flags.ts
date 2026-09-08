/**
 * Typed feature flags (`01` §15). Unfinished features default off.
 *
 * @public
 */
export interface Flags {
  readonly polyhaven: boolean;
  readonly agentVerifyLoop: boolean;
  readonly createMenu: boolean;
}

const FLAG_NAMES = ["polyhaven", "agentVerifyLoop", "createMenu"] as const;

/**
 * All flags off.
 *
 * @public
 */
export function defaultFlags(): Flags {
  return { polyhaven: false, agentVerifyLoop: false, createMenu: false };
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
