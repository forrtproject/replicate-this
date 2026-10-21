import { PROFILE_LINK_KEYS, type ProfileLinkKey, type ProfileLinks } from '@/types'

/**
 * Public profile links are typed by hand, in whatever form people have to
 * hand: a full URL, a bare handle, an ORCID iD with or without its URL. Each
 * normaliser turns that into one canonical https URL, so the same profile is
 * always stored the same way, or throws a LinkError with a message the user
 * can act on.
 */
export class LinkError extends Error {}

const MAX_LENGTH = 300

/** ISO 7064 MOD 11-2 checksum over the first 15 digits of an ORCID iD. */
function orcidChecksumValid(id16: string): boolean {
  let total = 0
  for (let i = 0; i < 15; i++) total = (total + Number(id16[i])) * 2
  const result = (12 - (total % 11)) % 11
  return (result === 10 ? 'X' : String(result)) === id16[15]
}

/**
 * Accepts an ORCID iD in any common form (bare iD, with/without dashes, or an
 * orcid.org URL) and returns the canonical `https://orcid.org/0000-…` URL.
 */
export function normalizeOrcid(raw: string): string {
  const compact = raw
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?(sandbox\.)?orcid\.org\//i, '')
    .replace(/\/$/, '')
    .replace(/[\s-]/g, '')
    .toUpperCase()
  if (!/^\d{15}[\dX]$/.test(compact)) {
    throw new LinkError('Enter a valid ORCID iD, e.g. 0000-0002-1825-0097.')
  }
  if (!orcidChecksumValid(compact)) {
    throw new LinkError('That ORCID iD looks mistyped (its check digit doesn’t match).')
  }
  const dashed = compact.replace(/(.{4})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4')
  return `https://orcid.org/${dashed}`
}

/** A URL typed without its scheme ("example.org/me") gets https:// added. */
function asUrl(value: string, what: string): string {
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    throw new LinkError(`The ${what} link doesn't look like a web address.`)
  }
  if (!url.hostname.includes('.')) {
    throw new LinkError(`The ${what} link doesn't look like a web address.`)
  }
  return url.toString()
}

const looksLikeUrl = (v: string) => /^https?:\/\//i.test(v) || /^[\w-]+(\.[\w-]+)+\//.test(v)

/** Bare usernames ("@jane", "jane") for sites with a fixed profile URL pattern. */
function handle(value: string, what: string, pattern = /^[\w.-]{1,100}$/): string {
  const h = value.replace(/^@/, '')
  if (!pattern.test(h)) throw new LinkError(`Enter your ${what} username or profile URL.`)
  return h
}

const NORMALIZERS: Record<ProfileLinkKey, (value: string) => string> = {
  orcid: normalizeOrcid,
  website: (v) => asUrl(v, 'website'),
  github: (v) =>
    looksLikeUrl(v) ? asUrl(v, 'GitHub') : `https://github.com/${handle(v, 'GitHub')}`,
  twitter: (v) => (looksLikeUrl(v) ? asUrl(v, 'X') : `https://x.com/${handle(v, 'X')}`),
  linkedin: (v) =>
    looksLikeUrl(v)
      ? asUrl(v, 'LinkedIn')
      : `https://www.linkedin.com/in/${handle(v.replace(/^in\//, ''), 'LinkedIn')}`,
  // Bluesky handles are domains; a bare name means the default bsky.social host.
  bluesky: (v) => {
    if (/^https?:\/\//i.test(v) || /^bsky\.app\//i.test(v)) return asUrl(v, 'Bluesky')
    const h = handle(v, 'Bluesky').toLowerCase()
    return `https://bsky.app/profile/${h.includes('.') ? h : `${h}.bsky.social`}`
  },
  // "@user@instance.social" → https://instance.social/@user
  mastodon: (v) => {
    const m = v.match(/^@?([\w.-]+)@([\w-]+(\.[\w-]+)+)$/)
    if (m) return `https://${m[2].toLowerCase()}/@${m[1]}`
    if (looksLikeUrl(v)) return asUrl(v, 'Mastodon')
    throw new LinkError('Enter your Mastodon address as @you@instance.social, or its URL.')
  },
  // Google Scholar profiles are identified by the `user` query parameter.
  scholar: (v) => {
    if (looksLikeUrl(v)) return asUrl(v, 'Google Scholar')
    if (/^[\w-]{12}$/.test(v)) return `https://scholar.google.com/citations?user=${v}`
    throw new LinkError('Paste your Google Scholar profile URL.')
  },
  osf: (v) => {
    if (looksLikeUrl(v)) return asUrl(v, 'OSF')
    if (/^[a-z0-9]{5}$/i.test(v)) return `https://osf.io/${v.toLowerCase()}/`
    throw new LinkError('Enter your OSF profile URL or its 5-character id.')
  },
}

/** Keep only known keys, each normalised to its canonical URL. */
export function sanitizeLinks(input: unknown): ProfileLinks {
  const out: ProfileLinks = {}
  if (!input || typeof input !== 'object') return out
  for (const key of PROFILE_LINK_KEYS) {
    const raw = (input as Record<string, unknown>)[key]
    if (typeof raw !== 'string') continue
    const value = raw.trim()
    if (!value) continue
    if (value.length > MAX_LENGTH) throw new LinkError('Links must be under 300 characters.')
    const normalized = NORMALIZERS[key](value)
    if (normalized.length > MAX_LENGTH) throw new LinkError('Links must be under 300 characters.')
    out[key] = normalized
  }
  return out
}
