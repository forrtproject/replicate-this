import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { ApiError } from '@/lib/api'
import type { NominationStatus } from '@/types'
import { useSetStatus } from './api'

interface Action {
  status: NominationStatus
  label: string
  revert?: boolean
}

// Maintainers may advance the lifecycle or step back (revert). Completion is
// approved here — the server refuses it until the team has posted a progress
// update linking the research article.
const ACTIONS: Partial<Record<NominationStatus, Action[]>> = {
  approved: [{ status: 'in_progress', label: 'Mark in progress' }],
  in_progress: [
    { status: 'completed', label: 'Approve completion' },
    { status: 'approved', label: 'Revert to Open', revert: true },
  ],
  completed: [
    { status: 'published', label: 'Mark published' },
    { status: 'in_progress', label: 'Revert to In Progress', revert: true },
  ],
  published: [{ status: 'completed', label: 'Revert to Completed', revert: true }],
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
    <div className="mt-5 rounded-lg border border-amber/30 bg-amber/5 p-3">
      <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800">
        <ShieldCheck className="h-3.5 w-3.5" /> Maintainer controls
      </p>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.status}
            onClick={() => run(a.status)}
            disabled={setStatus.isPending}
            className={
              a.revert
                ? 'rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60'
                : 'rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60'
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
    </div>
  )
}
