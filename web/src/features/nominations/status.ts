import type { NominationStatus } from '@/types'

/**
 * Plain-language status names, shared by badges, filters and admin controls.
 * Each says what the reader can do next: a reviewed nomination is "Looking for
 * contributors" (anyone may join), never just "Open", and an unreviewed one is
 * "Pending review", so it is never mistaken for an endorsed one.
 */
export const STATUS_LABELS: Record<NominationStatus, string> = {
  pending: 'Pending review',
  approved: 'Looking for contributors',
  in_progress: 'In progress',
  completed: 'Completed',
  published: 'Published',
  rejected: 'Rejected',
}

/** One-line meaning of each status, shown on hover and in the registry filter. */
export const STATUS_HINTS: Record<NominationStatus, string> = {
  pending: 'Public, but not yet checked by a maintainer.',
  approved: 'Checked by a maintainer and open for a team to take on.',
  in_progress: 'A team is working on the replication or reproduction.',
  completed: 'The work is done and the team has posted the result.',
  published: 'The result has been published as a journal article.',
  rejected: 'Did not meet the guidelines; visible only to the nominator.',
}
