export type { Shoy, Hash, Patch } from '../index';

export interface DevToolsOptions {
  enabled?: boolean;
  maxSnapshots?: number;
}

export interface PersistenceOptions {
  key: string;
  storage?: Storage;
  throttle?: number;
  selective?: string[];
}

export interface Middleware<T> {
  before?: (prev: T, next: T) => T | void;
  after?: (state: T, hash: string) => void;
}

export interface SyncOptions {
  url: string;
  reconnectInterval?: number;
  conflictResolver?: ConflictResolver;
}

export type ConflictResolver = (local: unknown, remote: unknown) => unknown;
