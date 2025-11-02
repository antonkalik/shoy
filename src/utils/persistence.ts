import type { Shoy, Patch } from '../index';
import type { PersistenceOptions } from './types';

export function usePersistence<S>(
  store: Shoy<S>,
  options: PersistenceOptions
): () => void {
  const { key, storage = localStorage, throttle = 300 } = options;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const save = () => {
    try {
      const state = store.current;
      if (options.selective) {
        const filtered: Record<string, unknown> = {};
        for (const path of options.selective) {
          const keys = path.split('.');
          let value: unknown = state;
          for (const k of keys) {
            if (typeof value === 'object' && value !== null && k in value) {
              value = (value as Record<string, unknown>)[k];
            } else {
              value = undefined;
              break;
            }
          }
          filtered[path] = value;
        }
        storage.setItem(key, JSON.stringify(filtered));
      } else {
        storage.setItem(key, JSON.stringify(state));
      }
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  };

  const throttledSave = () => {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      save();
      saveTimer = null;
    }, throttle);
  };

  const unsubscribe = store.subscribe(() => {
    throttledSave();
  });

  const restore = () => {
    try {
      const saved = storage.getItem(key);
      if (saved) {
        const state = JSON.parse(saved) as Patch<S>;
        store.apply(state);
      }
    } catch (error) {
      console.error('Failed to restore state:', error);
    }
  };

  restore();

  return unsubscribe;
}

export function clearPersistence(key: string, storage: Storage = localStorage): void {
  try {
    storage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear persistence:', error);
  }
}
