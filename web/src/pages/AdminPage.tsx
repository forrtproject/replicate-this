import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useAdminNominations,
  useApprove,
  useReject,
  useUndoReject,
  type AdminNomination,
} from '@/features/admin/api'
import { AdminPageHeader } from '@/features/admin/AdminTabs'
import { VERIFICATION_CONFIG } from '@/features/nominations/verification'
import { useNominations } from '@/features/nominations/api'
import { ResearcherLink } from '@/features/profile/ResearcherLink'
import { formatDate } from '@/lib/dates'
import { AvailabilityTags } from '@/features/nominations/Availability'
import { disciplineLabel, formatReference } from '@/features/nominations/format'
import { RichText } from '@/components/ui/RichText'
import { usePageTitle } from '@/lib/page-title'

export function AdminPage() {
  usePageTitle('Review nominations')
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-10">
      <AdminPageHeader
        title="Review nominations"
        intro="New and edited nominations wait here until a maintainer approves them, which opens them to contributors. Rejecting needs a reason, which the nominator sees."
      />
      <Section title="Waiting for review" tab="pending" empty="Nothing to review. New nominations will appear here." />
      <Section title="Rejected" tab="archived" empty="No rejected nominations." />
    </div>
  )
}

function Section({
  title,
  tab,
  empty,
}: {
  title: string
  tab: 'pending' | 'archived'
  empty: string
}) {
  const { data, isLoading } = useAdminNominations(tab)
  return (
    <section className="mb-12" aria-label={title}>
      <h2 className="section-title mb-3">
        {title}
        {data && data.length > 0 && (
          <span className="data ml-2 font-sans text-base font-normal text-muted-foreground">{data.length}</span>
        )}
      </h2>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {data?.length === 0 && (
        <p className="rounded-lg border border-line bg-card px-4 py-5 text-sm text-muted-foreground">{empty}</p>
      )}
      {data && data.length > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line bg-card">
          {data.map((n) => (
            <li key={n.id}>
              <Row nomination={n} tab={tab} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Row({ nomination: n, tab }: { nomination: AdminNomination; tab: 'pending' | 'archived' }) {
  const approve = useApprove()
  const reject = useReject()
  const undo = useUndoReject()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  // The queue's own payload carries only internal ids; the public list has the
  // nominator's display name and profile token.
  const { data: publicList } = useNominations()
  const pub = publicList?.find((p) => p.id === n.id)

  return (
    <div className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <Link
            to={`/nominations/${n.id}`}
            className="font-display text-[1.1875rem] font-semibold leading-snug text-ink hover:text-forest"
          >
            {n.metadata.title || n.doi}
          </Link>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {formatReference(n.metadata)}
            {n.doi ? `, doi:${n.doi}` : ', no DOI'}
            {n.metadataManual && ' (reference entered by hand)'}
          </p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem] text-muted-foreground">
            <span className="text-ink/80">{VERIFICATION_CONFIG[n.verificationType].short}</span>
            <span>{disciplineLabel(n)}</span>
            <span>
              Nominated by{' '}
              {pub ? (
                <ResearcherLink name={pub.nominatorName} token={pub.nominatorToken} className="text-ink" />
              ) : (
                'a researcher'
              )}{' '}
              on {formatDate(n.createdAt)}
            </span>
            <AvailabilityTags items={n.availability} links={n.availabilityLinks} />
          </p>

          <RichText className="mt-3 max-w-[70ch] text-[0.9375rem] leading-relaxed">{n.justification}</RichText>

          {n.dataLocation && (
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-medium text-ink">Data:</span>{' '}
              <a href={n.dataLocation} target="_blank" rel="noreferrer" className="text-forest underline">
                {n.dataLocation}
              </a>
            </p>
          )}
          {n.robustnessChecks && (
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-medium text-ink">Robustness:</span> {n.robustnessChecks}
            </p>
          )}
          {n.designDeviations && (
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-medium text-ink">Deviations:</span> {n.designDeviations}
            </p>
          )}
        </div>
        <div className="flex flex-shrink-0 flex-wrap gap-2">
          {tab === 'pending' ? (
            <>
              <button onClick={() => approve.mutate(n.id)} className="btn-primary">
                Approve
              </button>
              <button
                onClick={() => {
                  setRejecting(true)
                  setError('')
                }}
                className="btn-secondary text-destructive!"
              >
                Reject
              </button>
              <Link to={`/nominations/${n.id}/edit`} className="btn-secondary">
                Edit
              </Link>
            </>
          ) : (
            <button
              onClick={() => undo.mutate(n.id)}
              className="btn-secondary"
            >
              Undo rejection
            </button>
          )}
        </div>
      </div>

      {rejecting && (
        <div className="mt-3 space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Reason for rejection (shown to the nominator)"
            className="input"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!reason.trim()) {
                  setError('A reason is required.')
                  return
                }
                reject.mutate(
                  { id: n.id, reason },
                  { onSuccess: () => setRejecting(false) },
                )
              }}
              className="btn-primary bg-destructive! hover:opacity-90"
            >
              Reject nomination
            </button>
            <button
              onClick={() => setRejecting(false)}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
