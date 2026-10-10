import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import {
  useSubmitNomination,
  useDoiLookup,
  doiCandidate,
} from '@/features/nominations/api'
import {
  NominationFormFields,
  Field,
  type NominationFormValues,
} from '@/features/nominations/NominationFormFields'
import { formatReference } from '@/features/nominations/format'
import { ApiError } from '@/lib/api'
import { MarkdownDoc } from '@/components/ui/MarkdownDoc'
import type { NominationMetadata } from '@/types'

const EMPTY_FORM: NominationFormValues = {
  discipline: '',
  disciplineOther: '',
  verificationType: 'replication',
  justification: '',
  dataLocation: '',
  robustnessChecks: '',
  designDeviations: '',
  availability: [],
  availabilityLinks: {},
  replicationWorkshop: false,
  experimentalResearch: false,
}

const EMPTY_REFERENCE: NominationMetadata = {
  title: '',
  authors: [],
  journal: '',
  publication_date: '',
  url: '',
}

/** Waits for typing to pause before a value is used (here: before DOI lookups). */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export function NominatePage() {
  const navigate = useNavigate()
  const submit = useSubmitNomination()

  const [doi, setDoi] = useState('')
  const [values, setValues] = useState<NominationFormValues>(EMPTY_FORM)
  const [agreed, setAgreed] = useState(false)
  const [showGuidelines, setShowGuidelines] = useState(true)

  const [error, setError] = useState<string | null>(null)
  const [existingId, setExistingId] = useState<string | null>(null)

  // A hand-entered reference: for papers without a DOI, or when a DOI can't be
  // resolved automatically.
  const [noDoi, setNoDoi] = useState(false)
  const [manual, setManual] = useState<NominationMetadata | null>(null)

  const lookup = useDoiLookup(useDebounced(noDoi ? '' : doi, 500))
  const lookupError = lookup.error instanceof ApiError ? lookup.error : null
  const lookupData = lookupError?.data as { allowManual?: boolean; existingId?: string } | undefined
  const duplicateId = lookup.data?.existingId ?? lookupData?.existingId ?? null

  function chooseNoDoi(value: boolean) {
    setNoDoi(value)
    setError(null)
    setManual(value ? (manual ?? EMPTY_REFERENCE) : null)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setExistingId(null)
    try {
      const { id } = await submit.mutateAsync({
        ...(noDoi ? { noDoi: true } : { doi }),
        ...values,
        metadata: manual ?? undefined,
      })
      navigate(`/nominations/${id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { allowManual?: boolean; existingId?: string } | undefined
        setError(err.message)
        if (data?.existingId) setExistingId(data.existingId)
        if (data?.allowManual && !manual) setManual(EMPTY_REFERENCE)
      } else {
        setError('Something went wrong. Please try again.')
      }
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <p className="eyebrow">Add to the registry</p>
      <h1 className="mb-4 mt-1 font-display text-3xl font-semibold">Nominate a Study</h1>

      {/* Read before writing: the guidelines and Code of Conduct come first. */}
      <div className="mb-6 rounded-lg border border-line bg-muted/40">
        <button
          type="button"
          onClick={() => setShowGuidelines((v) => !v)}
          aria-expanded={showGuidelines}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
        >
          <span>Before you start: nomination guidelines</span>
          <span className="text-xs text-green">{showGuidelines ? 'Hide' : 'Read'}</span>
        </button>
        {showGuidelines && (
          <div className="max-h-72 overflow-y-auto border-t border-line px-4 py-3">
            <MarkdownDoc src="/nomination-guidelines.md" />
          </div>
        )}
        <p className="flex items-start gap-2 border-t border-line px-4 py-3 text-sm">
          <span aria-hidden>🚨</span>
          <span className="text-ink">
            All nominations must respect the{' '}
            <Link to="/code-of-conduct" target="_blank" className="font-medium text-green underline">
              Code of Conduct
            </Link>{' '}
            or they won’t be approved. Nominations appear right away with an “Under Review”
            tag; a maintainer reviews them shortly after.
          </span>
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm font-medium">The paper</legend>
          {!noDoi && (
            <Field
              label="DOI"
              hint="The paper’s Digital Object Identifier, e.g. 10.1257/aer.20190539 — we look up the reference for you."
            >
              <input
                value={doi}
                onChange={(e) => {
                  setDoi(e.target.value)
                  setManual(null)
                }}
                required
                placeholder="10.1000/example"
                className="input"
              />
            </Field>
          )}

          {!noDoi && doiCandidate(doi) && (
            <DoiPreview
              loading={lookup.isFetching}
              metadata={lookup.data?.metadata}
              error={lookupError?.message}
              duplicateId={duplicateId}
              canEnterManually={!!lookupData?.allowManual && !manual}
              onEnterManually={() => setManual(EMPTY_REFERENCE)}
            />
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={noDoi}
              onChange={(e) => chooseNoDoi(e.target.checked)}
              className="accent-primary"
            />
            This paper has no DOI — I’ll enter the reference myself
          </label>

          {manual && (
            <div className="space-y-3 rounded-lg border border-line bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground">
                {noDoi
                  ? 'Enter the reference so others can find the paper.'
                  : 'We couldn’t resolve that DOI — enter the reference so others can find the paper.'}
              </p>
              <ManualFields manual={manual} onChange={setManual} withUrl={noDoi} />
            </div>
          )}
        </fieldset>

        <NominationFormFields values={values} onChange={setValues} />

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 accent-primary"
          />
          <span>
            I have read and agree to the{' '}
            <Link to="/code-of-conduct" target="_blank" className="text-green underline">
              Code of Conduct
            </Link>
            , and this nomination is constructive and about the work, not the authors.
          </span>
        </label>

        {error && (
          <p className="text-sm text-destructive">
            {error}{' '}
            {existingId && (
              <Link to={`/nominations/${existingId}`} className="underline">
                View it here.
              </Link>
            )}
          </p>
        )}

        <button
          type="submit"
          disabled={submit.isPending || !agreed || (!noDoi && !!duplicateId)}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {submit.isPending ? 'Submitting…' : 'Submit nomination'}
        </button>
      </form>
    </div>
  )
}

/** Live result of the DOI lookup: the resolved reference, a duplicate, or an error. */
function DoiPreview({
  loading,
  metadata,
  error,
  duplicateId,
  canEnterManually,
  onEnterManually,
}: {
  loading: boolean
  metadata?: NominationMetadata
  error?: string
  duplicateId: string | null
  canEnterManually: boolean
  onEnterManually: () => void
}) {
  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Looking up this DOI…
      </p>
    )
  }
  if (duplicateId) {
    return (
      <p className="flex items-start gap-2 rounded-md border border-amber/30 bg-amber/10 px-3 py-2 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
        <span>
          This study has already been nominated —{' '}
          <Link to={`/nominations/${duplicateId}`} className="font-medium text-green underline">
            add your vote there instead
          </Link>
          .
        </span>
      </p>
    )
  }
  if (metadata) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-green/30 bg-green-tint px-3 py-2">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green" />
        <div className="min-w-0 text-sm">
          <p className="font-medium text-ink">{metadata.title || 'Untitled'}</p>
          <p className="text-xs text-muted-foreground">{formatReference(metadata)}</p>
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <p className="flex items-start gap-2 rounded-md border border-amber/30 bg-amber/10 px-3 py-2 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
        <span>
          {error}{' '}
          {canEnterManually && (
            <button type="button" onClick={onEnterManually} className="font-medium text-green underline">
              Enter the reference manually
            </button>
          )}
        </span>
      </p>
    )
  }
  return null
}

function ManualFields({
  manual,
  onChange,
  withUrl,
}: {
  manual: NominationMetadata
  onChange: (m: NominationMetadata) => void
  withUrl: boolean
}) {
  return (
    <>
      <input
        value={manual.title}
        onChange={(e) => onChange({ ...manual, title: e.target.value })}
        placeholder="Title"
        aria-label="Title"
        required
        className="input"
      />
      <input
        value={manual.authors.join('; ')}
        onChange={(e) =>
          onChange({
            ...manual,
            authors: e.target.value
              .split(';')
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
        placeholder="Authors (separate with ;)"
        aria-label="Authors"
        className="input"
      />
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <input
          value={manual.journal}
          onChange={(e) => onChange({ ...manual, journal: e.target.value })}
          placeholder="Journal, book or venue"
          aria-label="Journal"
          className="input"
        />
        <input
          value={manual.publication_date}
          onChange={(e) => onChange({ ...manual, publication_date: e.target.value })}
          placeholder="Year"
          aria-label="Year"
          className="input"
        />
      </div>
      {withUrl && (
        <input
          type="url"
          value={manual.url ?? ''}
          onChange={(e) => onChange({ ...manual, url: e.target.value })}
          placeholder="Link to the paper (https://…)"
          aria-label="Link to the paper"
          className="input"
        />
      )}
    </>
  )
}
