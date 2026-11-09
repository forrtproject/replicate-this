/**
 * One date vocabulary for the whole app: recent activity reads as relative
 * time ("3 days ago"), anything older as a short absolute date ("9 Nov 2026").
 */
// Fixed three-letter months: Intl's en-GB gives "Sept", which breaks the pattern.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_YEAR = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })

/** "9 Nov 2026" */
export function formatDate(iso: string | Date): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** "November 2026" */
export function formatMonthYear(iso: string | Date): string {
  return MONTH_YEAR.format(new Date(iso))
}

/** "just now", "5 minutes ago", "3 days ago"; a week or older: "9 Nov 2026". */
export function formatWhen(iso: string | Date, now: number = Date.now()): string {
  const secs = Math.round((now - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  const steps: [number, string][] = [
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
  ]
  let value = Math.floor(secs / 60)
  for (const [limit, unit] of steps) {
    if (value < limit) return `${value} ${unit}${value === 1 ? '' : 's'} ago`
    value = Math.floor(value / limit)
  }
  return formatDate(iso)
}
