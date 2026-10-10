import { Globe } from 'lucide-react'
import {
  siBluesky,
  siGithub,
  siGooglescholar,
  siMastodon,
  siOrcid,
  siOsf,
  siX,
  type SimpleIcon,
} from 'simple-icons'
import type { ProfileLinkKey } from '@/types'

const BRAND: Partial<Record<ProfileLinkKey, SimpleIcon>> = {
  orcid: siOrcid,
  bluesky: siBluesky,
  mastodon: siMastodon,
  github: siGithub,
  scholar: siGooglescholar,
  osf: siOsf,
  twitter: siX,
}

/**
 * The logo for a profile-link kind. Brand marks come from Simple Icons, in
 * their brand colour unless `mono` (then they take the text colour). LinkedIn
 * isn't in Simple Icons, so it gets a plain "in" monogram.
 */
export function LinkIcon({
  kind,
  className = 'h-4 w-4',
  mono = false,
}: {
  kind: ProfileLinkKey
  className?: string
  mono?: boolean
}) {
  if (kind === 'website') return <Globe className={className} aria-hidden />
  if (kind === 'linkedin') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <rect width="24" height="24" rx="4" fill={mono ? 'currentColor' : '#0A66C2'} />
        <text
          x="12"
          y="17.5"
          textAnchor="middle"
          fontSize="14"
          fontWeight="700"
          fontFamily="Arial, sans-serif"
          fill="#fff"
        >
          in
        </text>
      </svg>
    )
  }
  const icon = BRAND[kind]
  if (!icon) return null
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d={icon.path} fill={mono ? 'currentColor' : `#${icon.hex}`} />
    </svg>
  )
}
