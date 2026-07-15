import { PROFILE_LINKS, type ProfileLinks } from '@/types'

/** Renders a researcher's opt-in public contact links as small labelled links. */
export function ContactLinks({ links }: { links: ProfileLinks | undefined }) {
  const present = PROFILE_LINKS.filter((l) => links?.[l.key])
  if (present.length === 0) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {present.map((l) => (
        <a
          key={l.key}
          href={links![l.key]}
          target="_blank"
          rel="noreferrer noopener"
          className="text-green hover:underline"
        >
          {l.label}
        </a>
      ))}
    </span>
  )
}
