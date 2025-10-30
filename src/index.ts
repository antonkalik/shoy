// react-patch-store.ts
import * as React from "react";

/* --------------------------------------------------------------
   Types
   -------------------------------------------------------------- */
type Patch<S> = S extends object
    ? Partial<S> | ((prev: S) => Partial<S>)
    : S | ((prev: S) => S);
type Hash = string;

interface PatchStoreOptions {
    /** 0 = disabled (default), >0 = keep N previous versions */
    maxHistory?: number;
    /** Custom error handler for store operations */
    onError?: (error: Error, context: string) => void;
}

/* --------------------------------------------------------------
   PatchStore – core implementation
   -------------------------------------------------------------- */
export class PatchStore<S> {
    private readonly versions = new Map<Hash, S>();
    private rootHash: Hash = "";
    private readonly listeners = new Set<(hash: Hash) => void>();
    private readonly maxHistory: number;
    private readonly onError?: (error: Error, context: string) => void;

    /* ---- 1. Synchronous initialisation -------------------------------- */
    constructor(initialState: S, options: PatchStoreOptions = {}) {
        this.maxHistory = options.maxHistory ?? 0;
        this.onError = options.onError;

        try {
            const initHash = this.syncHash(initialState);
            this.versions.set(initHash, initialState);
            this.rootHash = initHash;
        } catch (error) {
            this.handleError(error as Error, "constructor");
            throw error;
        }
    }

    /* ---- 2. Ultra-fast deterministic hash for the *initial* value ---- */
    private syncHash(state: S): Hash {
        // For primitives, use direct value comparison for better performance
        if (typeof state !== "object" || state === null) {
            return "p" + String(state);
        }

        // Use fast object hash instead of JSON serialization
        const hashStr = this.fastObjectHash(state);
        let h = 5381;
        for (let i = 0; i < hashStr.length; i++) {
            h = (h * 33) ^ hashStr.charCodeAt(i);
        }
        return "i" + (h >>> 0).toString(36);
    }

    /* ---- 3. Ultra-fast hashing for every *apply* -------------------- */
    private async hash(state: S): Promise<Hash> {
        // For primitives, use direct value comparison for better performance
        if (typeof state !== "object" || state === null) {
            return "p" + String(state);
        }

        // For objects, use a fast deterministic hash without JSON serialization
        const hashStr = this.fastObjectHash(state);
        const enc = new TextEncoder();
        const buf = enc.encode(hashStr);
        const digest = await crypto.subtle.digest("SHA-256", buf);
        return Array.from(new Uint8Array(digest))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
    }

    /* ---- 3.1. Fast object hashing without JSON ---------------------- */
    private fastObjectHash(obj: object): string {
        if (Array.isArray(obj)) {
            return (
                "[" +
                obj
                    .map((item) =>
                        typeof item === "object" && item !== null
                            ? this.fastObjectHash(item)
                            : String(item),
                    )
                    .join(",") +
                "]"
            );
        }

        const keys = Object.keys(obj).sort(); // Sort for deterministic order
        return (
            "{" +
            keys
                .map((key) => {
                    const value = (obj as Record<string, unknown>)[key];
                    const valueStr =
                        typeof value === "object" && value !== null
                            ? this.fastObjectHash(value)
                            : String(value);
                    return `${key}:${valueStr}`;
                })
                .join(",") +
            "}"
        );
    }

    /* ---- 3.5. Ultra-fast deep equality check ----------------------- */
    private isEqual(a: S, b: S): boolean {
        // For primitives, use direct comparison (fastest possible)
        if (
            typeof a !== "object" ||
            a === null ||
            typeof b !== "object" ||
            b === null
        ) {
            return Object.is(a, b);
        }

        // Same reference = same value
        if (a === b) return true;

        // Different constructors = different types
        if (a.constructor !== b.constructor) return false;

        // Handle arrays efficiently
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return false;
            for (let i = 0; i < a.length; i++) {
                if (!this.isEqual(a[i], b[i])) return false;
            }
            return true;
        }

