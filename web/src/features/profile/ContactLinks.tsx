import { PROFILE_LINKS, type ProfileLinks } from '@/types'
import { LinkIcon } from './LinkIcon'

/** Renders a researcher's opt-in public contact links as small logo links. */
export function ContactLinks({ links }: { links: ProfileLinks | undefined }) {
  const present = PROFILE_LINKS.filter((l) => links?.[l.key])
  if (present.length === 0) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {present.map((l) => (
        <a
          key={l.key}
          href={links![l.key]}
          target="_blank"
          rel="noreferrer noopener"
          title={l.label}
          aria-label={l.label}
          className="inline-flex text-muted-foreground opacity-80 transition-opacity hover:opacity-100"
        >
          <LinkIcon kind={l.key} className="h-3.5 w-3.5" />
        </a>
      ))}
    </span>
  )
}
