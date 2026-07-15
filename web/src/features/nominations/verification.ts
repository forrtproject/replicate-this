import type { VerificationType } from '@/types'

/** Definitions of the two core terms — surfaced in hover tooltips. */
export const TERM_DEFINITIONS = {
  Replication:
    'A fresh study that collects NEW data using the same methods, to test whether the original finding holds up.',
  Reproduction:
    'Re-running the original study’s analysis on its OWN data, to check the reported results were computed correctly.',
} as const

export const VERIFICATION_CONFIG: Record<
  VerificationType,
  { label: string; short: string; term: keyof typeof TERM_DEFINITIONS | null }
> = {
  replication: { label: 'Suggested: replication', short: 'Replication', term: 'Replication' },
  reproduction: { label: 'Suggested: reproduction', short: 'Reproduction', term: 'Reproduction' },
  both: { label: 'Suggested: replication or reproduction', short: 'Replication / Reproduction', term: null },
}
