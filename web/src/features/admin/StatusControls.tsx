import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { ApiError } from '@/lib/api'
import type { NominationStatus } from '@/types'
import { STATUS_LABELS } from '@/features/nominations/status'
import { useSetStatus } from './api'

interface Action {
  status: NominationStatus
  label: string
  revert?: boolean
}

// Maintainers may advance the lifecycle or step back (revert). Completion is
// approved here; the server refuses it until the team has posted a progress
// update linking the research article.
const ACTIONS: Partial<Record<NominationStatus, Action[]>> = {
  approved: [{ status: 'in_progress', label: 'Mark in progress' }],
  in_progress: [
    { status: 'completed', label: 'Approve completion' },
    { status: 'approved', label: `Revert to ${STATUS_LABELS.approved}`, revert: true },
  ],
  completed: [
    { status: 'published', label: 'Mark published' },
    { status: 'in_progress', label: `Revert to ${STATUS_LABELS.in_progress}`, revert: true },
  ],
  published: [{ status: 'completed', label: `Revert to ${STATUS_LABELS.completed}`, revert: true }],
}

export function StatusControls({
  nominationId,
  status,
}: {
  nominationId: string
  status: NominationStatus
}) {
  const setStatus = useSetStatus()
  const [error, setError] = useState('')
  const actions = ACTIONS[status]
  if (!actions) return null

  function run(target: NominationStatus) {
    setError('')
    setStatus.mutate(
      { id: nominationId, status: target },
      {
        onError: (e) =>
          setError(e instanceof ApiError ? e.message : 'Could not change the status.'),
      },
    )
  }

  return (
    <section className="rounded-lg border border-line bg-card p-4" aria-labelledby="maintainer">
      <h2 id="maintainer" className="label mb-3 inline-flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /> Maintainer: change status
      </h2>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.status}
            onClick={() => run(a.status)}
            disabled={setStatus.isPending}
            className={
              a.revert
                ? 'rounded-md border border-line px-3 py-1.5 text-sm hover:border-green disabled:opacity-60'
                : 'rounded-md bg-green px-3 py-1.5 text-sm font-semibold text-white hover:bg-forest disabled:opacity-60'
            }
          >
            {a.label}
          </button>
        ))}
      </div>
      {status === 'in_progress' && (
        <p className="mt-2 text-xs text-muted-foreground">
          Completion can only be approved after the team posts a progress update linking the
          research article.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </section>
  )
}
