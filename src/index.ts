import * as React from "react";

export type Patch<S> = S extends object
  ? Partial<S> | ((prev: S) => Partial<S>)
  : S | ((prev: S) => S);

export type Hash = string;

interface Options {
  maxHistory?: number;
  onError?: (error: Error, context: string) => void;
}

export class Shoy<S> {
  private readonly versions = new Map<Hash, S>();
  private rootHash: Hash = "";
  private readonly listeners = new Set<(hash: Hash) => void>();
  private readonly maxHistory: number;
  private readonly onError?: (error: Error, context: string) => void;

  constructor(initialState: S, options: Options = {}) {
    this.maxHistory = options.maxHistory ?? 0;
    this.onError = options.onError;

    try {
      this.validateState(initialState);
      const initHash = this.hash(initialState);
      this.versions.set(initHash, initialState);
      this.rootHash = initHash;
    } catch (error) {
      this.handleError(error as Error, "constructor");
      throw error;
    }
  }

  private isObject<T>(value: T): boolean {
    return typeof value === "object" && value !== null;
  }

  private isPrimitive<T>(value: T): boolean {
    return typeof value !== "object" || value === null;
  }

  private deepMerge<T>(prev: T, patch: Partial<T>): T {
    if (this.isPrimitive(prev) || this.isPrimitive(patch)) {
      return patch as T;
    }

    if (Array.isArray(prev) || Array.isArray(patch)) {
      return patch as T;
    }

    const result = { ...(prev as object) } as T;
    for (const key in patch) {
      if (patch.hasOwnProperty(key)) {
        const prevValue = (prev as Record<string, unknown>)[key];
        const patchValue = patch[key];

        if (
          this.isObject(prevValue) &&
          this.isObject(patchValue) &&
          !Array.isArray(prevValue) &&
          !Array.isArray(patchValue)
        ) {
          (result as Record<string, unknown>)[key] = this.deepMerge(
            prevValue,
            patchValue as Partial<typeof prevValue>,
          );
        } else {
          (result as Record<string, unknown>)[key] = patchValue;
        }
      }
    }
    return result;
  }

  private hash(state: S): Hash {
    if (this.isPrimitive(state)) {
      return "p" + String(state);
    }

    const hashStr = this.fastObjectHash<S>(state);
    let h = 5381;
    for (let i = 0; i < hashStr.length; i++) {
      h = (h * 33) ^ hashStr.charCodeAt(i);
    }
    return "i" + (h >>> 0).toString(36);
  }

  private fastObjectHash<S>(obj: S): string {
    if (Array.isArray(obj)) {
      return (
        "[" +
        obj
          .map((item) =>
            this.isObject(item) ? this.fastObjectHash(item) : String(item),
          )
          .join(",") +
        "]"
      );
    }

    const keys = Object.keys(obj as Record<string, unknown>).sort();

    return (
      "{" +
      keys
        .map((key) => {
          const value = (obj as Record<string, unknown>)[key];
          const valueStr = this.isObject(value)
            ? this.fastObjectHash(value as object)
            : String(value);
          return `${key}:${valueStr}`;
        })
        .join(",") +
      "}"
    );
  }

  private commit(state: S): Hash {
    try {
      this.validateState(state);

      const hash = this.hash(state);

      this.versions.set(hash, state);

      if (this.maxHistory > 0) {
        this.prune();
      } else {
        for (const k of this.versions.keys()) {
          if (k !== hash) this.versions.delete(k);
        }
      }

      this.rootHash = hash;
      this.notify(hash);
      return hash;
    } catch (error) {
      this.handleError(error as Error, "commit");
      throw error;
    }
  }

  apply(patch: Patch<S>): Hash {
    try {
      const prev = this.current;
      const patchResult = typeof patch === "function" ? patch(prev) : patch;

      if (this.isPrimitive(prev) && this.isPrimitive(patchResult)) {
        if (Object.is(prev, patchResult)) {
          return this.rootHash;
        }
        return this.commit(patchResult as S);
      }

      const next = this.deepMerge(prev, patchResult as Partial<S>);

      const nextHash = this.hash(next);
      if (nextHash === this.rootHash) {
        return this.rootHash;
      }

      return this.commit(next);
    } catch (error) {
      this.handleError(error as Error, "apply");
      throw error;
    }
  }

  get current(): S {
    const state = this.versions.get(this.rootHash);
    if (!state) {
      const error = new Error("Shoy corrupted – rootHash missing");
      this.handleError(error, "current");
      throw error;
    }
    return state;
  }

  get currentHash(): Hash {
    return this.rootHash;
  }

  subscribe(cb: (hash: Hash) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  private notify(hash: Hash): void {
    this.listeners.forEach((cb) => cb(hash));
  }

  revert(hash: Hash): boolean {
    if (this.maxHistory === 0 || !this.versions.has(hash)) return false;
    this.rootHash = hash;
    this.notify(hash);
    return true;
  }

  undo(): boolean {
    if (this.maxHistory === 0) return false;
    const currentIdx = this.history.indexOf(this.rootHash);
    if (currentIdx <= 0) return false;

    const prevHash = this.history[currentIdx - 1];
    this.rootHash = prevHash;
    this.notify(prevHash);
    return true;
  }

  redo(): boolean {
    if (this.maxHistory === 0) return false;
    const currentIdx = this.history.indexOf(this.rootHash);
    if (currentIdx >= this.history.length - 1) return false;

    const nextHash = this.history[currentIdx + 1];
    this.rootHash = nextHash;
    this.notify(nextHash);
    return true;
  }

  get history(): Hash[] {
    return this.maxHistory > 0 ? Array.from(this.versions.keys()) : [];
  }

  private prune(): void {
    if (this.maxHistory <= 0) return;
    const keys = Array.from(this.versions.keys());

    if (keys.length > this.maxHistory + 1) {
      const toRemove = keys.slice(0, keys.length - this.maxHistory - 1);
      for (const k of toRemove) this.versions.delete(k);
    }
  }

  private handleError(error: Error, context: string): void {
    if (this.onError) {
      this.onError(error, context);
    } else {
      console.error(`Shoy Error in ${context}:`, error);
    }
  }

  private validateState(state: S): void {
    if (typeof state === "object" && state !== null) {
      this.checkCircularReference(state, new Set());
    }
  }

  private checkCircularReference(obj: object, visited: Set<object>): void {
    if (visited.has(obj)) {
      throw new Error("Circular reference detected in state object");
    }

    visited.add(obj);

    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (this.isObject(item)) {
          this.checkCircularReference(item, new Set(visited));
        }
      }
    } else {
      for (const value of Object.values(obj)) {
        if (typeof value === "object" && value !== null) {
          this.checkCircularReference(value, new Set(visited));
        }
      }
    }
  }
}

export { useSelector as useGet } from './utils/query';

export function useApply<S>(store: Shoy<S>) {
  return React.useCallback((patch: Patch<S>) => store.apply(patch), [store]);
}
