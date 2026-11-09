import { BookOpen, CircleCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NominationStatus } from '@/types'
import { STATUS_HINTS, STATUS_LABELS } from './status'

/**
 * Lifecycle status as a marker plus label, not a filled pill. One colour per
 * stage, so stages never look alike: grey ring = unreviewed, blue dot = open
 * for contributors, amber dot = a team is working, circled check = completed,
 * open book = published in a journal. Plain ticks are kept for open materials.
 */
const MARK: Record<NominationStatus, string> = {
  pending: 'border-[1.5px] border-status-pending bg-transparent',
  approved: 'bg-status-open',
  in_progress: 'bg-status-progress',
  completed: '',
  published: '',
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
      {/* Fixed 14px marker box, so every label starts at the same x. */}
      <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden>
        {status === 'completed' ? (
          <CircleCheck className="h-3.5 w-3.5 text-status-done" strokeWidth={2.25} />
        ) : status === 'published' ? (
          <BookOpen className="h-3.5 w-3.5 text-status-done" strokeWidth={2.25} />
        ) : (
          <span className={cn('h-2 w-2 rounded-full', MARK[status])} />
        )}
      </span>
      {STATUS_LABELS[status]}
    </span>
  )
}
