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

// Email notification categories a user can opt into (all off by default).
// 'admin' is only meaningful for maintainers.
export const EMAIL_PREF_KEYS = [
  'my_nominations',
  'contributions',
  'watched',
  'admin',
] as const
export type EmailPrefKey = (typeof EMAIL_PREF_KEYS)[number]
export type EmailPrefs = Partial<Record<EmailPrefKey, boolean>>

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
