import type { NominationSummary } from '@/types'
import { VoteButton } from './VoteButton'
import { APPROACH_COPY } from './verification'

/**
 * How many researchers want this study checked, with the upvote toggle. Once
 * the check is done (`closed`) the tally stays as a record and voting stops.
 */
export function CommunityInterest({
  nomination: n,
  closed = false,
}: {
  nomination: NominationSummary
  closed?: boolean
}) {
  const copy = APPROACH_COPY[n.verificationType] ?? APPROACH_COPY.both
  const people = n.upvotes === 1 ? 'researcher' : 'researchers'
  return (
    <section className="rounded-lg border border-line bg-card p-4" aria-labelledby="interest">
      <h2 id="interest" className="label">
        Community interest
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="data mr-1 align-[-0.1em] font-display text-[1.75rem] font-semibold leading-none text-ink">
          {n.upvotes}
        </span>{' '}
        {closed
          ? `${people} asked for this check`
          : n.upvotes === 0
            ? 'upvotes so far'
            : `${people} ${n.upvotes === 1 ? 'wants' : 'want'} this checked`}
      </p>
      {!closed && (
        <div className="mt-3">
          <VoteButton
            nominationId={n.id}
            upvotes={n.upvotes}
            userUpvoted={n.userUpvoted}
            verificationType={n.verificationType}
            variant="wide"
          />
          {n.upvotes === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Upvotes help maintainers and teams decide what to take on first.
            </p>
          )}
        </div>
      )}
      {closed && n.userUpvoted && (
        <p className="mt-2 text-xs text-muted-foreground">You were one of them. {copy.wanted}.</p>
      )}
    </section>
  )
}
