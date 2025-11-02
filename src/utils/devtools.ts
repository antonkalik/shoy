import type { Shoy, Hash } from '../index';
import type { DevToolsOptions } from './types';

interface Snapshot {
  hash: Hash;
  timestamp: number;
  state: unknown;
  action?: string;
}

class DevTools {
  private snapshots: Snapshot[] = [];
  private maxSnapshots: number;
  private listeners = new Set<(snapshots: Snapshot[]) => void>();

  constructor(options: DevToolsOptions = {}) {
    this.maxSnapshots = options.maxSnapshots ?? 100;
  }

  record(hash: Hash, state: unknown, action?: string): void {
    const snapshot: Snapshot = {
      hash,
      timestamp: Date.now(),
      state: this.deepClone(state),
      action,
    };

    this.snapshots.push(snapshot);
    
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    this.notify();
  }

  getSnapshots(): Snapshot[] {
    return this.snapshots;
  }

  subscribe(callback: (snapshots: Snapshot[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  clear(): void {
    this.snapshots = [];
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach(cb => cb(this.snapshots));
  }

  private deepClone(obj: unknown): unknown {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map(item => this.deepClone(item));
    
    const cloned: Record<string, unknown> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = this.deepClone((obj as Record<string, unknown>)[key]);
      }
    }
    return cloned;
  }
}

export function useDevTools<S>(store: Shoy<S>, options: DevToolsOptions = {}): DevTools {
  const devtools = new DevTools(options);

  store.subscribe((hash) => {
    devtools.record(hash, store.current);
  });

  return devtools;
}
