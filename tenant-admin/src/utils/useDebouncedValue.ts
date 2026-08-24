import { useEffect, useState } from 'react'

/**
 * Debounces a fast-changing value (typically a search input) so a caller —
 * e.g. a react-query queryKey — doesn't fire a new request on every
 * keystroke. The input itself should stay bound to the raw, un-debounced
 * value so typing feels instant; only the network request waits.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
