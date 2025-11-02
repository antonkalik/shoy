# Shoy

<div style="text-align: center;">
    <img alt="Shoy Banner" src="docs/shoy-banner.png" />
</div>

<div style="text-align: center; width: 100%">

[![npm version](https://img.shields.io/npm/v/shoy.svg)](https://www.npmjs.com/package/shoy)
[![npm downloads](https://img.shields.io/npm/dm/shoy.svg)](https://www.npmjs.com/package/shoy)
[![bundle size](https://img.shields.io/badge/bundle%20size-1.3KB-brightgreen.svg)](https://bundlephobia.com/package/shoy)
[![coverage](https://img.shields.io/badge/coverage-97%25-brightgreen.svg)](https://github.com/antonkalik/shoy)
[![docs](https://img.shields.io/badge/docs-shoy.org-blue.svg)](https://shoy.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

</div>

> **⚠️ BETA WARNING**: This project is currently in **BETA** and is **NOT recommended for production use** until it reaches stable status. The API may change without notice.

State as Content-Addressed Versions. Stores are git-like repos where updates are content-addressed diffs using fast hashing. Components "checkout" commits via selectors. It's versioned, debuggable, and sync-friendly.

## Installation

```bash
pnpm add shoy
# or
yarn add shoy
# or
npm install shoy
```

**Requirements:**

⚛️ React >= 16.0.0 \
🟢 Node.js >= 18

## Basic Usage

### Creating a Store

```typescript
import { Shoy } from 'shoy';

interface AppState {
  count: number;
  user: {
    name: string;
    age: number;
  };
}

const initialState: AppState = {
  count: 0,
  user: {
    name: 'Alice',
    age: 30,
  },
};

const store = new Shoy<AppState>(initialState);
```

### Advanced Store Configuration

Configure the store with options for history management and error handling:

```typescript
const store = new Shoy(initialState, {
  maxHistory: 50,
  onError: (error, context) => {
    console.error(`Error in ${context}:`, error);
  },
});
```

**Options:**
- `maxHistory`: Maximum number of historical states to keep. Set to `0` (default) for no history, or any positive number to enable time-travel debugging.
- `onError`: Custom error handler callback that receives `(error: Error, context: string)`.

### React Integration

#### Reading State with `useGet`

Subscribe to specific parts of the state with different selector patterns:

```tsx
import { useGet, useApply } from 'shoy';

function Counter() {
  const state = useGet(store, (s) => s);
  const userName = useGet(store, (s) => s.user.name);
  const isAdult = useGet(store, (s) => s.user.age >= 18);
  const count = useGet(store, (s) => s.count);
  
  return <div>Count: {count}</div>;
}
```

#### Updating State with `useApply`

Get a stable callback function for state updates with various update patterns:

```tsx
function CounterControls() {
  const apply = useApply(store);
  
  const increment = () => {
    apply({ count: store.current.count + 1 });
  };
  
  const setUser = () => {
    apply({ user: { name: 'Bob', age: 25 } });
  };
  
  const incrementByTwo = () => {
    apply((prev) => ({
      count: prev.count + 2,
    }));
  };
  
  const reset = () => {
    apply({
      count: 0,
      user: { name: 'Alice', age: 30 },
    });
  };
  
  return (
    <div>
      <button onClick={increment}>Increment</button>
      <button onClick={setUser}>Set User</button>
      <button onClick={incrementByTwo}>+2</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}
```

## Advanced Features

### Undo/Redo (Time-Travel)

Navigate through state history when `maxHistory > 0`:

**Basic Undo/Redo:**

Make changes to the state, then use `undo()` to go back and `redo()` to jump forward:

```typescript
const store = new Shoy({ count: 0 }, { maxHistory: 20 });

store.apply({ count: 1 });
store.apply({ count: 2 });
store.apply({ count: 3 });
console.log(store.current);

store.undo();
console.log(store.current);

store.undo();
console.log(store.current);

store.redo();
console.log(store.current);

console.log(store.history);
```

**Full React Component with Undo/Redo Buttons:**

A complete component with undo/redo functionality. Users can click any hash button to jump directly to that state:

```tsx
import { useMemo } from 'react';
import { Shoy, useGet, useApply } from 'shoy';

function CounterWithUndoRedo() {
  const store = useMemo(() => new Shoy({ count: 0 }, { maxHistory: 10 }), []);
  const count = useGet(store, (s) => s.count);
  const apply = useApply(store);
  const history = useGet(store, () => store.history);
  
  const increment = () => apply({ count: count + 1 });
  
  const undo = () => store.undo();
  const redo = () => store.redo();
  
  const canUndo = history.indexOf(store.rootHash) > 0;
  const canRedo = history.indexOf(store.rootHash) < history.length - 1;
  
  return (
    <div>
      <h2>Count: {count}</h2>
      <p>Position: {history.indexOf(store.rootHash) + 1} of {history.length}</p>
      
      <button onClick={increment}>+</button>
      <button onClick={undo} disabled={!canUndo}>Undo</button>
      <button onClick={redo} disabled={!canRedo}>Redo</button>
      
      <div>
        {history.map((hash) => (
          <button
            key={hash}
            onClick={() => store.revert(hash)}
            style={{ fontWeight: hash === store.rootHash ? 'bold' : 'normal' }}
          >
            {hash.slice(0, 8)}
          </button>
        ))}
      </div>
    </div>
  );
}
```

### Manual State Access

Access and subscribe to state changes outside of React components:

```typescript
const currentState = store.current;

const unsubscribe = store.subscribe((hash) => {
  console.log('State changed, new hash:', hash);
});

unsubscribe();
```

### Manual State Updates

Update state programmatically without React:

```typescript
store.apply({ count: 42 });

store.apply((prev) => ({
  count: prev.count + 1,
  user: { ...prev.user, age: prev.user.age + 1 },
}));

const newHash = store.apply({ count: 100 });
console.log('New state hash:', newHash);
```

## API Reference

### React Hooks

#### `useGet<S, R>(store, selector)`

React hook that subscribes to state changes and returns the selected value.

```typescript
function useGet<S, R>(
  store: Shoy<S>,
  selector: (state: S) => R
): R
```

**Parameters:**
- `store` - The Shoy store instance
- `selector` - Function that selects a portion of the state

**Returns:** The selected value from state

**Example:**
```typescript
const count = useGet(store, (s) => s.count);
const userName = useGet(store, (s) => s.user.name);
```

---

#### `useApply<S>(store)`

React hook that returns a stable function to apply state patches.

```typescript
function useApply<S>(
  store: Shoy<S>
): (patch: Patch<S>) => Hash
```

**Parameters:**
- `store` - The Shoy store instance

**Returns:** A function that applies patches and returns the new hash

**Example:**
```typescript
const apply = useApply(store);
apply({ count: 10 });
apply((prev) => ({ count: prev.count + 1 }));
```

---

### Store Constructor

#### `new Shoy<S>(initialState, options?)`

Creates a new Shoy store instance.

```typescript
class Shoy<S> {
  constructor(
    initialState: S,
    options?: Options
  )
}
```

**Parameters:**
- `initialState` - The initial state value
- `options` - Optional configuration object
  - `maxHistory?: number` - Maximum history versions (default: `0`)
  - `onError?: (error: Error, context: string) => void` - Error handler callback

**Example:**
```typescript
const store = new Shoy({ count: 0 }, { maxHistory: 50 });
```

---

### Store Methods & Properties

#### `store.apply(patch)`

Applies a patch to the state and returns the new state hash.

```typescript
apply(patch: Patch<S>): Hash
```

**Parameters:**
- `patch` - Either a partial state object or a function `(prev: S) => Partial<S>`

**Returns:** The new state hash

**Example:**
```typescript
const hash = store.apply({ count: 42 });
store.apply((prev) => ({ count: prev.count + 1 }));
```

---

#### `store.current`

Synchronously returns the current state.

```typescript
get current(): S
```

**Example:**
```typescript
const currentState = store.current;
console.log(currentState.count);
```

---

#### `store.subscribe(callback)`

Subscribes to state changes and returns an unsubscribe function.

```typescript
subscribe(callback: (hash: Hash) => void): () => void
```

**Parameters:**
- `callback` - Function called when state changes, receives the new hash

**Returns:** Unsubscribe function

**Example:**
```typescript
const unsubscribe = store.subscribe((hash) => {
  console.log('State changed:', hash);
});
unsubscribe();
```

---

#### `store.history`

Returns an array of all available state hashes (only when `maxHistory > 0`).

```typescript
get history(): Hash[]
```

**Example:**
```typescript
const store = new Shoy(initialState, { maxHistory: 20 });
const hashes = store.history; // ['hash1', 'hash2', ...]
```

---

#### `store.revert(hash)`

Reverts the state to a previous version by hash.

```typescript
revert(hash: Hash): boolean
```

**Parameters:**
- `hash` - The hash of the state to revert to

**Returns:** `true` if successful, `false` otherwise

**Example:**
```typescript
const success = store.revert('abc123');
if (success) {
  console.log('Reverted successfully');
}
```

---

#### `store.undo()`

Undoes the last state change (goes back to previous state in history).

```typescript
undo(): boolean
```

**Returns:** `true` if undo was successful, `false` if at beginning of history or history disabled

**Example:**
```typescript
store.apply({ count: 1 });
store.apply({ count: 2 });
store.undo(); // count is now 1
```

---

#### `store.redo()`

Redoes a previously undone state change.

```typescript
redo(): boolean
```

**Returns:** `true` if redo was successful, `false` if at end of history or history forked

**Example:**
```typescript
store.undo(); // go back
store.redo(); // go forward again
```

**Note:** Redo only works if history hasn't been forked (no new changes after undo).

---

## Performance

Shoy store is optimized for performance:

- **~0.001ms update speed** (synchronous hashing)
- **Only 10 re-renders** (5 stores, 50 components)
- **Low memory overhead** (fast hashes + deduplication)
- **Best for versioned diffs** and primitives
- **Scalable** and efficient

Patches support both replacement and deep merging; selectors skip unchanged diffs, making it ideal for multi-store needs without the overhead of proxies, atoms, machines, or full-tree diffing.

### Advantages

**Unique Features:**
- **Content-addressed hashing** - Deterministic state IDs for deduplication
- **Automatic deduplication** - Identical states share memory
- **Built-in time-travel** - Replay, undo/redo, debugging
- **Git-like versioning** - See full state history
- **Zero-config setup** - Works out of the box
- **Micro-bundle** - Smallest React state library

**Best For:**
- **Undo/redo functionality** - Built-in time-travel debugging
- **State debugging** - Automatic version history
- **Optimistic UI updates** - Hash-based deduplication
- Collaborative editing / CRDTs - **Foundation provided** (you add transport layer)
- State synchronization - **Foundation provided** (you add network layer)
- Audit trails / compliance - **Foundation provided** (you add persistence)
- Offline-first apps - **Foundation provided** (you add storage layer)

## How It Works

Shoy uses **content-addressed versioning** inspired by Git:

- Every state change computes a **deterministic hash** of the entire state
- Hashes serve as unique identifiers (like Git commits)
- Identical states produce identical hashes (automatic deduplication)
- Enables time-travel debugging when `maxHistory > 0`
- Perfect for state synchronization between devices/apps

The hash algorithm is fast (DJB2-based) and deterministic, making it perfect for deduplication, debugging, and sync scenarios without cryptographic security requirements.

### What Shoy Provides vs What You Build

**✅ Built-In (Out of the Box):**

Undo/Redo, Deterministic Hashing, Auto Deduplication, and Version History:

```typescript
const store = new Shoy({ count: 0 }, { maxHistory: 10 });

store.apply({ count: 1 });
store.apply({ count: 2 });
store.undo();

const storeA = new Shoy({ a: 1, b: 2 });
const storeB = new Shoy({ b: 2, a: 1 });
console.log(storeA.rootHash === storeB.rootHash);

const h1 = store.apply({ count: 100 });
const h2 = store.apply({ count: 100 });
console.log(h1 === h2);

console.log(store.history);
```

**⚠️ Foundation Provided (You Add the Layer):**

Not included: WebSocket/HTTP transport, conflict resolution, network retry logic, data persistence, and multi-device sync. Example of building sync on top of Shoy:

```typescript
function setupSync(store) {
  const socket = new WebSocket('ws://sync-server');
  
  socket.onmessage = (event) => {
    const { hash, state } = JSON.parse(event.data);
    if (!store.versions.has(hash)) {
      store.versions.set(hash, state);
    }
  };
  
  store.subscribe((hash) => {
    const state = store.current;
    socket.send(JSON.stringify({ hash, state }));
  });
}
```

**Key Point:** Shoy gives you Git-like content-addressed storage. You build the transport layer.

## TypeScript Support

Shoy is fully written in TypeScript and provides complete type inference:

```typescript
interface MyState {
  items: string[];
  filter: string;
}

const store = new Shoy<MyState>({ items: [], filter: '' });

const filter = useGet(store, s => s.filter);
const apply = useApply(store);
```

## Contributing

Contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

When contributing, remember:
- Use `pnpm commit` instead of `git commit` (Conventional Commits required)
- All PRs to `main` must be approved
- Follow the branch naming convention: `feat/`, `fix/`, `docs/`, etc.

## License

MIT

## Author

**Anton Kalik**
- Email: antonkalik@gmail.com
- Website: https://idedy.com
