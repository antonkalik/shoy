# Shoy Utils

Utility functions and helpers for Shoy state management.

## Installation

```bash
import { useDevTools, usePersistence, useGet } from 'shoy/utils';
```

## Available Utils

### DevTools

**Why use it:** Track and inspect state changes over time for debugging. DevTools automatically records snapshots of your state, making it easy to see how your application state evolves and debug unexpected behavior.

**When to use:** 
- Debugging complex state transitions
- Building time-travel debugging features
- Inspecting state history in development
- Analyzing state change patterns

Initialize devtools with a maximum number of snapshots. The returned object provides methods to retrieve all snapshots and clear the history.

```typescript
import { useDevTools } from 'shoy/utils';

const devtools = useDevTools(store, { maxSnapshots: 50 });
devtools.getSnapshots();
devtools.clear();
```

### Persistence

**Why use it:** Automatically save and restore your application state from browser storage, ensuring users don't lose their data when refreshing the page or closing the browser.

**When to use:**
- Persisting user preferences and settings
- Saving form data automatically
- Implementing offline-first applications
- Maintaining application state across sessions
- Storing only specific parts of state for performance

Automatically saves state changes to localStorage or sessionStorage with throttling to prevent excessive writes. On initialization, it restores the saved state.

```typescript
import { usePersistence, clearPersistence } from 'shoy/utils';

usePersistence(store, { 
  key: 'my-app-state',
  throttle: 300,
  storage: localStorage 
});

clearPersistence('my-app-state');
```

### Middleware

**Why use it:** Intercept and transform state updates before they're applied, or perform side effects after updates. This enables powerful patterns like validation, logging, analytics, and state transformation.

**When to use:**
- Logging state changes for debugging
- Validating state before committing changes
- Tracking analytics events on state updates
- Transforming or sanitizing incoming state
- Enforcing business rules and constraints

Apply middleware to intercept state updates. Use `createLoggerMiddleware` for automatic logging or `createValidatorMiddleware` to validate state before updates are applied.

```typescript
import { useMiddleware, createLoggerMiddleware, createValidatorMiddleware } from 'shoy/utils';

useMiddleware(store, createLoggerMiddleware());
useMiddleware(store, createValidatorMiddleware(state => state.count >= 0));
```

### Sync

**Why use it:** Synchronize state across multiple clients in real-time using WebSocket connections. Enables collaborative features where multiple users can interact with shared state simultaneously.

**When to use:**
- Real-time collaborative applications
- Multi-user dashboards and tools
- Shared state across browser tabs/devices
- Distributed systems requiring state synchronization
- Building multiplayer features

Set up WebSocket synchronization with a remote server. The sync instance automatically handles reconnection and conflict resolution. Can be disconnected later for cleanup.

Use `createMergeResolver` to merge local and remote state, or `createLastWriteWinsResolver` to always use the remote state in conflicts.

```typescript
import { useSync, createMergeResolver, createLastWriteWinsResolver } from 'shoy/utils';

const sync = useSync(store, {
  url: 'ws://localhost:3001',
  conflictResolver: createMergeResolver()
});

const syncWithLastWriteWins = useSync(store, {
  url: 'ws://localhost:3001',
  conflictResolver: createLastWriteWinsResolver()
});

sync.disconnect();
```

### Query

**Why use it:** Selectively subscribe to specific parts of your state and compute derived values. Optimizes re-renders by only updating when the selected portion of state changes, and provides memoization for expensive computations.

**When to use:**
- Accessing only specific fields from large state objects
- Computing derived values from state
- Preventing unnecessary re-renders
- Creating reusable selectors across components
- Memoizing expensive computations

Use React hooks to subscribe to state selections. `useSelector` and `useQuery` are reactive hooks that update when the selected value changes. `useComputed` provides memoized computed values that only recalculate when dependencies change. `createSelector` creates reusable selector functions, and `createMemoizedSelector` helps optimize expensive selector functions with caching.

```typescript
import { useSelector, useQuery, useComputed, createSelector, createMemoizedSelector } from 'shoy/utils';

const count = useSelector(store, s => s.count);
const total = useQuery(store, s => s.items.length);
const doubled = useComputed(store, s => s.count * 2);
const selector = createSelector(state => state.user.name);
const memoized = createMemoizedSelector(state => state.user.name);
```

## Documentation

Full documentation at [shoy.org/utils](https://shoy.org/utils)
