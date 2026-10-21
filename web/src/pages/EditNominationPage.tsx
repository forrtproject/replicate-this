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
import { usePageTitle } from '@/lib/page-title'

const EDITABLE_STATUSES = ['pending', 'approved']

export function EditNominationPage() {
  const { id = '' } = useParams()
  const { data: n, isLoading } = useNomination(id)
  usePageTitle(isLoading ? undefined : n ? `Edit: ${n.metadata.title || n.doi || 'nomination'}` : 'Nomination not found')
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
        ? 'This nomination can no longer be edited, because work on it has started or it was rejected.'
        : null

  if (blocked || !n) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-sm text-muted-foreground">{blocked}</p>
        <Link
          to={n ? `/nominations/${n.id}` : '/nominations'}
          className="mt-2 inline-block text-sm text-green underline"
        >
          {n ? 'Back to nomination' : 'Back to nominations'}
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
    discipline: n.discipline,
    disciplineOther: n.disciplineOther,
    verificationType: n.verificationType,
    justification: n.justification,
    dataLocation: n.dataLocation,
    robustnessChecks: n.robustnessChecks,
    designDeviations: n.designDeviations,
    availability: n.availability,
    availabilityLinks: n.availabilityLinks,
    replicationWorkshop: n.replicationWorkshop,
    experimentalResearch: n.experimentalResearch,
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
      <p className="data mb-4 text-sm text-muted-foreground">{n.doi ?? 'No DOI'}</p>

      <p className="mb-6 text-sm text-muted-foreground">
        The paper’s reference can’t be changed. If you picked the wrong paper, nominate the
        right one instead. Saving your changes sends the nomination back for review.
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
