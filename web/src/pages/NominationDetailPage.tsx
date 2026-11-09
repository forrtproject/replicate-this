import { useState } from 'react'
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Pencil, Bell, BellOff, FileText } from 'lucide-react'
import { useNomination, useToggleSubscription } from '@/features/nominations/api'
import { useSession } from '@/lib/auth-client'
import { StatusControls } from '@/features/admin/StatusControls'
import { useApprove, useReject } from '@/features/admin/api'
import { UpdatesSection } from '@/features/updates/UpdatesSection'
import { useUpdates } from '@/features/updates/api'
import { CommunityInterest } from '@/features/nominations/CommunityInterest'
import { PredictionBar } from '@/features/nominations/PredictionBar'
import { StatusBadge } from '@/features/nominations/StatusBadge'
import { DefinedTerm } from '@/features/nominations/VerificationBadge'
import { AvailabilityList } from '@/features/nominations/Availability'
import { matchJournalTags } from '@/features/nominations/journal-tags'
import { FORECAST_QUESTION, VERIFICATION_CONFIG } from '@/features/nominations/verification'
import { disciplineLabel, formatReference } from '@/features/nominations/format'
import { ResearcherLink } from '@/features/profile/ResearcherLink'
import { ContactLinks } from '@/features/profile/ContactLinks'
import { RichText } from '@/components/ui/RichText'
import { ContributionPanel } from '@/features/contributions/ContributionPanel'
import { CommentsSection } from '@/features/comments/CommentsSection'
import { ApiError } from '@/lib/api'
import { formatDate } from '@/lib/dates'
import { usePageTitle } from '@/lib/page-title'
import type { NominationDetail } from '@/types'

