import React from "react";
import { render, act } from "@testing-library/react";
import { Shoy, useGet, useApply } from "../index";

describe("useGet", () => {
  it("should return initial state value", () => {
    const store = new Shoy({ count: 0, name: "Alice" });

    function TestComponent() {
      const count = useGet(store, (s) => s.count);
      return <div data-testid="count">{count}</div>;
    }

    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId("count").textContent).toBe("0");
  });

  it("should return entire state when selector returns all", () => {
    const store = new Shoy({ count: 42 });

    function TestComponent() {
      const state = useGet(store, (s) => s);
      return <div data-testid="state">{state.count}</div>;
    }

    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId("state").textContent).toBe("42");
  });

  it("should select nested property", () => {
    const store = new Shoy({ user: { name: "Bob", age: 30 } });

    function TestComponent() {
      const name = useGet(store, (s) => s.user.name);
      return <div data-testid="name">{name}</div>;
    }

    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId("name").textContent).toBe("Bob");
  });

  it("should select with transformation", () => {
    const store = new Shoy({ count: 5 });

    function TestComponent() {
      const doubled = useGet(store, (s) => s.count * 2);
      return <div data-testid="doubled">{doubled}</div>;
    }

    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId("doubled").textContent).toBe("10");
  });

  it("should re-render when state changes", () => {
    const store = new Shoy({ count: 0 });
    const renderCount = jest.fn();

    function TestComponent() {
      const count = useGet(store, (s) => s.count);
      renderCount();
      return <div data-testid="count">{count}</div>;
    }

    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId("count").textContent).toBe("0");
    const initialRenders = renderCount.mock.calls.length;

    act(() => {
      store.apply({ count: 10 });
    });

    expect(renderCount.mock.calls.length).toBeGreaterThan(initialRenders);
    expect(getByTestId("count").textContent).toBe("10");
  });

  it("should not re-render when selected value unchanged", () => {
    const store = new Shoy({ count: 0, name: "Alice" });
    const renderCount = jest.fn();

    function TestComponent() {
      const count = useGet(store, (s) => s.count);
      renderCount();
      return <div data-testid="count">{count}</div>;
    }

    const { getByTestId } = render(<TestComponent />);
    const initialRenders = renderCount.mock.calls.length;

    act(() => {
      store.apply({ count: 0, name: "Bob" });
    });

    expect(getByTestId("count").textContent).toBe("0");
  });

  it("should handle multiple components with same selector", () => {
    const store = new Shoy({ count: 5 });

    function Counter() {
      const count = useGet(store, (s) => s.count);
      return <div data-testid="counter">{count}</div>;
    }

    const { getAllByTestId } = render(
      <>
        <Counter />
        <Counter />
        <Counter />
      </>,
    );

    const counters = getAllByTestId("counter");
    counters.forEach((counter) => {
      expect(counter.textContent).toBe("5");
    });
  });

  it("should handle different selectors in same component", () => {
    const store = new Shoy({ count: 10, multiplier: 3 });

    function TestComponent() {
      const count = useGet(store, (s) => s.count);
      const multiplier = useGet(store, (s) => s.multiplier);
      const result = useGet(store, (s) => s.count * s.multiplier);

      return (
        <div>
          <div data-testid="count">{count}</div>
          <div data-testid="multiplier">{multiplier}</div>
          <div data-testid="result">{result}</div>
        </div>
      );
    }

    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId("count").textContent).toBe("10");
    expect(getByTestId("multiplier").textContent).toBe("3");
    expect(getByTestId("result").textContent).toBe("30");
  });
});

describe("useApply", () => {
  it("should return a stable function", () => {
    const store = new Shoy({ count: 0 });
    const functionRefs: any[] = [];

    function TestComponent() {
      const apply = useApply(store);
      functionRefs.push(apply);
      return <button onClick={() => apply({ count: 1 })}>Update</button>;
    }

    const { rerender } = render(<TestComponent />);
    const firstRef = functionRefs[0];

    rerender(<TestComponent />);
    const secondRef = functionRefs[1];

    expect(firstRef).toBe(secondRef);
  });

  it("should apply partial update", () => {
    const store = new Shoy({ count: 0, name: "Alice" });
    let applyFn: any;

    function TestComponent() {
      const count = useGet(store, (s) => s.count);
      applyFn = useApply(store);
      return <div data-testid="count">{count}</div>;
    }

    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId("count").textContent).toBe("0");

    act(() => {
      applyFn({ count: 42 });
    });

    expect(getByTestId("count").textContent).toBe("42");
  });

  it("should apply functional update", () => {
    const store = new Shoy({ count: 0 });
    let applyFn: any;

    function TestComponent() {
      const count = useGet(store, (s) => s.count);
      applyFn = useApply(store);
      return <div data-testid="count">{count}</div>;
    }

    const { getByTestId } = render(<TestComponent />);

    act(() => {
      applyFn((prev: any) => ({ count: prev.count + 5 }));
    });

    expect(getByTestId("count").textContent).toBe("5");
  });

  it("should work with nested updates", () => {
    const store = new Shoy({ user: { name: "Alice", age: 30 } });
    let applyFn: any;

    function TestComponent() {
      const age = useGet(store, (s) => s.user.age);
      applyFn = useApply(store);
      return <div data-testid="age">{age}</div>;
    }

    const { getByTestId } = render(<TestComponent />);

    act(() => {
      applyFn({ user: { age: 31 } });
    });

    expect(getByTestId("age").textContent).toBe("31");
  });
});

describe("hooks integration", () => {
  it("should work together in same component", () => {
    const store = new Shoy({ count: 0 });

    function Counter() {
      const count = useGet(store, (s) => s.count);
      const apply = useApply(store);

      return (
        <div>
          <div data-testid="count">{count}</div>
          <button
            data-testid="increment"
            onClick={() => apply({ count: count + 1 })}
          >
            Increment
          </button>
        </div>
      );
    }

    const { getByTestId } = render(<Counter />);
    expect(getByTestId("count").textContent).toBe("0");

    const button = getByTestId("increment");
    act(() => {
      button.click();
    });

    expect(getByTestId("count").textContent).toBe("1");
  });

  it("should handle complex state interactions", () => {
    const store = new Shoy({ items: [{ id: 1, name: "Item 1" }] });

    function ItemList() {
      const items = useGet(store, (s) => s.items);
      const apply = useApply(store);

      const addItem = () => {
        apply({
          items: [
            ...items,
            { id: items.length + 1, name: `Item ${items.length + 1}` },
          ],
        });
      };

      return (
        <div>
          <div data-testid="count">{items.length}</div>
          <button data-testid="add" onClick={addItem}>
            Add
          </button>
        </div>
      );
    }

    const { getByTestId } = render(<ItemList />);
    expect(getByTestId("count").textContent).toBe("1");

    const button = getByTestId("add");
    act(() => {
      button.click();
    });

    expect(getByTestId("count").textContent).toBe("2");
  });
});
