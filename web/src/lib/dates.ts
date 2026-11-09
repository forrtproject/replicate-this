/**
 * One date vocabulary for the whole app: recent activity reads as relative
 * time ("3 days ago"), anything older as a short absolute date ("9 Nov 2026").
 */
const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const MONTH_YEAR = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })

/** "9 Nov 2026" */
export function formatDate(iso: string | Date): string {
  return DATE.format(new Date(iso))
}

/** "November 2026" */
export function formatMonthYear(iso: string | Date): string {
  return MONTH_YEAR.format(new Date(iso))
}

/** "just now", "5 minutes ago", "3 days ago"; older than four weeks: "9 Nov 2026". */
export function formatWhen(iso: string | Date, now: number = Date.now()): string {
  const secs = Math.round((now - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  const steps: [number, string][] = [
    [60, 'minute'],
    [24, 'hour'],
    [28, 'day'],
  ]
  let value = Math.floor(secs / 60)
  for (const [limit, unit] of steps) {
    if (value < limit) return `${value} ${unit}${value === 1 ? '' : 's'} ago`
    value = Math.floor(value / limit)
  }
  return formatDate(iso)
}
