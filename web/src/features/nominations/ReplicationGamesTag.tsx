import { Gamepad2, HelpCircle } from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'

export const REPLICATION_GAMES_URL = 'https://forrt.org/games/'

/** Shown on hover wherever the Replication Games tag appears. */
const REPLICATION_GAMES_TOOLTIP = (
  <>
    <span className="font-semibold">Replication Games</span>
    <br />
    One-day hackathons organised by the Institute for Replication (I4R), where teams of
    researchers reproduce a published study — re-running its code, checking for errors, and
    re-analysing the data. Papers with openly available data and code that a small team can
    verify in a day are good candidates.
  </>
)

/** Help icon with the Replication Games definition, for use next to form labels. */
export function ReplicationGamesInfo() {
  return (
    <Tooltip content={REPLICATION_GAMES_TOOLTIP}>
      <HelpCircle className="inline h-3.5 w-3.5 cursor-help align-text-top opacity-60" />
    </Tooltip>
  )
}

/** Chip shown on cards and the detail page when the nominator set the tag. */
export function ReplicationGamesTag() {
  return (
    <Tooltip content={REPLICATION_GAMES_TOOLTIP}>
      <span className="inline-flex cursor-help items-center gap-1 rounded-full border border-line bg-muted px-2 py-0.5 text-xs font-medium text-ink/70">
        <Gamepad2 className="h-3 w-3 opacity-60" />
        Replication Games
      </span>
    </Tooltip>
  )
}
