import * as React from 'react';
import type { Shoy } from '../index';

export function useSelector<S, R>(
  store: Shoy<S>,
  selector: (state: S) => R
): R {
  const [value, setValue] = React.useState<R>(() => selector(store.current));
  const selectorRef = React.useRef(selector);

  React.useEffect(() => {
    selectorRef.current = selector;
  });

  React.useEffect(() => {
    const update = () => {
      const next = selectorRef.current(store.current);
      setValue((prev) => (Object.is(prev, next) ? prev : next));
    };
    return store.subscribe(update);
  }, [store]);

  return value;
}

export function useComputed<S, R>(
  store: Shoy<S>,
  compute: (state: S) => R
): R {
  return React.useMemo(() => compute(store.current), [store.current, compute]);
}

export function createSelector<S, R>(
  selector: (state: S) => R
): (state: S) => R {
  return selector;
}

export function createMemoizedSelector<S, R>(
  selector: (state: S) => R
): (state: S) => R {
  let cachedValue: R | undefined;
  let cachedState: S | undefined;

  return (state: S) => {
    if (cachedState === state) {
      return cachedValue as R;
    }
    
    cachedValue = selector(state);
    cachedState = state;
    return cachedValue;
  };
}

export function useQuery<S, R>(
  store: Shoy<S>,
  query: (state: S) => R
): R {
  return useSelector(store, query);
}
