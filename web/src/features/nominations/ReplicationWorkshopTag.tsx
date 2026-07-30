import { Gamepad2 } from 'lucide-react'

/** Chip shown on cards and the detail page when the nominator set the tag. */
export function ReplicationWorkshopTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-muted px-2 py-0.5 text-xs font-medium text-ink/70">
      <Gamepad2 className="h-3 w-3 opacity-60" />
      Workshop Suitability
    </span>
  )
}
