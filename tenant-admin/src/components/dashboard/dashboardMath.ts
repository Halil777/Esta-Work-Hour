/** Percent change from prev -> last. Returns null when there's no valid baseline. */
export function pctChange(prev: number | undefined, last: number | undefined): number | null {
  if (prev === undefined || last === undefined) return null
  if (prev === 0) return null
  return ((last - prev) / prev) * 100
}
