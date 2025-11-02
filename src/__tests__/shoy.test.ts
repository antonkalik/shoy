import { Shoy } from "../index";

describe("Shoy", () => {
  describe("constructor", () => {
    it("should create a store with initial state", () => {
      const store = new Shoy({ count: 0 });
      expect(store.current).toEqual({ count: 0 });
    });

    it("should create a store with primitive initial state", () => {
      const store = new Shoy(42);
      expect(store.current).toBe(42);
    });

    it("should create a store with array initial state", () => {
      const store = new Shoy([1, 2, 3]);
      expect(store.current).toEqual([1, 2, 3]);
    });

    it("should accept options with maxHistory", () => {
      const store = new Shoy({ count: 0 }, { maxHistory: 10 });
      expect(store.history.length).toBe(1);
    });

    it("should accept custom error handler", () => {
      const onError = jest.fn();
      const store = new Shoy({ count: 0 }, { onError });
      expect(onError).not.toHaveBeenCalled();
    });

    it("should throw error with circular reference in initial state", () => {
      const circular: any = { name: "test" };
      circular.self = circular;

      expect(() => {
        new Shoy(circular);
      }).toThrow("Circular reference detected in state object");
    });
  });

  describe("current", () => {
    it("should return current state", () => {
      const store = new Shoy({ name: "Alice", age: 30 });
      expect(store.current).toEqual({ name: "Alice", age: 30 });
    });

    it("should return primitive current state", () => {
      const store = new Shoy(100);
      expect(store.current).toBe(100);
    });
  });

  describe("apply", () => {
    it("should apply partial update", () => {
      const store = new Shoy({ count: 0, name: "Alice" });
      store.apply({ count: 10, name: "Alice" });
      expect(store.current).toEqual({ count: 10, name: "Alice" });
    });

    it("should apply functional update", () => {
      const store = new Shoy({ count: 0 });
      store.apply((prev) => ({ count: prev.count + 1 }));
      expect(store.current.count).toBe(1);
    });

    it("should return hash after applying update", () => {
      const store = new Shoy({ count: 0 });
      const hash = store.apply({ count: 1 });
      expect(typeof hash).toBe("string");
      expect(hash.length).toBeGreaterThan(0);
    });

    it("should return same hash if state unchanged", () => {
      const store = new Shoy({ count: 0 });
      const hash1 = store.apply({ count: 1 });
      const hash2 = store.apply({ count: 1 });
      expect(hash1).toBe(hash2);
    });

    it("should handle nested object updates", () => {
      const store = new Shoy({ user: { name: "Alice", age: 30 } });
      store.apply({ user: { name: "Bob", age: 30 } });
      expect(store.current.user.name).toBe("Bob");
    });

    it("should handle array updates", () => {
      const store = new Shoy({ items: [1, 2, 3] });
      store.apply({ items: [1, 2, 3, 4] });
      expect(store.current.items).toEqual([1, 2, 3, 4]);
    });

    it("should throw error with circular reference", () => {
      const store = new Shoy({ name: "test" });
      const circular: any = { name: "new" };
      circular.self = circular;

      expect(() => store.apply(circular)).toThrow(/Maximum call stack size exceeded/);
    });
  });

  describe("subscribe", () => {
    it("should notify subscribers on state change", () => {
      const store = new Shoy({ count: 0 });
      const callback = jest.fn();

      store.subscribe(callback);
      store.apply({ count: 1 });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(typeof callback.mock.calls[0][0]).toBe("string");
    });

    it("should not notify subscribers if state unchanged", () => {
      const store = new Shoy({ count: 0 });
      const callback = jest.fn();

      store.subscribe(callback);
      store.apply({ count: 0 });

      expect(callback).toHaveBeenCalledTimes(0);
    });

    it("should allow multiple subscribers", () => {
      const store = new Shoy({ count: 0 });
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      store.subscribe(callback1);
      store.subscribe(callback2);
      store.apply({ count: 1 });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it("should unsubscribe when cleanup called", () => {
      const store = new Shoy({ count: 0 });
      const callback = jest.fn();

      const unsubscribe = store.subscribe(callback);
      unsubscribe();
      store.apply({ count: 1 });

      expect(callback).not.toHaveBeenCalled();
    });

    it("should not duplicate subscribers", () => {
      const store = new Shoy({ count: 0 });
      const callback = jest.fn();

      store.subscribe(callback);
      store.subscribe(callback);
      store.apply({ count: 1 });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("history", () => {
    it("should return empty array when maxHistory is 0", () => {
      const store = new Shoy({ count: 0 });
      store.apply({ count: 1 });
      store.apply({ count: 2 });
      expect(store.history).toEqual([]);
    });

    it("should track history when maxHistory > 0", () => {
      const store = new Shoy({ count: 0 }, { maxHistory: 10 });
      store.apply({ count: 1 });
      store.apply({ count: 2 });

      expect(store.history.length).toBeGreaterThan(0);
    });

    it("should limit history to maxHistory", () => {
      const store = new Shoy({ count: 0 }, { maxHistory: 3 });

      for (let i = 1; i <= 10; i++) {
        store.apply({ count: i });
      }

      expect(store.history.length).toBeLessThanOrEqual(4);
    });

    it("should contain current hash in history", () => {
      const store = new Shoy({ count: 0 }, { maxHistory: 5 });
      store.apply({ count: 1 });
      const currentHash = store.apply({ count: 2 });

      expect(store.history).toContain(currentHash);
    });
  });

  describe("revert", () => {
    it("should return false when maxHistory is 0", () => {
      const store = new Shoy({ count: 0 });
      store.apply({ count: 1 });
      const history = store.history;
      const result = store.revert(history[0] || "invalid");
      expect(result).toBe(false);
    });

    it("should return false for invalid hash", () => {
      const store = new Shoy({ count: 0 }, { maxHistory: 10 });
      const result = store.revert("invalid-hash");
      expect(result).toBe(false);
    });

    it("should revert to previous state", () => {
      const store = new Shoy({ count: 0 }, { maxHistory: 10 });
      store.apply({ count: 1 });
      const hash2 = store.apply({ count: 2 });
      store.apply({ count: 3 });

      const result = store.revert(hash2);
      expect(result).toBe(true);
      expect(store.current.count).toBe(2);
    });

    it("should notify subscribers on revert", () => {
      const store = new Shoy({ count: 0 }, { maxHistory: 10 });
      const callback = jest.fn();

      store.apply({ count: 1 });
      const hash2 = store.apply({ count: 2 });

      store.subscribe(callback);
      store.revert(hash2);

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("undo", () => {
    it("should return false when maxHistory is 0", () => {
      const store = new Shoy({ count: 0 });
      store.apply({ count: 1 });
      expect(store.undo()).toBe(false);
    });

    it("should return false at beginning of history", () => {
      const store = new Shoy({ count: 0 }, { maxHistory: 10 });
      expect(store.undo()).toBe(false);
    });

    it("should undo to previous state", () => {
      const store = new Shoy({ count: 0 }, { maxHistory: 10 });
      store.apply({ count: 1 });
      store.apply({ count: 2 });
      store.apply({ count: 3 });

      const result = store.undo();
      expect(result).toBe(true);
      expect(store.current.count).toBe(2);
    });

    it("should undo multiple times", () => {
      const store = new Shoy({ count: 0 }, { maxHistory: 10 });
      store.apply({ count: 1 });
      store.apply({ count: 2 });
      store.apply({ count: 3 });

      store.undo();
      expect(store.current.count).toBe(2);
      store.undo();
      expect(store.current.count).toBe(1);
      store.undo();
      expect(store.current.count).toBe(0);
      expect(store.undo()).toBe(false);
    });

    it("should notify subscribers on undo", () => {
      const store = new Shoy({ count: 0 }, { maxHistory: 10 });
      const callback = jest.fn();

      store.apply({ count: 1 });
      store.apply({ count: 2 });

      store.subscribe(callback);
      store.undo();

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("redo", () => {
    it("should return false when maxHistory is 0", () => {
      const store = new Shoy({ count: 0 });
      store.apply({ count: 1 });
      expect(store.redo()).toBe(false);
    });

    it("should return false at end of history", () => {
      const store = new Shoy({ count: 0 }, { maxHistory: 10 });
      store.apply({ count: 1 });
      expect(store.redo()).toBe(false);
    });

    it("should redo to next state", () => {
      const store = new Shoy({ count: 0 }, { maxHistory: 10 });
      store.apply({ count: 1 });
      store.apply({ count: 2 });
      store.undo();

      const result = store.redo();
      expect(result).toBe(true);
      expect(store.current.count).toBe(2);
    });

    it("should redo multiple times", () => {
      const store = new Shoy({ count: 0 }, { maxHistory: 10 });
      store.apply({ count: 1 });
      store.apply({ count: 2 });
      store.apply({ count: 3 });
      store.undo();
      store.undo();
      store.undo();

      store.redo();
      expect(store.current.count).toBe(1);
      store.redo();
      expect(store.current.count).toBe(2);
      store.redo();
      expect(store.current.count).toBe(3);
      expect(store.redo()).toBe(false);
    });

    it("should return false when history forked", () => {
      const store = new Shoy({ count: 0 }, { maxHistory: 10 });
      store.apply({ count: 1 });
      store.apply({ count: 2 });
      store.undo();
      store.apply({ count: 10 });

      expect(store.redo()).toBe(false);
    });

    it("should notify subscribers on redo", () => {
      const store = new Shoy({ count: 0 }, { maxHistory: 10 });
      const callback = jest.fn();

      store.apply({ count: 1 });
      store.apply({ count: 2 });
      store.undo();

      store.subscribe(callback);
      store.redo();

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling", () => {
    it("should call custom error handler on error", () => {
      const onError = jest.fn();
      const circular: any = { name: "test" };
      circular.self = circular;

      try {
        new Shoy(circular, { onError });
      } catch {}

      expect(onError).toHaveBeenCalled();
    });

    it("should log error to console if no handler", () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation();
      const circular: any = { name: "test" };
      circular.self = circular;

      try {
        new Shoy(circular);
      } catch {}

      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe("edge cases", () => {
    it("should handle boolean state", () => {
      const store = new Shoy(true);
      expect(store.current).toBe(true);
    });

    it("should handle string state", () => {
      const store = new Shoy("hello");
      expect(store.current).toBe("hello");
    });

    it("should handle empty object", () => {
      const store = new Shoy({});
      store.apply({});
      expect(store.current).toEqual({});
    });

    it("should handle empty array", () => {
      const store = new Shoy([]);
      store.apply([]);
      expect(store.current).toEqual([]);
    });

    it("should handle deeply nested objects", () => {
      const deep = { a: { b: { c: { d: 1 } } } };
      const store = new Shoy(deep);
      store.apply({ a: { b: { c: { d: 2 } } } });
      expect(store.current.a.b.c.d).toBe(2);
    });

    it("should handle complex array of objects", () => {
      const store = new Shoy({ users: [{ name: "Alice" }, { name: "Bob" }] });
      store.apply({ users: [{ name: "Alice" }, { name: "Charlie" }] });
      expect(store.current.users[1].name).toBe("Charlie");
    });

    it("should handle function updates with nested changes", () => {
      const store = new Shoy({ counter: 0, user: { name: "Alice" } });
      store.apply((prev) => ({
        counter: prev.counter + 1,
        user: { name: "Bob" },
      }));
      expect(store.current.counter).toBe(1);
      expect(store.current.user.name).toBe("Bob");
    });
  });

  describe("hash consistency", () => {
    it("should generate same hash for same state", () => {
      const store1 = new Shoy({ count: 0 });
      const store2 = new Shoy({ count: 0 });

      const hash1 = store1.apply({ count: 1 });
      const hash2 = store2.apply({ count: 1 });

      expect(hash1).toBe(hash2);
    });

    it("should generate different hashes for different states", () => {
      const store = new Shoy({ count: 0 });
      const hash1 = store.apply({ count: 1 });
      const hash2 = store.apply({ count: 2 });

      expect(hash1).not.toBe(hash2);
    });

    it("should generate stable hash regardless of object key order", () => {
      const store1 = new Shoy({ a: 1, b: 2, c: 0 });
      const store2 = new Shoy({ b: 2, a: 1, c: 0 });

      const hash1 = store1.apply({ a: 1, b: 2, c: 3 });
      const hash2 = store2.apply({ c: 3, b: 2, a: 1 });

      expect(hash1).toBe(hash2);
    });
  });
});
