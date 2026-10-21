import { Link, useLocation } from 'react-router-dom'
import { Users, MessageSquare } from 'lucide-react'
import type { NominationSummary } from '@/types'
import { ResearcherLink } from '@/features/profile/ResearcherLink'
import { VoteButton } from './VoteButton'
import { StatusBadge } from './StatusBadge'
import { VerificationBadge } from './VerificationBadge'
import { AvailabilityTags } from './Availability'
import { JournalTags } from './JournalTags'
import { ReplicationWorkshopTag } from './ReplicationWorkshopTag'
import { disciplineLabel, formatReference } from './format'

/**
 * Registry card. The whole card opens the nomination: the title link is
 * stretched over it (`after:absolute after:inset-0`). Anything else
 * interactive inside — the vote button, the nominator's name, availability
 * links, tag tooltips — is positioned above that overlay so it keeps its own
 * click.
 */
export function NominationCard({ nomination: n }: { nomination: NominationSummary }) {
  const location = useLocation()
  return (
    // min-w-0 lets the card shrink to a phone's width instead of growing to
    // fit its longest unbreakable line.
    <article className="group relative flex min-w-0 cursor-pointer gap-3 rounded-lg border border-line bg-card p-4 sm:gap-4 transition-all hover:border-green/40 hover:shadow-[0_1px_0_0_var(--color-green)]">
      <div className="relative z-10">
        <VoteButton
          nominationId={n.id}
          upvotes={n.upvotes}
          userUpvoted={n.userUpvoted}
          verificationType={n.verificationType}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <VerificationBadge type={n.verificationType} />
          <StatusBadge status={n.status} />
        </div>

        {/* A heading per card, so screen-reader users can jump study to study. */}
        <h3 className="font-display text-lg font-semibold leading-snug">
          <Link
            to={`/nominations/${n.id}`}
            // Where the reader came from (filters, sort), so the study page's
            // back link returns there rather than to the bare list.
            state={{ from: location.pathname + location.search }}
            className="text-ink [overflow-wrap:anywhere] after:absolute after:inset-0 after:rounded-lg group-hover:text-green"
          >
            {n.metadata.title || n.doi}
          </Link>
        </h3>

        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {formatReference(n.metadata)}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5 text-ink/70">{disciplineLabel(n)}</span>
          {n.replicationWorkshop && <ReplicationWorkshopTag />}
          <JournalTags nomination={n} focusable={false} />
          {n.contributions > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {n.contributions} contributing
            </span>
          )}
          {n.comments > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {n.comments}
            </span>
          )}
          {n.nominatorToken && (
            <span>
              Nominated by <ResearcherLink name={n.nominatorName} token={n.nominatorToken} />
            </span>
          )}
          <span className="relative z-10">
            <AvailabilityTags items={n.availability} links={n.availabilityLinks} />
          </span>
        </div>
      </div>
    </article>
  )
}
