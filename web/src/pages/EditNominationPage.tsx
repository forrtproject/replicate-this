import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useNomination, useUpdateNomination } from '@/features/nominations/api'
import {
  NominationFormFields,
  type NominationFormValues,
} from '@/features/nominations/NominationFormFields'
import { useSession } from '@/lib/auth-client'
import { ApiError } from '@/lib/api'
import type { NominationDetail } from '@/types'

const EDITABLE_STATUSES = ['pending', 'approved']

export function EditNominationPage() {
  const { id = '' } = useParams()
  const { data: n, isLoading } = useNomination(id)
  const { data: session } = useSession()
  const isMaintainer = (session?.user as { role?: string } | undefined)?.role === 'maintainer'

  if (isLoading) {
    return (
      <p className="mx-auto max-w-xl px-4 py-20 text-center font-mono text-sm text-muted-foreground">
        Loading…
      </p>
    )
  }

  const blocked = !n
    ? 'Nomination not found.'
    : !(n.viewerIsNominator || isMaintainer)
      ? 'Only the nominator or a maintainer can edit this nomination.'
      : !EDITABLE_STATUSES.includes(n.status)
        ? 'This nomination can no longer be edited — replication work has started or it was rejected.'
        : null

  if (blocked || !n) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-sm text-muted-foreground">{blocked}</p>
        <Link
          to={n ? `/nominations/${n.id}` : '/registry'}
          className="mt-2 inline-block text-sm text-green underline"
        >
          {n ? 'Back to nomination' : 'Back to registry'}
        </Link>
      </div>
    )
  }

  return <EditForm nomination={n} />
}

function EditForm({ nomination: n }: { nomination: NominationDetail }) {
  const navigate = useNavigate()
  const update = useUpdateNomination(n.id)
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<NominationFormValues>(() => ({
    journal: n.metadata.journal ?? '',
    discipline: n.discipline,
    verificationType: n.verificationType,
    justification: n.justification,
    dataLocation: n.dataLocation,
    robustnessChecks: n.robustnessChecks,
    designDeviations: n.designDeviations,
    availability: n.availability,
    availabilityLinks: n.availabilityLinks,
    replicationGames: n.replicationGames,
  }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await update.mutateAsync(values)
      navigate(`/nominations/${n.id}`)
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
      )
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Link
        to={`/nominations/${n.id}`}
        className="text-sm text-muted-foreground hover:text-green"
      >
        ← Back to nomination
      </Link>

      <p className="eyebrow mt-4">Edit nomination</p>
      <h1 className="mb-1 mt-1 font-display text-3xl font-semibold leading-tight">
        {n.metadata.title || n.doi}
      </h1>
      <p className="data mb-4 text-sm text-muted-foreground">{n.doi}</p>

      <p className="mb-6 text-sm text-muted-foreground">
        The DOI and fetched reference can’t be changed — nominate a new study instead if you
        picked the wrong paper. Saving your changes sends the nomination back under review.
      </p>

      <form onSubmit={onSubmit} className="space-y-5">
        <NominationFormFields values={values} onChange={setValues} />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={update.isPending}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {update.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}