export function NominationDetailPage() {
  const { id = '' } = useParams()
  const { data: n, isLoading, isError, error } = useNomination(id)
  usePageTitle(isLoading ? undefined : n ? n.metadata.title || n.doi || 'Nomination' : 'Nomination not found')
  const { data: session } = useSession()
  const isMaintainer = (session?.user as { role?: string } | undefined)?.role === 'maintainer'

  if (isLoading) {
    return <p className="mx-auto max-w-5xl px-4 py-20 text-sm text-muted-foreground">Loading…</p>
  }
  if (isError || !n) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20">
        <h1 className="font-display text-[2rem] font-semibold">Nomination not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {(error as Error)?.message ?? 'It may have been removed, or the link is incomplete.'}
        </p>
        <Link to="/nominations" className="mt-4 inline-block text-sm font-medium text-forest underline">
          Back to nominations
        </Link>
      </div>
    )
  }

  const done = n.status === 'completed' || n.status === 'published'
  const canEdit = (n.viewerIsNominator || isMaintainer) && ['pending', 'approved'].includes(n.status)
  const forecast = FORECAST_QUESTION[n.verificationType] ?? FORECAST_QUESTION.replication
  const signInHref = `/sign-in?redirect=${encodeURIComponent(`/nominations/${n.id}`)}`

  // Page-level actions. Signed out, every way of taking part needs an account,
  // so there is one sign-in button instead of controls that would only redirect.
  const actions = session ? (
    <div className="flex flex-wrap gap-2">
      <SubscribeButton nomination={n} signedIn />
      {canEdit && (
        <Link to={`/nominations/${n.id}/edit`} className="btn-secondary btn-sm">
          <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit nomination
        </Link>
      )}
    </div>
  ) : (
    <div>
      <Link to={signInHref} className="btn-primary w-full">
        Sign in to take part
      </Link>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {done
          ? 'Follow the study or message the team.'
          : 'Upvote, predict the outcome, follow updates or join the team.'}
      </p>
    </div>
  )

  return (
    <article className="mx-auto max-w-5xl px-4 pb-16 pt-8">
      <BackLink />

      {/* Header: what the paper is, and where it stands. */}
      <header className="mt-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-muted-foreground">
          <StatusBadge status={n.status} className="text-[0.8125rem]" />
          <span className="text-ink/80">{VERIFICATION_CONFIG[n.verificationType].short}</span>
          <span>{disciplineLabel(n)}</span>
          {n.replicationWorkshop && <span>Suits a replication workshop</span>}
        </div>

        <h1 className="mt-3 max-w-4xl font-display text-[2rem] font-semibold leading-[1.15] tracking-[-0.01em] [overflow-wrap:anywhere] sm:text-[2.5rem]">
          {n.metadata.title || n.doi}
        </h1>

        <p className="mt-3 text-[0.9375rem] text-ink/80">
          {formatReference(n.metadata)}
          {n.metadataManual && <span className="text-muted-foreground"> (reference entered by hand)</span>}
        </p>
        <p className="mt-1 text-sm">
          {n.doi ? (
            <a
              href={`https://doi.org/${n.doi}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-forest hover:underline"
            >
              doi.org/{n.doi} <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : n.metadata.url ? (
            <a
              href={n.metadata.url}
              target="_blank"
              rel="noreferrer nofollow"
              className="inline-flex items-center gap-1 break-all text-forest hover:underline"
            >
              {n.metadata.url} <ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden />
            </a>
          ) : (
            <span className="text-muted-foreground">No DOI</span>
          )}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {n.nominatorToken && (
            <span>
              Nominated by{' '}
              <ResearcherLink name={n.nominatorName} token={n.nominatorToken} className="text-ink" />
              {Object.keys(n.nominatorLinks).length > 0 && (
                <span className="ml-1.5 inline-flex align-middle">
                  <ContactLinks links={n.nominatorLinks} />
                </span>
              )}
              <span> on {formatDate(n.createdAt)}</span>
            </span>
          )}
        </div>
        {/* Phones: page actions sit under the byline; wide screens: top of the rail. */}
        <div className="mt-4 lg:hidden">{actions}</div>
      </header>

      <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-12">
          {n.status === 'pending' && (n.viewerIsNominator || isMaintainer) && (
            <PendingNotice nomination={n} asMaintainer={isMaintainer} />
          )}

          {done && <Outcome nomination={n} />}

          <section aria-labelledby="why">
            <h2 id="why" className="section-title">
              Why revisit this?
            </h2>
            <RichText className="mt-3 max-w-[68ch] text-base leading-relaxed text-ink">
              {n.justification}
            </RichText>
            <p className="mt-4 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
              <SuggestedCheck nomination={n} />
            </p>
          </section>

          <StudyDetails nomination={n} />

          <UpdatesSection nomination={n} resultShownAbove={done} />

          <CommentsSection nominationId={n.id} />
        </div>

        <aside className="space-y-4 lg:pt-1" aria-label="Take part">
          <div className="hidden lg:block">{actions}</div>
          {isMaintainer && n.status !== 'pending' && (
            <StatusControls nominationId={n.id} status={n.status} />
          )}
          <CommunityInterest nomination={n} closed={done} readOnly={!session} />
          <section className="rounded-lg border border-line bg-card p-4" aria-labelledby="forecast">
            <h2 id="forecast" className="label">
              {done ? 'Forecast before the result' : 'Forecast'}
            </h2>
            <p className="mt-0.5 text-sm text-ink">
              {done ? forecast.question.replace(/^Will /, 'Would ') : forecast.question}
            </p>
            <PredictionBar
              nominationId={n.id}
              verificationType={n.verificationType}
              predictYes={n.predictYes}
              predictNo={n.predictNo}
              userPrediction={n.userPrediction}
              closed={done}
              readOnly={!session}
            />
          </section>
          {!(done && n.contributions === 0) && <ContributionPanel nomination={n} />}
        </aside>
      </div>
    </article>
  )
}

/** "A replication (new data, same methods) would test whether…" with term tooltips. */
function SuggestedCheck({ nomination: n }: { nomination: NominationDetail }) {
  const { term } = VERIFICATION_CONFIG[n.verificationType]
  if (n.verificationType === 'both') {
    return (
      <>
        The nominator suggests a <DefinedTerm term="Replication" /> or a{' '}
        <DefinedTerm term="Reproduction" />; either would help.
      </>
    )
  }
  return term ? (
    <>
      The nominator suggests a <DefinedTerm term={term} /> to test whether the finding holds.
    </>
  ) : null
}

/** Openly available materials, data location, suggested checks, possible outlets. */
function StudyDetails({ nomination: n }: { nomination: NominationDetail }) {
  const journals = matchJournalTags(n)
  return (
    <section aria-labelledby="details">
      <h2 id="details" className="section-title">
        About the original study
      </h2>
      <dl className="mt-4 divide-y divide-line border-y border-line text-sm">
        <Row label="Openly available">
          <AvailabilityList items={n.availability} links={n.availabilityLinks} />
        </Row>
        {n.dataLocation && (
          <Row label="Data location">
            {/* Either a bare repository URL or prose citing several: GFM
                autolinks both, so no special-casing for the URL-only form. */}
            <RichText className="leading-relaxed">{n.dataLocation}</RichText>
          </Row>
        )}
        {n.robustnessChecks && (
          <Row label="Suggested robustness checks">
            <RichText className="leading-relaxed">{n.robustnessChecks}</RichText>
          </Row>
        )}
        {n.designDeviations && (
          <Row label="Suggested changes to the design">
            <RichText className="leading-relaxed">{n.designDeviations}</RichText>
          </Row>
        )}
        {journals.length > 0 && (
          <Row label="Could be published in">
            <ul className="space-y-1">
              {journals.map((j) => (
                <li key={j.key}>
                  <span className="text-ink">{j.name}</span>
                  {j.name.replace('²', '2') !== j.key && (
                    <span className="text-muted-foreground"> ({j.key})</span>
                  )}
                </li>
              ))}
            </ul>
          </Row>
        )}
      </dl>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

/**
 * The result of a finished check leads the page: the latest update that links
 * the write-up, so readers see the outcome before anything else.
 */
function Outcome({ nomination: n }: { nomination: NominationDetail }) {
  const { data: updates } = useUpdates(n.id)
  const result = updates?.find((u) => u.articleUrl) ?? updates?.[0]
  return (
    <section
      aria-labelledby="outcome"
      className="rounded-lg border border-status-done/25 bg-green-tint px-5 py-4"
    >
      <h2 id="outcome" className="section-title text-forest">
        {n.status === 'published' ? `Result, published` : `Result`}
      </h2>
      {result ? (
        <>
          <RichText className="mt-2 text-[0.9375rem] leading-relaxed text-ink">{result.content}</RichText>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {result.articleUrl && (
              <a
                href={result.articleUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-forest hover:underline"
              >
                <FileText className="h-4 w-4" aria-hidden /> Read the write-up
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            )}
            <span>
              Reported by <ResearcherLink name={result.name} token={result.token} className="text-ink" /> on{' '}
              {formatDate(result.createdAt)}
            </span>
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">The team has not posted a summary yet.</p>
      )}
    </section>
  )
}

/** What a pending nomination is waiting for, with the review itself for maintainers. */
function PendingNotice({
  nomination: n,
  asMaintainer,
}: {
  nomination: NominationDetail
  asMaintainer: boolean
}) {
  const approve = useApprove()
  const reject = useReject()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  function fail(e: unknown) {
    setError(e instanceof ApiError ? e.message : 'That didn’t work. Please try again.')
  }

  return (
    <section
      aria-labelledby="review"
      className="rounded-lg border border-line bg-card px-5 py-4"
    >
      <h2 id="review" className="font-semibold text-ink">
        {asMaintainer ? 'This nomination needs a review' : 'Waiting for review'}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {asMaintainer
          ? 'Approving marks it as reviewed and lists it as looking for contributors. Rejecting removes it from the registry and sends the nominator your reason.'
          : 'A maintainer will check it against the guidelines. Meanwhile it is listed as pending review, and people can already upvote, discuss and join it. Edits are welcome at any point before work starts.'}
      </p>
      {asMaintainer && (
        <div className="mt-3">
          {rejecting ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium" htmlFor="reject-reason">
                Reason for rejecting (shown to the nominator)
              </label>
              <textarea
                id="reject-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="input"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (!reason.trim()) return setError('Give a reason so the nominator knows what to change.')
                    setError('')
                    reject.mutate({ id: n.id, reason }, { onError: fail })
                  }}
                  disabled={reject.isPending}
                  className="btn-primary bg-destructive! hover:opacity-90"
                >
                  Reject nomination
                </button>
                <button
                  onClick={() => setRejecting(false)}
                  className="px-2 text-sm text-muted-foreground hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => approve.mutate(n.id, { onError: fail })}
                disabled={approve.isPending}
                className="btn-primary"
              >
                Approve
              </button>
              <button onClick={() => setRejecting(true)} className="btn-secondary text-destructive!">
                Reject
              </button>
              <Link to="/admin" className="ml-2 text-sm text-muted-foreground hover:text-ink hover:underline">
                All nominations awaiting review
              </Link>
            </div>
          )}
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>
      )}
    </section>
  )
}

function SubscribeButton({
  nomination: n,
  signedIn,
}: {
  nomination: NominationDetail
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
      title="Subscribers are notified of comments, updates, new team members and status changes."
      className={`btn-secondary btn-sm ${n.userSubscribed ? 'border-green! bg-green-tint! text-forest!' : ''}`}
    >
      {n.userSubscribed ? <BellOff className="h-3.5 w-3.5" aria-hidden /> : <Bell className="h-3.5 w-3.5" aria-hidden />}
      {n.userSubscribed ? 'Unsubscribe' : 'Subscribe'}
      {n.subscribers > 0 && <span className="data text-muted-foreground">{n.subscribers}</span>}
    </button>
  )
}

/**
 * Back to wherever the reader opened this study from. Arriving from a card, the
 * list's filters and sort travel in router state; going back through history
 * (rather than linking to a fresh list) also restores the scroll position.
 * Opened directly, it falls back to the full list.
 */
function BackLink() {
  const location = useLocation()
  const navigate = useNavigate()
  const from = (location.state as { from?: string } | null)?.from
  const toList = !from || from.startsWith('/nominations')
  return (
    <Link
      to={from ?? '/nominations'}
      onClick={(e) => {
        if (from && window.history.length > 1) {
          e.preventDefault()
          navigate(-1)
        }
      }}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-forest"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> {toList ? 'All nominations' : 'Back'}
    </Link>
  )
}
