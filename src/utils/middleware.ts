import type { Shoy, Patch } from '../index';
import type { Middleware } from './types';

const middlewareChains = new WeakMap<Shoy<unknown>, MiddlewareChain<unknown>>();

class MiddlewareChain<T> {
  private middlewares: Middleware<T>[] = [];

  add(middleware: Middleware<T>): () => void {
    this.middlewares.push(middleware);
    return () => {
      const index = this.middlewares.indexOf(middleware);
      if (index > -1) this.middlewares.splice(index, 1);
    };
  }

  executeBefore(prev: T, next: T): T {
    let result = next;
    for (const middleware of this.middlewares) {
      if (middleware.before) {
        const processed = middleware.before(prev, result);
        if (processed !== undefined) {
          result = processed;
        }
      }
    }
    return result;
  }

  executeAfter(state: T, hash: string): void {
    for (const middleware of this.middlewares) {
      if (middleware.after) {
        middleware.after(state, hash);
      }
    }
  }
}

function getOrCreateChain<S>(store: Shoy<S>): MiddlewareChain<S> {
  let chain = middlewareChains.get(store as Shoy<unknown>) as MiddlewareChain<S> | undefined;
  if (!chain) {
    chain = new MiddlewareChain<S>();
    middlewareChains.set(store as Shoy<unknown>, chain as MiddlewareChain<unknown>);
    
    const originalApply = store.apply.bind(store);
    const storeWithCurrent = store as Shoy<S> & { current: S };
    
    (store as unknown as { apply: typeof store.apply }).apply = function(patch: Patch<S>) {
      const prev = storeWithCurrent.current;
      
      const patchResult = typeof patch === "function" ? patch(prev) : patch;
      
      let next: S;
      if (typeof prev === "object" && prev !== null && typeof patchResult === "object" && patchResult !== null) {
        const result = { ...(prev as object) } as S;
        for (const key in patchResult) {
          if (patchResult.hasOwnProperty(key)) {
            (result as Record<string, unknown>)[key] = (patchResult as Record<string, unknown>)[key];
          }
        }
        next = result;
      } else {
        next = patchResult as S;
      }
      
      const processed = chain!.executeBefore(prev, next);
      
      const hash = originalApply.call(store, processed as Patch<S>);
      
      chain!.executeAfter(storeWithCurrent.current, hash);
      
      return hash;
    };
  }
  return chain;
}

export function useMiddleware<S>(
  store: Shoy<S>,
  middleware: Middleware<S>
): () => void {
  const chain = getOrCreateChain(store);
  return chain.add(middleware);
}

export function createLoggerMiddleware<S>(): Middleware<S> {
  return {
    before: (prev, next) => {
      console.log('[Shoy] State update:', {
        prev,
        next,
        diff: getDiff(prev, next),
      });
    },
    after: (state, hash) => {
      console.log('[Shoy] State committed:', { hash, state });
    },
  };
}

export function createValidatorMiddleware<S>(
  validator: (state: S) => boolean
): Middleware<S> {
  return {
    before: (prev, next) => {
      if (!validator(next as S)) {
        console.error('[Shoy] Validation failed:', next);
        return prev;
      }
    },
  };
}

function getDiff(prev: unknown, next: unknown): Record<string, unknown> {
  const diff: Record<string, unknown> = {};
  
  if (typeof prev !== 'object' || typeof next !== 'object' || prev === null || next === null) {
    if (prev !== next) diff[''] = { from: prev, to: next };
    return diff;
  }

  const prevObj = prev as Record<string, unknown>;
  const nextObj = next as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(prevObj), ...Object.keys(nextObj)]);

  for (const key of allKeys) {
    if (!(key in prevObj)) {
      diff[key] = { added: nextObj[key] };
    } else if (!(key in nextObj)) {
      diff[key] = { removed: prevObj[key] };
    } else if (JSON.stringify(prevObj[key]) !== JSON.stringify(nextObj[key])) {
      diff[key] = { from: prevObj[key], to: nextObj[key] };
    }
  }

  return diff;
}
