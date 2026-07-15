import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useAdminNominations,
  useApprove,
  useReject,
  useUndoReject,
  type AdminNomination,
} from '@/features/admin/api'
import { AdminTabs } from '@/features/admin/AdminTabs'
import { VerificationBadge } from '@/features/nominations/VerificationBadge'
import { AvailabilityTags } from '@/features/nominations/Availability'
import { formatReference } from '@/features/nominations/format'

export function AdminPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="eyebrow">Maintainers only</p>
      <h1 className="mb-6 mt-1 font-display text-3xl font-semibold">Moderation Queue</h1>
      <AdminTabs />
      <Section title="Pending" tab="pending" />
      <Section title="Archived / Rejected" tab="archived" />
    </div>
  )
}

function Section({ title, tab }: { title: string; tab: 'pending' | 'archived' }) {
  const { data, isLoading } = useAdminNominations(tab)
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title} {data && `(${data.length})`}
      </h2>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {data?.length === 0 && (
        <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
          Nothing here.
        </p>
      )}
      <div className="space-y-3">
        {data?.map((n) => <Row key={n.id} nomination={n} tab={tab} />)}
      </div>
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

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs text-muted-foreground">
            {n.discipline} · Researcher #{n.nominatorUid?.slice(0, 6) ?? '??????'} ·{' '}
            {new Date(n.createdAt).toLocaleDateString()}
            {n.metadataManual && ' · manual reference'}
          </p>
          <Link to={`/nominations/${n.id}`} className="font-medium hover:text-primary">
            {n.metadata.title || n.doi}
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatReference(n.metadata)} · {n.doi}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <VerificationBadge type={n.verificationType} />
            <AvailabilityTags items={n.availability} links={n.availabilityLinks} />
          </div>

          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{n.justification}</p>

          {n.dataLocation && (
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-medium text-ink">Data:</span>{' '}
              <a href={n.dataLocation} target="_blank" rel="noreferrer" className="text-green underline">
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
        <div className="flex flex-shrink-0 gap-2">
          {tab === 'pending' ? (
            <>
              <Link
                to={`/nominations/${n.id}/edit`}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Edit
              </Link>
              <button
                onClick={() => approve.mutate(n.id)}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Approve
              </button>
              <button
                onClick={() => {
                  setRejecting(true)
                  setError('')
                }}
                className="rounded-md border border-destructive/40 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                Reject
              </button>
            </>
          ) : (
            <button
              onClick={() => undo.mutate(n.id)}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Undo
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
              className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:opacity-90"
            >
              Confirm reject
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
