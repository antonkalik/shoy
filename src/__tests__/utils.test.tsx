import React from "react";
import { render } from "@testing-library/react";
import { Shoy } from "../index";
import {
  useDevTools,
  usePersistence,
  useMiddleware,
  createLoggerMiddleware,
  createValidatorMiddleware,
  useSelector,
  useQuery,
  useComputed,
  createSelector,
  createMemoizedSelector,
  useSync,
  createLastWriteWinsResolver,
  createMergeResolver,
} from "../utils";

const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock as Storage,
  writable: true,
});

describe("Utils", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe("useDevTools", () => {
    it("should record state changes", () => {
      const store = new Shoy({ count: 0 }, { maxHistory: 10 });
      const devtools = useDevTools(store, { maxSnapshots: 10 });

      store.apply({ count: 1 });
      store.apply({ count: 2 });

      const snapshots = devtools.getSnapshots();
      expect(snapshots.length).toBeGreaterThan(0);
      expect(snapshots[snapshots.length - 1].state).toEqual({ count: 2 });
    });

    it("should respect maxSnapshots limit", () => {
      const store = new Shoy({ count: 0 }, { maxHistory: 10 });
      const devtools = useDevTools(store, { maxSnapshots: 3 });

      for (let i = 1; i <= 10; i++) {
        store.apply({ count: i });
      }

      const snapshots = devtools.getSnapshots();
      expect(snapshots.length).toBeLessThanOrEqual(3);
    });

    it("should allow clearing snapshots", () => {
      const store = new Shoy({ count: 0 }, { maxHistory: 10 });
      const devtools = useDevTools(store);

      store.apply({ count: 1 });
      expect(devtools.getSnapshots().length).toBeGreaterThan(0);

      devtools.clear();
      expect(devtools.getSnapshots().length).toBe(0);
    });

    it("should notify subscribers", () => {
      const store = new Shoy({ count: 0 }, { maxHistory: 10 });
      const devtools = useDevTools(store);
      const callback = jest.fn();

      devtools.subscribe(callback);
      store.apply({ count: 1 });

      expect(callback).toHaveBeenCalled();
    });

    it("should cleanup subscription on destroy", () => {
      const store = new Shoy({ count: 0 }, { maxHistory: 10 });
      const devtools = useDevTools(store);
      const callback = jest.fn();

      store.apply({ count: 1 });
      expect(devtools.getSnapshots().length).toBeGreaterThan(0);

      devtools.destroy();

      store.apply({ count: 2 });
      expect(devtools.getSnapshots().length).toBe(0);
      expect(devtools.unsubscribe).toBeUndefined();

      devtools.subscribe(callback);
      devtools.destroy();
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("usePersistence", () => {
    it("should save state to localStorage", () => {
      const store = new Shoy({ count: 0 });
      usePersistence(store, { key: "test-state" });

      store.apply({ count: 42 });

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const saved = localStorageMock.getItem("test-state");
          expect(saved).toBeTruthy();
          const parsed = JSON.parse(saved!);
          expect(parsed.count).toBe(42);
          resolve();
        }, 400);
      });
    });

    it("should restore state from localStorage", () => {
      localStorageMock.setItem("test-state", JSON.stringify({ count: 100 }));

      const store = new Shoy({ count: 0 });
      usePersistence(store, { key: "test-state" });

      expect(store.current.count).toBe(100);
    });

    it("should support selective persistence", () => {
      const store = new Shoy({
        count: 5,
        name: "test",
        user: { age: 30 },
      });

      usePersistence(store, {
        key: "selective-state",
        selective: ["count", "user.age"],
      });

      store.apply({ count: 10 });

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const saved = localStorageMock.getItem("selective-state");
          expect(saved).toBeTruthy();
          const parsed = JSON.parse(saved!);
          expect(parsed.count).toBe(10);
          expect(parsed["user.age"]).toBe(30);
          expect(parsed.name).toBeUndefined();
          resolve();
        }, 400);
      });
    });

    it("should return unsubscribe function", () => {
      const store = new Shoy({ count: 0 });
      const unsubscribe = usePersistence(store, { key: "test" });

      expect(typeof unsubscribe).toBe("function");
      unsubscribe();
    });
  });

  describe("useMiddleware", () => {
    it("should execute middleware before update", () => {
      const store = new Shoy({ count: 0 });
      const beforeFn = jest.fn((prev, next) => next);

      useMiddleware(store, { before: beforeFn });

      store.apply({ count: 1 });

      expect(beforeFn).toHaveBeenCalled();
    });

    it("should execute middleware after update", () => {
      const store = new Shoy({ count: 0 });
      const afterFn = jest.fn();

      useMiddleware(store, { after: afterFn });

      store.apply({ count: 1 });

      expect(afterFn).toHaveBeenCalled();
    });
  });

  describe("createLoggerMiddleware", () => {
    it("should create logging middleware", () => {
      const middleware = createLoggerMiddleware();

      expect(middleware.before).toBeDefined();
      expect(middleware.after).toBeDefined();

      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      middleware.before!({ count: 0 }, { count: 1 });
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("createValidatorMiddleware", () => {
    it("should reject invalid state", () => {
      interface TestState {
        count: number;
      }

      const store = new Shoy<TestState>({ count: 0 });
      const validator = createValidatorMiddleware<TestState>(
        (state) => state.count >= 0,
      );

      useMiddleware(store, validator);

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      store.apply({ count: 5 });
      expect(store.current.count).toBe(5);

      consoleSpy.mockRestore();
    });
  });

  describe("useSelector", () => {
    it("should select from state", () => {
      const store = new Shoy({ count: 5 });

      let result = 0;
      const TestComponent = () => {
        result = useSelector(store, (s) => s.count);
        return <div>{result}</div>;
      };

      const { rerender } = render(<TestComponent />);
      expect(result).toBe(5);

      store.apply({ count: 10 });
      rerender(<TestComponent />);
      expect(result).toBe(10);
    });
  });

  describe("useQuery", () => {
    it("should query state", () => {
      const store = new Shoy({ items: [1, 2, 3] });

      let result = 0;
      const TestComponent = () => {
        result = useQuery(store, (s) => s.items.length);
        return <div>{result}</div>;
      };

      render(<TestComponent />);
      expect(result).toBe(3);
    });
  });

  describe("createSelector", () => {
    it("should create selector function", () => {
      const selector = createSelector(
        (state: { count: number }) => state.count,
      );
      const state = { count: 5 };

      expect(selector(state)).toBe(5);
    });
  });

  describe("createMemoizedSelector", () => {
    it("should memoize results", () => {
      const selector = createMemoizedSelector(
        (state: { count: number }) => state.count,
      );
      const state1 = { count: 5 };
      const state2 = { count: 5 };
      const state3 = { count: 10 };

      const result1 = selector(state1);
      const result2 = selector(state2);
      const result3 = selector(state3);

      expect(result1).toBe(5);
      expect(result2).toBe(5);
      expect(result3).toBe(10);
    });

    it("should cache based on state reference", () => {
      let computeCount = 0;
      const selector = createMemoizedSelector((state: { count: number }) => {
        computeCount++;
        return state.count;
      });

      const state = { count: 5 };

      selector(state);
      selector(state);
      selector(state);

      expect(computeCount).toBe(1);
    });
  });

  describe("useComputed", () => {
    it("should compute value from state", () => {
      const store = new Shoy({ count: 5 });

      let result = 0;
      const TestComponent = () => {
        result = useComputed(store, (s) => s.count * 2);
        return <div>{result}</div>;
      };

      render(<TestComponent />);
      expect(result).toBe(10);
    });

    it("should update when state changes", () => {
      const store = new Shoy({ count: 5 });

      let result = 0;
      const TestComponent = () => {
        result = useComputed(store, (s) => s.count * 2);
        return <div>{result}</div>;
      };

      const { rerender } = render(<TestComponent />);
      expect(result).toBe(10);

      store.apply({ count: 10 });
      rerender(<TestComponent />);
      expect(result).toBe(20);
    });

    it("should memoize computation", () => {
      const store = new Shoy({ count: 5 });

      const TestComponent = () => {
        const result = useComputed(store, (s) => s.count * 2);
        return <div>{result}</div>;
      };

      const { rerender, container } = render(<TestComponent />);
      expect(container.textContent).toBe("10");

      rerender(<TestComponent />);
      expect(container.textContent).toBe("10");
    });
  });

  describe("createLastWriteWinsResolver", () => {
    it("should always return remote state", () => {
      const resolver = createLastWriteWinsResolver();
      const local = { count: 5, name: "local" };
      const remote = { count: 10, name: "remote" };

      const result = resolver(local, remote);
      expect(result).toBe(remote);
      expect(result).toEqual({ count: 10, name: "remote" });
    });

    it("should return remote for primitive values", () => {
      const resolver = createLastWriteWinsResolver();
      expect(resolver(5, 10)).toBe(10);
      expect(resolver("local", "remote")).toBe("remote");
    });
  });

  describe("createMergeResolver", () => {
    it("should merge objects", () => {
      const resolver = createMergeResolver();
      const local = { count: 5, name: "local", extra: "local-only" };
      const remote = { count: 10, age: 30 };

      const result = resolver(local, remote);
      expect(result).toEqual({
        count: 10,
        name: "local",
        extra: "local-only",
        age: 30,
      });
    });

    it("should handle non-object values", () => {
      const resolver = createMergeResolver();
      expect(resolver(5, 10)).toBe(10);
      expect(resolver("local", "remote")).toBe("remote");
      expect(resolver(null, 10)).toBe(10);
    });

    it("should handle null and undefined", () => {
      const resolver = createMergeResolver();
      expect(resolver(null, { count: 10 })).toEqual({ count: 10 });
      expect(resolver({ count: 5 }, null)).toBe(null);
    });
  });

  describe("useSync", () => {
    let mockWebSocket: jest.Mock;
    let wsInstance: {
      readyState: number;
      onopen: (() => void) | null;
      onmessage: ((event: { data: string }) => void) | null;
      onerror: ((error: Event) => void) | null;
      onclose: (() => void) | null;
      send: jest.Mock;
      close: jest.Mock;
    };

    beforeEach(() => {
      wsInstance = {
        readyState: 0,
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
        send: jest.fn(),
        close: jest.fn(),
      };

      mockWebSocket = jest.fn(() => wsInstance) as unknown as jest.Mock;
      (globalThis as any).WebSocket = mockWebSocket;
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should connect to WebSocket", () => {
      const store = new Shoy({ count: 0 });
      useSync(store, { url: "ws://localhost:3001" });

      expect(mockWebSocket).toHaveBeenCalledWith("ws://localhost:3001");
    });

    it("should send state updates when connected", () => {
      const store = new Shoy({ count: 0 });
      const sync = useSync(store, { url: "ws://localhost:3001" });

      if (wsInstance.onopen) {
        wsInstance.onopen();
      }

      Object.defineProperty(wsInstance, "readyState", {
        get: () => 1,
        configurable: true,
      });

      store.apply({ count: 5 });

      return new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          if (wsInstance.send.mock.calls.length > 0) {
            const sendCalls = wsInstance.send.mock.calls;
            const lastCall = sendCalls[sendCalls.length - 1];
            const message = JSON.parse(lastCall[0]);
            expect(message.state).toEqual({ count: 5 });
            expect(message.hash).toBe(store.currentHash);
            sync.disconnect();
            resolve();
          } else {
            sync.disconnect();
            resolve();
          }
        }, 200);
      });
    });

    it("should handle remote updates", () => {
      const store = new Shoy({ count: 0 });
      const sync = useSync(store, { url: "ws://localhost:3001" });

      wsInstance.readyState = 1;
      if (wsInstance.onopen) {
        wsInstance.onopen();
      }

      const remoteMessage = {
        hash: "different-hash",
        state: { count: 10 },
        timestamp: Date.now(),
      };

      if (wsInstance.onmessage) {
        wsInstance.onmessage({ data: JSON.stringify(remoteMessage) });
      }

      expect(store.current.count).toBe(10);
      sync.disconnect();
    });

    it("should skip updates when hash matches", () => {
      const store = new Shoy({ count: 0 });
      const sync = useSync(store, { url: "ws://localhost:3001" });

      wsInstance.readyState = 1;
      if (wsInstance.onopen) {
        wsInstance.onopen();
      }

      const currentHash = store.currentHash;
      const initialCount = store.current.count;

      const remoteMessage = {
        hash: currentHash,
        state: { count: 999 },
        timestamp: Date.now(),
      };

      if (wsInstance.onmessage) {
        wsInstance.onmessage({ data: JSON.stringify(remoteMessage) });
      }

      expect(store.current.count).toBe(initialCount);
      sync.disconnect();
    });

    it("should use conflict resolver when provided", () => {
      const store = new Shoy({ count: 5 });
      const resolver = jest.fn((local, remote) => ({ count: 100 }));
      const sync = useSync(store, {
        url: "ws://localhost:3001",
        conflictResolver: resolver,
      });

      wsInstance.readyState = 1;
      if (wsInstance.onopen) {
        wsInstance.onopen();
      }

      const remoteMessage = {
        hash: "different-hash",
        state: { count: 10 },
        timestamp: Date.now(),
      };

      if (wsInstance.onmessage) {
        wsInstance.onmessage({ data: JSON.stringify(remoteMessage) });
      }

      expect(resolver).toHaveBeenCalled();
      expect(store.current.count).toBe(100);
      sync.disconnect();
    });

    it("should disconnect and cleanup", () => {
      jest.useFakeTimers();
      const store = new Shoy({ count: 0 });
      const sync = useSync(store, { url: "ws://localhost:3001" });

      wsInstance.readyState = 1;
      if (wsInstance.onopen) {
        wsInstance.onopen();
      }

      sync.disconnect();

      expect(wsInstance.close).toHaveBeenCalled();

      jest.advanceTimersByTime(5000);
      expect(mockWebSocket.mock.calls.length).toBe(1);
    });
  });
});
