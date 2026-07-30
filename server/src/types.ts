/** Cached reference metadata for a nominated paper. */
export interface NominationMetadata {
  title: string
  authors: string[]
  journal: string
  publication_date: string // ISO-ish: "YYYY", "YYYY-MM", or "YYYY-MM-DD"
}

export const DISCIPLINES = [
  'Psychology',
  'Medicine',
  'Economics',
  'Biology',
  'Physics',
  'Sociology',
  'Education',
  'Linguistics',
  'Marketing',
  'Neuroscience',
  'Other',
] as const

export type Discipline = (typeof DISCIPLINES)[number]

export const VERIFICATION_TYPES = ['replication', 'reproduction', 'both'] as const
export type VerificationType = (typeof VERIFICATION_TYPES)[number]

// What the nominator reports is openly available for the study.
export const AVAILABILITY_KEYS = [
  'open_data',
  'open_code',
  'open_materials',
  'preregistration',
  'open_access',
] as const
export type AvailabilityKey = (typeof AVAILABILITY_KEYS)[number]

// Email notification categories. Every category is on by default — users
// uncheck what they don't want. 'admin' is only meaningful for maintainers.
export const EMAIL_PREF_KEYS = [
  'my_nominations',
  'contributions',
  'watched',
  'admin',
] as const
export type EmailPrefKey = (typeof EMAIL_PREF_KEYS)[number]
export type EmailPrefs = Partial<Record<EmailPrefKey, boolean>>

/** Every category on — what a new account starts with. */
export function defaultEmailPrefs(): Record<EmailPrefKey, boolean> {
  return Object.fromEntries(EMAIL_PREF_KEYS.map((k) => [k, true])) as Record<
    EmailPrefKey,
    boolean
  >
}

/**
 * Stored preferences, with a never-configured account ({}) read as all-on.
 * Saving always writes every key, so an explicit opt-out is never overridden.
 */
export function resolveEmailPrefs(raw: unknown): EmailPrefs {
  const prefs = (raw ?? {}) as EmailPrefs
  return Object.keys(prefs).length === 0 ? defaultEmailPrefs() : prefs
}

// Optional public contact links a user may choose to display.
export const PROFILE_LINK_KEYS = [
  'orcid',
  'github',
  'twitter',
  'linkedin',
  'website',
] as const
export type ProfileLinkKey = (typeof PROFILE_LINK_KEYS)[number]
export type ProfileLinks = Partial<Record<ProfileLinkKey, string>>
