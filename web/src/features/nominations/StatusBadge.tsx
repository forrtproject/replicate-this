import { cn } from '@/lib/utils'
import type { NominationStatus } from '@/types'

const CONFIG: Record<NominationStatus, { label: string; className: string }> = {
  pending: { label: 'Under Review', className: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Open', className: 'bg-green-tint text-forest' },
  in_progress: { label: 'In Progress', className: 'bg-amber-100 text-amber-800' },
  completed: { label: 'Completed', className: 'bg-green-tint text-forest' },
  published: { label: 'Published', className: 'bg-green text-white' },
  rejected: { label: 'Rejected', className: 'bg-amber/10 text-amber' },
}

export function StatusBadge({ status }: { status: NominationStatus }) {
  const { label, className } = CONFIG[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        className,
      )}
    >
      {label}
    </span>
  )
}
