import { Link, useLocation } from 'react-router-dom'
import type { NominationSummary } from '@/types'
import { ResearcherLink } from '@/features/profile/ResearcherLink'
import { VoteButton } from './VoteButton'
import { StatusBadge } from './StatusBadge'
import { AvailabilityTags } from './Availability'
import { VERIFICATION_CONFIG } from './verification'
import { disciplineLabel, formatReference } from './format'

/**
 * One row of the registry list. The whole row opens the nomination: the title
 * link is stretched over it (`after:absolute after:inset-0`). The vote button
 * and the nominator's name sit above that overlay so they keep their own click.
 */
export function NominationCard({
  nomination: n,
  showNominator = true,
}: {
  nomination: NominationSummary
  /** Off on a researcher's own profile, where it would only repeat their name. */
  showNominator?: boolean
}) {
  const location = useLocation()

  return (
    // min-w-0 lets the row shrink to a phone's width instead of growing to fit
    // its longest unbreakable line.
    <article className="group relative flex min-w-0 gap-4 px-4 py-4 transition-colors hover:bg-[#f6f5ef] sm:gap-5 sm:px-5">
      <div className="relative z-10 pt-0.5">
        <VoteButton
          nominationId={n.id}
          upvotes={n.upvotes}
          userUpvoted={n.userUpvoted}
          verificationType={n.verificationType}
        />
      </div>

      <div className="min-w-0 flex-1">
        {/* A heading per row, so screen-reader users can jump study to study. */}
        <h3 className="font-display text-[1.1875rem] font-semibold leading-snug">
          <Link
            to={`/nominations/${n.id}`}
            // Where the reader came from (filters, sort), so the study page's
            // back link returns there rather than to the bare list.
            state={{ from: location.pathname + location.search }}
            className="text-ink [overflow-wrap:anywhere] after:absolute after:inset-0 group-hover:text-forest focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-[-2px] focus-visible:after:outline-green"
          >
            {n.metadata.title || n.doi}
          </Link>
        </h3>

        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {formatReference(n.metadata)}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-muted-foreground">
          <StatusBadge status={n.status} className="text-[0.8125rem]" />
          <span>{VERIFICATION_CONFIG[n.verificationType].short}</span>
          <span>{disciplineLabel(n)}</span>
          {n.contributions > 0 && <span>{n.contributions} on the team</span>}
          {n.comments > 0 && (
            <span>
              {n.comments} {n.comments === 1 ? 'comment' : 'comments'}
            </span>
          )}
        </div>

        {(n.availability.length > 0 || (showNominator && n.nominatorToken)) && (
          <div className="mt-1 hidden flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-muted-foreground sm:flex">
            {n.availability.length > 0 && (
              <span className="relative z-10">
                <AvailabilityTags items={n.availability} links={n.availabilityLinks} />
              </span>
            )}
            {showNominator && n.nominatorToken && (
              <span className="relative z-10">
                Nominated by <ResearcherLink name={n.nominatorName} token={n.nominatorToken} />
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
