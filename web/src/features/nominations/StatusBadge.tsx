import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NominationStatus } from '@/types'
import { STATUS_LABELS } from './status'

/**
 * Lifecycle status as a marker plus label, not a filled pill. One colour per
 * stage, so stages never look alike: grey ring = unreviewed, green dot = open
 * for contributors, amber dot = a team is working, check = done.
 */
const MARK: Record<NominationStatus, string> = {
  pending: 'border-[1.5px] border-status-pending bg-transparent',
  approved: 'bg-status-open',
  in_progress: 'bg-status-progress',
  completed: '',
  published: '',
  rejected: 'bg-destructive',
}

const TEXT: Record<NominationStatus, string> = {
  pending: 'text-muted-foreground',
  approved: 'text-forest',
  in_progress: 'text-[#8a4a0b]',
  completed: 'text-forest',
  published: 'text-forest',
  rejected: 'text-destructive',
}

export function StatusBadge({ status, className }: { status: NominationStatus; className?: string }) {
  const done = status === 'completed' || status === 'published'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium',
        TEXT[status],
        className,
      )}
    >
      {done ? (
        <Check className="h-3.5 w-3.5 text-status-done" strokeWidth={2.5} aria-hidden />
      ) : (
        <span className={cn('h-2 w-2 shrink-0 rounded-full', MARK[status])} aria-hidden />
      )}
      {STATUS_LABELS[status]}
    </span>
  )
}
