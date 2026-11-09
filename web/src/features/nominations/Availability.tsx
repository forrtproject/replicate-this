import { Check, ExternalLink } from 'lucide-react'
import { AVAILABILITY_OPTIONS, type AvailabilityKey } from '@/types'

type Links = Partial<Record<AvailabilityKey, string>>

/** Full list with labels — for the detail page. Linked where a URL was given. */
export function AvailabilityList({
  items,
  links = {},
}: {
  items: AvailabilityKey[]
  links?: Links
}) {
  const present = AVAILABILITY_OPTIONS.filter((o) => items.includes(o.key))
  if (present.length === 0) {
    return <p className="text-sm text-muted-foreground">Not specified by the nominator.</p>
  }
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1">
      {present.map((o) => {
        const url = links[o.key]
        return (
          <li key={o.key} className="inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-status-done" strokeWidth={2.5} aria-hidden />
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-forest underline-offset-2 hover:underline"
              >
                {o.label}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            ) : (
              <span title={o.hint}>{o.label}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Compact inline labels — for cards. Linked items are clickable. */
export function AvailabilityTags({ items, links = {} }: { items: AvailabilityKey[]; links?: Links }) {
  const present = AVAILABILITY_OPTIONS.filter((o) => items.includes(o.key))
  if (present.length === 0) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Check className="h-3 w-3 text-status-done" strokeWidth={2.5} aria-hidden />
      {present.map((o, i) => {
        const url = links[o.key]
        return (
          <span key={o.key}>
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                onClick={(e) => e.stopPropagation()}
                className="hover:underline"
              >
                {i === 0 ? o.label : o.label.toLowerCase()}
              </a>
            ) : i === 0 ? (
              o.label
            ) : (
              o.label.toLowerCase()
            )}
            {i < present.length - 1 ? ', ' : ''}
          </span>
        )
      })}
    </span>
  )
}
