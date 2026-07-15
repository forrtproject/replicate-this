import { useParams, Link, useNavigate } from 'react-router-dom'
import { ExternalLink, ChevronUp, Pencil, Bell, BellOff } from 'lucide-react'
import { useNomination, useToggleSubscription } from '@/features/nominations/api'
import { useSession } from '@/lib/auth-client'
import { StatusControls } from '@/features/admin/StatusControls'
import { UpdatesSection } from '@/features/updates/UpdatesSection'
import { VoteButton } from '@/features/nominations/VoteButton'
import { PredictionBar } from '@/features/nominations/PredictionBar'
import { StatusBadge } from '@/features/nominations/StatusBadge'
import { VerificationBanner } from '@/features/nominations/VerificationBadge'
import { AvailabilityList } from '@/features/nominations/Availability'
import { JournalTags } from '@/features/nominations/JournalTags'
import { ReplicationGamesTag } from '@/features/nominations/ReplicationGamesTag'
import { formatReference, researcherLabel } from '@/features/nominations/format'
import { ContactLinks } from '@/features/profile/ContactLinks'
import { ContributionPanel } from '@/features/contributions/ContributionPanel'
import { CommentsSection } from '@/features/comments/CommentsSection'

export function NominationDetailPage() {
  const { id = '' } = useParams()
  const { data: n, isLoading, isError, error } = useNomination(id)
  const { data: session } = useSession()
  const isMaintainer = (session?.user as { role?: string } | undefined)?.role === 'maintainer'

  if (isLoading) {
    return (
      <p className="mx-auto max-w-3xl px-4 py-20 text-center font-mono text-sm text-muted-foreground">
        Loading…
      </p>
    )
  }
  if (isError || !n) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-sm text-muted-foreground">
          {(error as Error)?.message ?? 'Nomination not found.'}
        </p>
        <Link to="/registry" className="mt-2 inline-block text-sm text-green underline">
          Back to registry
        </Link>
      </div>
    )
  }

  const predictionsTotal = n.predictYes + n.predictNo

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <Link
        to="/registry"
        className="text-sm text-muted-foreground hover:text-green"
      >
        ← Registry
      </Link>

      <div className="mb-2 mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-2 py-0.5 text-ink/70">{n.discipline}</span>
        <StatusBadge status={n.status} />
        {n.replicationGames && <ReplicationGamesTag />}
        <JournalTags nomination={n} />
        {n.nominatorToken && (
          <span>Nominated by {researcherLabel(n.nominatorName, n.nominatorToken)}</span>
        )}
        {n.metadataManual && <span>· manual reference</span>}
        {(n.viewerIsNominator || isMaintainer) &&
          ['pending', 'approved'].includes(n.status) && (
            <Link
              to={`/nominations/${n.id}/edit`}
              className="inline-flex items-center gap-1 text-green hover:underline"
            >
              <Pencil className="h-3 w-3" /> Edit
            </Link>
          )}
        <SubscribeButton nomination={n} signedIn={!!session} />
      </div>

      <h1 className="font-display text-4xl font-semibold leading-tight">
        {n.metadata.title || n.doi}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{formatReference(n.metadata)}</p>
      <a
        href={`https://doi.org/${n.doi}`}
        target="_blank"
        rel="noreferrer"
        className="data mt-1 inline-flex items-center gap-1 text-sm text-green hover:underline"
      >
        {n.doi} <ExternalLink className="h-3 w-3" />
      </a>
      {Object.keys(n.nominatorLinks).length > 0 && (
        <p className="mt-1 text-sm text-muted-foreground">
          Reach the nominator: <ContactLinks links={n.nominatorLinks} />
        </p>
      )}

      {/* What kind of second look would help — prominent, with term tooltips */}
      <div className="mt-5">
        <VerificationBanner type={n.verificationType} />
      </div>

      <div className="mt-5">
        <p className="eyebrow mb-1.5">What’s openly available</p>
        <AvailabilityList items={n.availability} links={n.availabilityLinks} />
      </div>

      {/* Two clearly-separated engagement panels */}
      <div className="my-6 grid gap-4 sm:grid-cols-2">
        {/* Priority (upvotes) */}
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="eyebrow">Community interest</p>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">
            How many researchers would like to see this revisited.
          </p>
          <div className="flex items-center gap-3">
            <VoteButton nominationId={n.id} upvotes={n.upvotes} userUpvoted={n.userUpvoted} />
            <p className="text-sm text-muted-foreground">
              <span className="data font-semibold text-ink">{n.upvotes}</span>{' '}
              {n.upvotes === 1 ? 'researcher would' : 'researchers would'} like a second look.
              <br />
              <span className="inline-flex items-center gap-1 text-xs">
                <ChevronUp className="h-3 w-3" /> Add your vote.
              </span>
            </p>
          </div>
        </div>

        {/* Forecast (yes/no prediction) */}
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="eyebrow">Community forecast</p>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">
            {predictionsTotal === 0
              ? 'No predictions yet — be the first.'
              : 'What researchers predict the outcome will be.'}
          </p>
          <PredictionBar
            nominationId={n.id}
            predictYes={n.predictYes}
            predictNo={n.predictNo}
            userPrediction={n.userPrediction}
          />
        </div>
      </div>

      <section className="mb-6">
        <p className="eyebrow mb-1.5">Why revisit this?</p>
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{n.justification}</p>
      </section>

      {(n.dataLocation || n.robustnessChecks || n.designDeviations) && (
        <section className="mb-6 space-y-4 rounded-lg border border-line bg-muted/30 p-4">
          {n.dataLocation && (
            <DetailField label="Data location">
              {/^https?:\/\//.test(n.dataLocation) ? (
                <a
                  href={n.dataLocation}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-sm text-green underline"
                >
                  {n.dataLocation}
                </a>
              ) : (
                <p className="text-sm">{n.dataLocation}</p>
              )}
            </DetailField>
          )}
          {n.robustnessChecks && (
            <DetailField label="Suggested robustness checks">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{n.robustnessChecks}</p>
            </DetailField>
          )}
          {n.designDeviations && (
            <DetailField label="Suggested deviations from the original design">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{n.designDeviations}</p>
            </DetailField>
          )}
        </section>
      )}

      {isMaintainer && <StatusControls nominationId={n.id} status={n.status} />}

      <ContributionPanel nomination={n} />

      <UpdatesSection nomination={n} />

      <CommentsSection nominationId={n.id} />
    </article>
  )
}

function SubscribeButton({
  nomination: n,
  signedIn,
}: {
  nomination: import('@/types').NominationDetail
  signedIn: boolean
}) {
  const navigate = useNavigate()
  const toggle = useToggleSubscription(n.id)

  return (
    <button
      onClick={() =>
        signedIn ? toggle.mutate() : navigate(`/sign-in?redirect=/nominations/${n.id}`)
      }
      disabled={toggle.isPending}
      title="Subscribers are notified of comments, updates, contributors and status changes."
      className={`ml-auto inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-60 ${
        n.userSubscribed
          ? 'border-green bg-green-tint text-forest hover:bg-muted'
          : 'border-line bg-card text-ink hover:border-green'
      }`}
    >
      {n.userSubscribed ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
      {n.userSubscribed ? 'Unsubscribe' : 'Subscribe'}
      <span className="text-muted-foreground">{n.subscribers}</span>
    </button>
  )
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-1">{label}</p>
      {children}
    </div>
  )
}
