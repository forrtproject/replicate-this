import type { VerificationType } from '@/types'

/** Definitions of the two core terms — surfaced in hover tooltips. */
export const TERM_DEFINITIONS = {
  Replication:
    'A fresh study that collects NEW data using the same methods, to test whether the original finding holds up.',
  Reproduction:
    'Re-running the original analysis — on the original data, or the original code for computational and simulation studies — to check the reported results, and/or varying how the analysis is done to check they are robust.',
} as const

export const VERIFICATION_CONFIG: Record<
  VerificationType,
  { label: string; short: string; term: keyof typeof TERM_DEFINITIONS | null }
> = {
  replication: { label: 'Suggested: replication', short: 'Replication', term: 'Replication' },
  reproduction: { label: 'Suggested: reproduction', short: 'Reproduction', term: 'Reproduction' },
  both: { label: 'Suggested: replication or reproduction', short: 'Replication / Reproduction', term: null },
}

/**
 * The community-forecast question, worded for the check being asked for: "will
 * it replicate?" means nothing for a reproduction, where the question is
 * whether the results survive re-analysis and robustness checks.
 */
export const FORECAST_QUESTION: Record<
  VerificationType,
  { question: string; yes: string; no: string }
> = {
  replication: {
    question: 'Will it replicate?',
    yes: 'Most expect this to replicate.',
    no: 'Most expect this not to replicate.',
  },
  reproduction: {
    question: 'Will the results prove robust?',
    yes: 'Most expect the results to hold up.',
    no: 'Most expect the results not to hold up.',
  },
  both: {
    question: 'Will the finding hold up?',
    yes: 'Most expect the finding to hold up.',
    no: 'Most expect the finding not to hold up.',
  },
}
