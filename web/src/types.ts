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

export type VerificationType = 'replication' | 'reproduction' | 'both'

export type AvailabilityKey =
  | 'open_data'
  | 'open_code'
  | 'open_materials'
  | 'preregistration'
  | 'open_access'

export type ProfileLinkKey =
  | 'orcid'
  | 'website'
  | 'bluesky'
  | 'mastodon'
  | 'github'
  | 'scholar'
  | 'osf'
  | 'linkedin'
  | 'twitter'
export type ProfileLinks = Partial<Record<ProfileLinkKey, string>>

export interface ProfileLinkOption {
  key: ProfileLinkKey
  label: string
  placeholder: string
  /** Primary links always get a field; the rest are added from the logo row. */
  primary?: boolean
}

/** Display order everywhere: ORCID and website first, then the extra profiles. */
export const PROFILE_LINKS: ProfileLinkOption[] = [
  { key: 'orcid', label: 'ORCID iD', placeholder: '0000-0002-1825-0097', primary: true },
  { key: 'website', label: 'Website', placeholder: 'https://example.org', primary: true },
  { key: 'bluesky', label: 'Bluesky', placeholder: '@you.bsky.social' },
  { key: 'mastodon', label: 'Mastodon', placeholder: '@you@fediscience.org' },
  { key: 'github', label: 'GitHub', placeholder: 'username or https://github.com/username' },
  { key: 'scholar', label: 'Google Scholar', placeholder: 'https://scholar.google.com/citations?user=…' },
  { key: 'osf', label: 'OSF', placeholder: 'https://osf.io/abcde/' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/username' },
  { key: 'twitter', label: 'X / Twitter', placeholder: '@username' },
]

export type EmailPrefKey = 'my_nominations' | 'contributions' | 'watched' | 'admin'
export type EmailPrefs = Partial<Record<EmailPrefKey, boolean>>

export const EMAIL_PREF_OPTIONS: {
  key: EmailPrefKey
  label: string
  hint: string
  maintainerOnly?: boolean
}[] = [
  {
    key: 'my_nominations',
    label: 'My nominations',
    hint: 'Approvals, rejections, completion/publication, and maintainer edits',
  },
  {
    key: 'contributions',
    label: 'Contributions & inquiries',
    hint: 'Someone joins your nomination or sends you a message',
  },
  {
    key: 'watched',
    label: 'Subscribed studies',
    hint: 'Comments, progress updates, contributors and status changes on studies you subscribe to',
  },
  {
    key: 'admin',
    label: 'Moderation queue',
    hint: 'New/edited nominations, completion requests, upvote milestones',
    maintainerOnly: true,
  },
]

export const AVAILABILITY_OPTIONS: { key: AvailabilityKey; label: string; hint: string }[] = [
  { key: 'open_data', label: 'Open data', hint: 'Raw or processed data are publicly available' },
  { key: 'open_code', label: 'Open code', hint: 'Analysis scripts / code are shared' },
  { key: 'open_materials', label: 'Open materials', hint: 'Stimuli, surveys, or protocols are shared' },
  { key: 'preregistration', label: 'Preregistration', hint: 'The study was preregistered' },
  { key: 'open_access', label: 'Open access', hint: 'The paper or a preprint is freely readable' },
]

export type NominationStatus =
  | 'pending'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'published'
  | 'rejected'

export interface NominationMetadata {
  title: string
  authors: string[]
  journal: string
  publication_date: string
  // Link to the paper — only for hand-entered references without a DOI.
  url?: string
}

export interface NominationSummary {
  id: string
  // Null for papers without a DOI (reference entered by hand).
  doi: string | null
  metadata: NominationMetadata
  discipline: string
  // The nominator's wording when discipline is 'Other'.
  disciplineOther: string
  verificationType: VerificationType
  availability: AvailabilityKey[]
  availabilityLinks: Partial<Record<AvailabilityKey, string>>
  // Nominator-set tag: suits a Replication Workshop event.
  replicationWorkshop: boolean
  // Nominator-set flag: the study is experimental research (gates the Rx tag).
  experimentalResearch: boolean
  status: NominationStatus
  nominatorToken: string | null
  nominatorName: string | null
  nominatorLinks: ProfileLinks
  viewerIsNominator: boolean
  lastActivityAt: string
  createdAt: string
  upvotes: number
  predictYes: number
  predictNo: number
  contributions: number
  comments: number
  subscribers: number
  userUpvoted: boolean
  userPrediction: boolean | null
  userContributed: boolean
  userSubscribed: boolean
}

export interface NominationDetail extends NominationSummary {
  justification: string
  metadataManual: boolean
  dataLocation: string
  robustnessChecks: string
  designDeviations: string
  // Name of the team's locked Slack channel ('' if none).
  slackChannelName: string
}
