import { Link } from 'react-router-dom'
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
  return (
    <article className="group relative flex cursor-pointer gap-4 rounded-lg border border-line bg-card p-4 transition-all hover:border-green/40 hover:shadow-[0_1px_0_0_var(--color-green)]">
      <div className="relative z-10">
        <VoteButton nominationId={n.id} upvotes={n.upvotes} userUpvoted={n.userUpvoted} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <VerificationBadge type={n.verificationType} />
          <StatusBadge status={n.status} />
        </div>

        <Link
          to={`/nominations/${n.id}`}
          className="font-display text-lg font-semibold leading-snug text-ink after:absolute after:inset-0 after:rounded-lg group-hover:text-green"
        >
          {n.metadata.title || n.doi}
        </Link>

        <p className="mt-1 truncate text-sm text-muted-foreground">
          {formatReference(n.metadata)}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5 text-ink/70">{disciplineLabel(n)}</span>
          {n.replicationWorkshop && <ReplicationWorkshopTag />}
          <JournalTags nomination={n} />
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
