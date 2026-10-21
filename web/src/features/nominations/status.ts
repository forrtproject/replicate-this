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
