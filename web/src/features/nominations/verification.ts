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
 * Action wording that matches the requested check, so a reproduction is never
 * described as needing new data. "Either / not sure" uses neutral wording.
 */
export const APPROACH_COPY: Record<
  VerificationType,
  { want: string; wanted: string; team: string; join: string; joinHint: string }
> = {
  replication: {
    want: 'I want this replicated',
    wanted: 'You want this replicated',
    team: 'Replication team',
    join: 'Replicate this study',
    joinHint: 'Signal that you intend to help run a replication (new data, same methods).',
  },
  reproduction: {
    want: 'I want this reproduced',
    wanted: 'You want this reproduced',
    team: 'Reproduction team',
    join: 'Reproduce this study',
    joinHint:
      'Signal that you intend to help re-run the original analysis and check its robustness.',
  },
  both: {
    want: 'I want this revisited',
    wanted: 'You want this revisited',
    team: 'Study team',
    join: 'Join the study team',
    joinHint: 'Signal that you intend to help replicate or reproduce this study.',
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
  if (total === 0) return 'Predictions are anonymous and you can change yours any time.'
  if (total === 1) return `The one prediction so far is ${yes === 1 ? 'Yes' : 'No'}.`
  if (total < FORECAST_CONSENSUS_MIN) {
    return `${yes} Yes and ${no} No so far: too few predictions to call.`
  }
  const yesPct = (yes / total) * 100
  const copy = FORECAST_QUESTION[type] ?? FORECAST_QUESTION.replication
  if (yesPct >= 65) return copy.yes
  if (yesPct <= 35) return copy.no
  return 'Researchers are split on this one.'
}
