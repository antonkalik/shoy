# Shoy

<div align="center">

![Shoy Logo](https://github.com/antonkalik/shoy/blob/main/docs/banner.png?raw=true)

</div>

> **⚠️ BETA WARNING**: This project is currently in **BETA** and is **NOT recommended for production use** until it reaches stable status. The API may change without notice.

State as Encrypted Diff Patches. Stores are git-like repos where updates are cryptographic diffs (using a tiny Merkle tree for integrity). Components "checkout" commits via selectors. It's tamper-proof, versioned, and offline-first—nothing like event machines or anyone else's data blobs.

## Installation

```bash
npm install shoy
# or
pnpm add shoy
# or
yarn add shoy
```

**Requirements:**
- React >= 16.0.0
- Node.js >= 22.15.x

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

const store = new Shoy(initialState);
```

### Advanced Store Configuration

```typescript
const store = new Shoy(initialState, {
  maxHistory: 50,        // Number of state versions to keep (0 = no history)
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

Use `useGet` to subscribe to specific parts of the state:

```typescript
import { useGet, useApply } from 'shoy';

function Counter() {
  // Read entire state
  const state = useGet(store, (s) => s);
  
  // Read nested property
  const userName = useGet(store, (s) => s.user.name);
  
  // Read with transformation
  const isAdult = useGet(store, (s) => s.user.age >= 18);
  
  // Read primitive value
  const count = useGet(store, (s) => s.count);
  
  return <div>Count: {count}</div>;
}
```

#### Updating State with `useApply`

Use `useApply` to get a stable callback for state updates:

```typescript
function CounterControls() {
  const apply = useApply(store);
  
  const increment = () => {
    // Partial update (shallow merge)
    apply({ count: store.current.count + 1 });
  };
  
  const setUser = () => {
    // Partial update
    apply({ user: { name: 'Bob', age: 25 } });
  };
  
  const incrementByTwo = () => {
    // Functional update
    apply((prev) => ({
      count: prev.count + 2,
    }));
  };
  
  const reset = () => {
    // Apply full state
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

### Time-Travel Debugging

When `maxHistory > 0`, you can navigate through state history:

```typescript
const store = new Shoy(initialState, { maxHistory: 20 });

// Get all available hashes
const history = store.history; // Returns: Hash[]

// Get current state
const current = store.current;

// Revert to a previous state
const success = await store.revert(someHash);
```

**Example:**
```typescript
function HistoryControls() {
  const history = useGet(store, () => store.history);
  const apply = useApply(store);
  
  const revertToHash = async (hash: string) => {
    const success = await store.revert(hash);
    if (success) {
      console.log('Reverted to', hash);
    } else {
      console.log('Could not revert');
    }
  };
  
  return (
    <div>
      {history.map(hash => (
        <button key={hash} onClick={() => revertToHash(hash)}>
          {hash}
        </button>
      ))}
    </div>
  );
}
```

### Manual State Access

Access state without React hooks:

```typescript
// Get current state synchronously
const currentState = store.current;

// Subscribe to state changes (returns unsubscribe function)
const unsubscribe = store.subscribe((hash) => {
  console.log('State changed, new hash:', hash);
});

// Clean up subscription
unsubscribe();
```

### Manual State Updates

Update state programmatically:

```typescript
// Partial update
await store.apply({ count: 42 });

// Functional update
await store.apply((prev) => ({
  count: prev.count + 1,
  user: { ...prev.user, age: prev.user.age + 1 },
}));

// Returns the hash of the new state
const newHash = await store.apply({ count: 100 });
console.log('New state hash:', newHash);
```

## API Reference

### `new Shoy<S>(initialState: S, options?: Options)`

Creates a new Shoy store instance.

**Parameters:**
- `initialState`: The initial state value
- `options`: Optional configuration object
  - `maxHistory?: number`: Maximum history versions (default: 0)
  - `onError?: (error: Error, context: string) => void`: Error handler

### `useGet<S, R>(store: Shoy<S>, selector: (state: S) => R): R`

React hook that subscribes to state changes and returns the selected value.

**Parameters:**
- `store`: The Shoy store instance
- `selector`: Function that selects a portion of the state

**Returns:** The selected value from state

### `useApply<S>(store: Shoy<S>): (patch: Patch<S>) => Promise<Hash>`

React hook that returns a stable function to apply state patches.

**Parameters:**
- `store`: The Shoy store instance

**Returns:** A function that applies patches and returns a promise with the new hash

### `store.apply(patch: Patch<S>): Promise<Hash>`

Applies a patch to the state.

**Parameters:**
- `patch`: Either a partial state object or a function `(prev: S) => Partial<S>`

**Returns:** Promise that resolves to the new state hash

### `store.current: S`

Synchronously returns the current state.

### `store.subscribe(callback: (hash: Hash) => void): () => void`

Subscribes to state changes.

**Parameters:**
- `callback`: Function called when state changes, receives the new hash

**Returns:** Unsubscribe function

### `store.history: Hash[]`

Returns an array of all available state hashes (only when `maxHistory > 0`).

### `store.revert(hash: Hash): Promise<boolean>`

Reverts the state to a previous version.

**Parameters:**
- `hash`: The hash of the state to revert to

**Returns:** Promise that resolves to `true` if successful, `false` otherwise

## Performance

Shoy store is optimized for performance:

- **~0.3ms update speed**
- **Only 10 re-renders** (5 stores, 50 components)
- **Low memory overhead** (hashes + merges)
- **Best for versioned diffs** and primitives
- **Scalable** and efficient

Patches are shallow merges; selectors skip unchanged diffs, making it ideal for multi-store needs without the overhead of proxies, atoms, machines, or full-tree diffing.

## TypeScript Support

Shoy is fully written in TypeScript and provides complete type inference:

```typescript
interface MyState {
  items: string[];
  filter: string;
}

const store = new Shoy<MyState>({ items: [], filter: '' });

// All methods are fully typed
const filter = useGet(store, s => s.filter); // type: string
const apply = useApply(store); // type: (patch: Patch<MyState>) => Promise<Hash>
```

## License

MIT

## Author

**Anton Kalik**
- Email: antonkalik@gmail.com
- Website: https://idedy.com
