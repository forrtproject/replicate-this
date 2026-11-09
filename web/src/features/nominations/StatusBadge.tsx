import { cn } from '@/lib/utils'
import type { NominationStatus } from '@/types'
import { STATUS_HINTS, STATUS_LABELS } from './status'

/**
 * Lifecycle status as a marker plus label, not a filled pill. One colour per
 * stage, so stages never look alike: grey ring = unreviewed, green dot = open
 * for contributors, amber dot = a team is working, dark green dot = completed,
 * ringed dark green dot = published. Ticks are kept for open materials.
 */
const MARK: Record<NominationStatus, string> = {
  pending: 'border-[1.5px] border-status-pending bg-transparent',
  approved: 'bg-status-open',
  in_progress: 'bg-status-progress',
  completed: 'bg-status-done',
  // Published: the completed dot with a ring around it.
  published: 'bg-status-done ring-[1.5px] ring-status-done ring-offset-[1.5px] ring-offset-card',
  rejected: 'bg-destructive',
}

// The label stays ink so it never reads as a link; the mark carries the colour.
const TEXT: Record<NominationStatus, string> = {
  pending: 'text-muted-foreground',
  approved: 'text-ink',
  in_progress: 'text-ink',
  completed: 'text-ink',
  published: 'text-ink',
  rejected: 'text-destructive',
}

export function StatusBadge({ status, className }: { status: NominationStatus; className?: string }) {
  return (
    <span
      title={STATUS_HINTS[status]}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium',
        TEXT[status],
        className,
      )}
    >
      <span className={cn('h-2 w-2 shrink-0 rounded-full', MARK[status])} aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  )
}
