import type { Shoy, Hash, Patch } from '../index';
import type { SyncOptions, ConflictResolver } from './types';

interface SyncMessage {
  hash: Hash;
  state: unknown;
  timestamp: number;
}

class SyncManager<S> {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private store: Shoy<S>;
  private options: Required<Pick<SyncOptions, 'reconnectInterval'>> & SyncOptions;
  private unsubscribe: (() => void) | null = null;

  constructor(store: Shoy<S>, options: SyncOptions) {
    this.store = store;
    this.options = {
      reconnectInterval: 3000,
      ...options,
    };
  }

  connect(): void {
    try {
      this.socket = new WebSocket(this.options.url);
      
      this.socket.onopen = () => {
        console.log('[Shoy Sync] Connected');
        this.startListening();
      };

      this.socket.onmessage = (event) => {
        try {
          const message: SyncMessage = JSON.parse(event.data);
          this.handleRemoteUpdate(message);
        } catch (error) {
          console.error('[Shoy Sync] Failed to parse message:', error);
        }
      };

      this.socket.onerror = (error) => {
        console.error('[Shoy Sync] Error:', error);
      };

      this.socket.onclose = () => {
        console.log('[Shoy Sync] Disconnected, reconnecting...');
        this.reconnect();
      };
    } catch (error) {
      console.error('[Shoy Sync] Failed to connect:', error);
      this.reconnect();
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private startListening(): void {
    this.unsubscribe = this.store.subscribe((hash) => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        const message: SyncMessage = {
          hash: this.store.currentHash,
          state: this.store.current,
          timestamp: Date.now(),
        };
        this.socket.send(JSON.stringify(message));
      }
    });
  }

  private handleRemoteUpdate(message: SyncMessage): void {
    const localHash = this.store.currentHash;
    
    if (localHash === message.hash) {
      return;
    }

    if (this.options.conflictResolver) {
      const resolved = this.options.conflictResolver(
        this.store.current,
        message.state
      );
      this.store.apply(resolved as Patch<S>);
    } else {
      this.store.apply(message.state as Patch<S>);
    }
  }

  private reconnect(): void {
    if (this.reconnectTimer) return;
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.options.reconnectInterval);
  }
}

export function useSync<S>(store: Shoy<S>, options: SyncOptions): SyncManager<S> {
  const manager = new SyncManager(store, options);
  manager.connect();
  return manager;
}

export function createLastWriteWinsResolver(): ConflictResolver {
  return (local, remote) => remote;
}

export function createMergeResolver(): ConflictResolver {
  return (local, remote) => {
    if (typeof local === 'object' && typeof remote === 'object' && local !== null && remote !== null) {
      return { ...local as object, ...remote as object };
    }
    return remote;
  };
}
