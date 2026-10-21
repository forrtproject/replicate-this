import { PROFILE_LINKS, type ProfileLinks } from '@/types'
import { LinkIcon } from './LinkIcon'

/** Renders a researcher's opt-in public contact links as small logo links. */
export function ContactLinks({ links }: { links: ProfileLinks | undefined }) {
  const present = PROFILE_LINKS.filter((l) => links?.[l.key])
  if (present.length === 0) return null
  return (
    <span className="inline-flex flex-wrap items-center">
      {present.map((l) => (
        <a
          key={l.key}
          href={links![l.key]}
          target="_blank"
          rel="noreferrer noopener"
          title={l.label}
          aria-label={l.label}
          // 24x24 target around the 14px logo (WCAG 2.5.8); the negative margin
          // keeps it from raising the line it sits in.
          className="-my-[5px] inline-flex rounded p-[5px] text-muted-foreground opacity-80 transition-opacity hover:opacity-100"
        >
          <LinkIcon kind={l.key} className="h-3.5 w-3.5" />
        </a>
      ))}
    </span>
  )
}
