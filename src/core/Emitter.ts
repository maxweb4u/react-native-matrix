import type { Unsubscribe } from '../types/session';

/**
 * Minimal typed event emitter.
 *
 * Replaces the fbemitter and rxjs usage of 0.0.x. Two properties matter here
 * and neither was true before: listeners are a set rather than a single slot,
 * so several screens can observe the same session at once, and a throwing
 * listener cannot prevent the remaining listeners from running.
 */
export class Emitter<Events> {
  private readonly listeners = new Map<keyof Events, Set<(payload: never) => void>>();

  private readonly onListenerError: (error: Error) => void;

  public constructor(onListenerError: (error: Error) => void = () => {}) {
    this.onListenerError = onListenerError;
  }

  public on<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): Unsubscribe {
    const existing = this.listeners.get(event);
    // A `const` rather than a reassigned `let`: older TypeScript versions drop
    // the narrowing inside the returned closure, and consumers compile this
    // source with their own compiler.
    const bucket = existing ?? new Set<(payload: never) => void>();
    if (!existing) {
      this.listeners.set(event, bucket);
    }

    const stored = listener as (payload: never) => void;
    bucket.add(stored);

    return () => {
      bucket.delete(stored);
      if (bucket.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  public emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const bucket = this.listeners.get(event);
    if (!bucket || bucket.size === 0) {
      return;
    }
    // Copy first: a listener may unsubscribe itself or others during dispatch.
    for (const listener of [...bucket]) {
      try {
        (listener as (value: Events[K]) => void)(payload);
      } catch (error) {
        this.onListenerError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  public listenerCount<K extends keyof Events>(event: K): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  public removeAll(): void {
    this.listeners.clear();
  }
}
