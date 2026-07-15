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
    <ul className="flex flex-wrap gap-2">
      {present.map((o) => {
        const url = links[o.key]
        const base =
          'inline-flex items-center gap-1.5 rounded-full bg-green-tint px-2.5 py-1 text-xs font-medium text-forest'
        return (
          <li key={o.key}>
            {url ? (
              <a href={url} target="_blank" rel="noreferrer noopener" className={`${base} hover:underline`}>
                <Check className="h-3.5 w-3.5" /> {o.label}
                <ExternalLink className="h-3 w-3 opacity-70" />
              </a>
            ) : (
              <span className={base} title={o.hint}>
                <Check className="h-3.5 w-3.5" /> {o.label}
              </span>
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
    <span className="inline-flex flex-wrap items-center gap-1 text-green">
      <Check className="h-3 w-3" />
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
                {o.label}
              </a>
            ) : (
              o.label
            )}
            {i < present.length - 1 ? ', ' : ''}
          </span>
        )
      })}
    </span>
  )
}
