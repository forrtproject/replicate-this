import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { formatReference } from '@/features/nominations/format'
import { NominationGuidance } from '@/features/nominations/NominationGuidance'
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
      <p className="mx-auto max-w-5xl px-4 py-20 text-sm text-muted-foreground">Loading…</p>
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
      <div className="mx-auto max-w-5xl px-4 py-20">
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
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-8">
      <Link
        to={`/nominations/${n.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-forest"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to the nomination
      </Link>

      <h1 className="mt-5 font-display text-[2rem] font-semibold leading-tight">Edit nomination</h1>
      <div className="mt-6 grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)]">
      <NominationGuidance />
      <div className="lg:order-1">
      <div className="rounded-lg border border-line bg-card px-4 py-3">
        <p className="font-display text-[1.0625rem] font-semibold leading-snug">{n.metadata.title || n.doi}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {formatReference(n.metadata)}
          {n.doi ? `, doi:${n.doi}` : ''}
        </p>
      </div>

      <p className="mb-6 mt-3 text-sm leading-relaxed text-muted-foreground">
        The paper itself can’t be changed; if it’s the wrong one, nominate the right paper
        instead.{' '}
        {n.status === 'approved'
          ? 'Saving sends the nomination back for review, so it shows as pending until a maintainer approves it again.'
          : 'It is still waiting for review, so a maintainer will see your changes.'}
      </p>

      <form onSubmit={onSubmit} className="space-y-6">
        <NominationFormFields values={values} onChange={setValues} />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-4">
          <button type="submit" disabled={update.isPending} className="btn-primary px-5 py-2.5">
            {update.isPending ? 'Saving…' : n.status === 'approved' ? 'Save and send for review' : 'Save changes'}
          </button>
          <Link to={`/nominations/${n.id}`} className="text-sm text-muted-foreground hover:text-ink">
            Cancel
          </Link>
        </div>
      </form>
      </div>
      </div>
    </div>
  )
}
