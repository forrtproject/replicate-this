import { Gamepad2, HelpCircle } from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'

// External program page kept as-is (the Institute for Replication hosts it here).
export const REPLICATION_WORKSHOP_URL = 'https://forrt.org/games/'

/** Shown on hover wherever the Replication Workshop tag appears. */
const REPLICATION_WORKSHOP_TOOLTIP = (
  <>
    <span className="font-semibold">Replication Workshop</span>
    <br />
    One-day hackathons organised by the Institute for Replication (I4R), where teams of
    researchers reproduce a published study — re-running its code, checking for errors, and
    re-analysing the data. Papers with openly available data and code that a small team can
    verify in a day are good candidates.
  </>
)

/** Help icon with the Replication Workshop definition, for use next to form labels. */
export function ReplicationWorkshopInfo() {
  return (
    <Tooltip content={REPLICATION_WORKSHOP_TOOLTIP}>
      <HelpCircle className="inline h-3.5 w-3.5 cursor-help align-text-top opacity-60" />
    </Tooltip>
  )
}

/** Chip shown on cards and the detail page when the nominator set the tag. */
export function ReplicationWorkshopTag() {
  return (
    <Tooltip content={REPLICATION_WORKSHOP_TOOLTIP}>
      <span className="inline-flex cursor-help items-center gap-1 rounded-full border border-line bg-muted px-2 py-0.5 text-xs font-medium text-ink/70">
        <Gamepad2 className="h-3 w-3 opacity-60" />
        Replication Workshop
      </span>
    </Tooltip>
  )
}
