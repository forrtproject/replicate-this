import { cn } from '@/lib/utils'
import type { NominationStatus } from '@/types'
import { STATUS_LABELS } from './status'

const STYLES: Record<NominationStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-green-tint text-forest',
  in_progress: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-tint text-forest',
  published: 'bg-green text-white',
  rejected: 'bg-amber/10 text-amber',
}

export function StatusBadge({ status }: { status: NominationStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
        STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
