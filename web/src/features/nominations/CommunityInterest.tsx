import type { NominationSummary } from '@/types'
import { VoteButton } from './VoteButton'

/**
 * How many researchers want this study checked, with the upvote toggle. Once
 * the check is done (`closed`) the tally stays as a record and voting stops.
 */
export function CommunityInterest({
  nomination: n,
  closed = false,
  readOnly = false,
}: {
  nomination: NominationSummary
  closed?: boolean
  /** Signed out: show the tally only; the rail has one sign-in button. */
  readOnly?: boolean
}) {
  return (
    <section className="rounded-lg border border-line bg-card p-4" aria-labelledby="interest">
      <h2 id="interest" className="label">
        Community interest
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="data mr-1 align-[-0.1em] font-display text-[1.75rem] font-semibold leading-none text-ink">
          {n.upvotes}
        </span>{' '}
        {n.upvotes === 1 ? 'upvote' : 'upvotes'}
      </p>
      {!closed && !readOnly && (
        <div className="mt-3">
          <VoteButton
            nominationId={n.id}
            upvotes={n.upvotes}
            userUpvoted={n.userUpvoted}
            verificationType={n.verificationType}
            variant="wide"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Upvotes help maintainers and teams decide what to take on first.
          </p>
        </div>
      )}
      {(closed || readOnly) && (
        <p className="mt-2 text-xs text-muted-foreground">
          {closed
            ? `Researchers who wanted this checked before the work began.${n.userUpvoted ? ' You were one of them.' : ''}`
            : 'Upvotes help maintainers and teams decide what to take on first.'}
        </p>
      )}
    </section>
  )
}
