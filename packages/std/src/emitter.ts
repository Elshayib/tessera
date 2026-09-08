import type { Logger } from "./logger.js";

/**
 * Optional dependencies for {@link Emitter}.
 *
 * @public
 */
export interface EmitterOptions {
  readonly logger?: Logger;
}

/**
 * Typed event emitter. Listener throws are isolated and logged; other listeners still run.
 *
 * @example
 * ```ts
 * const emitter = new Emitter<{ committed: string }>();
 * const stop = emitter.on("committed", (id) => {
 *   void id;
 * });
 * emitter.emit("committed", "t_abc");
 * stop();
 * ```
 *
 * @public
 */
export class Emitter<EventMap extends Record<string, unknown>> {
  private readonly listeners: {
    [K in keyof EventMap]?: Set<(payload: EventMap[K]) => void>;
  } = {};
  private readonly logger: Logger | undefined;

  constructor(options: EmitterOptions = {}) {
    this.logger = options.logger;
  }

  /**
   * Subscribes to `event`. Returns an unsubscribe function.
   *
   * @public
   */
  on<K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): () => void {
    const existing = this.listeners[event];
    const bucket = existing ?? new Set<(payload: EventMap[K]) => void>();
    bucket.add(listener);
    this.listeners[event] = bucket;
    return () => {
      bucket.delete(listener);
    };
  }

  /**
   * Dispatches `payload` to current listeners of `event`.
   *
   * @public
   */
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const bucket = this.listeners[event];
    if (bucket === undefined) {
      return;
    }
    for (const listener of [...bucket]) {
      try {
        listener(payload);
      } catch (caught) {
        const logger = this.logger;
        if (logger !== undefined) {
          logger.error("std.emitter.listener_error", {
            event: String(event),
            name: caught instanceof Error ? caught.name : "unknown",
          });
        }
      }
    }
  }
}