        // Handle objects with optimized property iteration
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);

        if (keysA.length !== keysB.length) return false;

        // Use for...of for better performance than forEach
        for (const key of keysA) {
            if (!keysB.includes(key)) return false;
            if (
                !this.isEqual(
                    (a as Record<string, unknown>)[key] as S,
                    (b as Record<string, unknown>)[key] as S,
                )
            )
                return false;
        }

        return true;
    }

    /* ---- 4. Commit a new version ------------------------------------ */
    private async commit(state: S): Promise<Hash> {
        try {
            // Validate state before committing
            this.validateState(state);

            const hash = await this.hash(state);

            // **Always** keep the current version
            this.versions.set(hash, state);

            // Prune extra history if enabled
            if (this.maxHistory > 0) {
                this.prune();
            } else {
                // maxHistory === 0 → keep **only** the current version
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

    /* ---- 5. Public API – apply a patch ------------------------------ */
    async apply(patch: Patch<S>): Promise<Hash> {
        try {
            const prev = this.current;
            const next = typeof patch === "function" ? patch(prev) : patch;

            // Check if the new state is actually different from current state
            if (this.isEqual(prev, next)) {
                return this.rootHash; // Return current hash without committing
            }

            return await this.commit(next);
        } catch (error) {
            this.handleError(error as Error, "apply");
            throw error;
        }
    }

    /* ---- 6. Current snapshot (always defined) ---------------------- */
    get current(): S {
        const state = this.versions.get(this.rootHash);
        if (!state) {
            const error = new Error("PatchStore corrupted – rootHash missing");
            this.handleError(error, "current");
            throw error;
        }
        return state;
    }

    /* ---- 7. Subscription ------------------------------------------- */
    subscribe(cb: (hash: Hash) => void): () => void {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    }
    private notify(hash: Hash): void {
        this.listeners.forEach((cb) => cb(hash));
    }

    /* ---- 8. Optional undo / history -------------------------------- */
    async revert(hash: Hash): Promise<boolean> {
        if (this.maxHistory === 0 || !this.versions.has(hash)) return false;
        this.rootHash = hash;
        this.notify(hash);
        return true;
    }

    get history(): Hash[] {
        return this.maxHistory > 0 ? Array.from(this.versions.keys()) : [];
    }

    /* ---- 9. Bounded pruning --------------------------------------- */
    private prune(): void {
        if (this.maxHistory <= 0) return;
        const keys = Array.from(this.versions.keys());
        // keep current + maxHistory previous versions
        if (keys.length > this.maxHistory + 1) {
            const toRemove = keys.slice(0, keys.length - this.maxHistory - 1);
            for (const k of toRemove) this.versions.delete(k);
        }
    }

    /* ---- 10. Error handling --------------------------------------- */
    private handleError(error: Error, context: string): void {
        if (this.onError) {
            this.onError(error, context);
        } else {
            // Default error handling - log to console
            console.error(`PatchStore Error in ${context}:`, error);
        }
    }

    /* ---- 11. Validation helpers ----------------------------------- */
    private validateState(state: S): void {
        // Check for circular references in objects
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
                if (typeof item === "object" && item !== null) {
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

export function usePatch<S, R>(
    store: PatchStore<S>,
    selector: (state: S) => R,
): R {
    // Initialise with the *real* current value (synchronous)
    const [value, setValue] = React.useState<R>(() => selector(store.current));

    React.useEffect(() => {
        const update = () => {
            const next = selector(store.current);
            setValue((prev) => (Object.is(prev, next) ? prev : next));
        };
        return store.subscribe(update);
    }, [store, selector]);

    return value;
}

export function usePatchApply<S>(store: PatchStore<S>) {
    return React.useCallback((patch: Patch<S>) => store.apply(patch), [store]);
}
