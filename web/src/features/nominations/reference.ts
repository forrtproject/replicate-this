/**
 * Year policy for hand-entered references: four digits, from 1600 (older work
 * is not plausibly replicable here) to next year (accepted, forthcoming
 * papers). Mirrored on the server in `parseManualMetadata`.
 */
export const EARLIEST_YEAR = 1600

export function latestYear(now = new Date()): number {
  return now.getFullYear() + 1
}

/** An error message for the Year field, or null when it is empty or valid. */
export function yearError(value: string, now = new Date()): string | null {
  const v = value.trim()
  if (!v) return null
  if (!/^\d{4}$/.test(v)) return 'Enter the year as four digits, e.g. 2015.'
  const year = Number(v)
  const latest = latestYear(now)
  if (year < EARLIEST_YEAR || year > latest) {
    return `Enter a year between ${EARLIEST_YEAR} and ${latest}.`
  }
  return null
}
