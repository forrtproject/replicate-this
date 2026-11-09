import type { VerificationType } from '@/types'

/** Definitions of the two core terms, surfaced in hover tooltips. */
export const TERM_DEFINITIONS = {
  Replication:
    'A fresh study that collects NEW data using the same methods, to test whether the original finding holds up.',
  Reproduction:
    'Re-running the original analysis (on the original data, or the original code for computational and simulation studies) to check the reported results, and/or varying how the analysis is done to check they are robust.',
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
 * Action wording. The upvote, team and join labels are the same for every
 * study, so the core actions read the same everywhere; only the join hint names
 * the kind of work, so a reproduction is never described as needing new data.
 */
export const APPROACH_COPY: Record<
  VerificationType,
  { want: string; wanted: string; team: string; join: string; joinHint: string }
> = {
  replication: {
    want: 'I want this checked',
    wanted: 'You want this checked',
    team: 'Study team',
    join: 'Join the study team',
    joinHint: 'For people who intend to help run the replication: new data, same methods.',
  },
  reproduction: {
    want: 'I want this checked',
    wanted: 'You want this checked',
    team: 'Study team',
    join: 'Join the study team',
    joinHint: 'For people who intend to help re-run the original analysis and test its robustness.',
  },
  both: {
    want: 'I want this checked',
    wanted: 'You want this checked',
    team: 'Study team',
    join: 'Join the study team',
    joinHint: 'For people who intend to help replicate or reproduce this study.',
  },
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

/** Below this many predictions, the summary reports counts, not a consensus. */
export const FORECAST_CONSENSUS_MIN = 5

/**
 * A summary of the forecast that never claims more than the responses show:
 * one prediction is reported as one, and a handful is "too few to call".
 */
export function forecastSummary(type: VerificationType, yes: number, no: number): string {
  const total = yes + no
  if (total === 0) return 'No predictions yet. Predictions are anonymous and you can change yours.'
  if (total < FORECAST_CONSENSUS_MIN) {
    return `${total} ${total === 1 ? 'prediction' : 'predictions'} so far, too few to show a split.`
  }
  const yesPct = (yes / total) * 100
  const copy = FORECAST_QUESTION[type] ?? FORECAST_QUESTION.replication
  const n = `${total} predictions.`
  if (yesPct >= 65) return `${copy.yes} ${n}`
  if (yesPct <= 35) return `${copy.no} ${n}`
  return `Researchers are split. ${n}`
}
