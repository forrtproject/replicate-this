import { Users, Bell, MessageSquare } from 'lucide-react'
import type { NominationSummary } from '@/types'
import { VoteButton } from './VoteButton'

// Mirrors the server's UPVOTE_MILESTONES — the points at which maintainers are
// alerted that a nomination is gathering support.
const UPVOTE_MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000]

/**
 * The upvote panel on a nomination: how much of the community wants this study
 * revisited, how far it is from the next milestone, and who is already involved.
 * Laid out to mirror the forecast panel it sits beside.
 */
export function CommunityInterest({ nomination: n }: { nomination: NominationSummary }) {
  const next = UPVOTE_MILESTONES.find((m) => m > n.upvotes)
  const floor = [0, ...UPVOTE_MILESTONES].filter((m) => m <= n.upvotes).pop() ?? 0
  // Give a single vote a visible sliver of bar so the panel never looks inert.
  const progress = next
    ? Math.max(((n.upvotes - floor) / (next - floor)) * 100, n.upvotes > 0 ? 3 : 0)
    : 100

  return (
    <div className="flex flex-col rounded-lg border border-line bg-card p-4">
      <p className="eyebrow">Community interest</p>
      <p className="mb-3 mt-1 text-xs text-muted-foreground">
        {n.upvotes === 0
          ? 'No votes yet — be the first to back this study.'
          : 'How many researchers want this study revisited.'}
      </p>

      {/* h-7 matches the forecast panel's label row, so both bars land on one line. */}
      <div className="flex h-7 items-baseline justify-between gap-2 text-sm">
        <span>
          <span className="data text-lg font-semibold">{n.upvotes}</span>{' '}
          <span className="text-muted-foreground">
            {n.upvotes === 1 ? 'researcher' : 'researchers'}
          </span>
        </span>
        {next && (
          <span className="text-xs text-muted-foreground">
            <span className="data font-medium text-ink">{next - n.upvotes}</span> to milestone{' '}
            <span className="data">{next}</span>
          </span>
        )}
      </div>

      <div
        className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={n.upvotes}
        aria-valuemin={0}
        aria-valuemax={next ?? n.upvotes}
        aria-label="Upvotes toward the next milestone"
      >
        <div
          className="h-full rounded-full bg-green transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-1.5">
        <VoteButton
          nominationId={n.id}
          upvotes={n.upvotes}
          userUpvoted={n.userUpvoted}
          variant="wide"
        />
      </div>

      <dl className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs text-muted-foreground">
        <Stat icon={Users} value={n.contributions} label="on the team" />
        <Stat icon={Bell} value={n.subscribers} label="subscribed" />
        <Stat icon={MessageSquare} value={n.comments} label="comments" />
      </dl>
    </div>
  )
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Users
  value: number
  label: string
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="data font-semibold text-ink">{value}</span> {label}
      </dd>
    </div>
  )
}
