import { useState, useEffect } from 'react';

// Returns a copy of `value` that only updates after `delay` ms of quiescence.
// Used to keep the search input responsive while debouncing the Dataverse query.
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
