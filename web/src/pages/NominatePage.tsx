import { useEffect, useRef, useState } from 'react'
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
import { yearError } from '@/features/nominations/reference'
import { useDebounced } from '@/lib/hooks'
import { ApiError } from '@/lib/api'
import { MarkdownDoc } from '@/components/ui/MarkdownDoc'
import type { NominationMetadata } from '@/types'
import { usePageTitle } from '@/lib/page-title'

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

// An unsent nomination survives an accidental reload, for this tab only.
const DRAFT_KEY = 'rt:nominate-draft'

interface Draft {
  doi: string
  values: NominationFormValues
  noDoi: boolean
  manual: NominationMetadata | null
}

function loadDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const draft = JSON.parse(raw) as Draft
    // A visit where nothing was typed isn't worth "restoring".
    const v = draft.values
    const typed =
      draft.doi.trim() ||
      draft.manual?.title.trim() ||
      v.discipline ||
      v.justification.trim() ||
      v.dataLocation.trim() ||
      v.robustnessChecks.trim() ||
      v.designDeviations.trim() ||
      v.availability.length > 0
    return typed ? draft : null
  } catch {
    return null
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    // Storage unavailable (private mode): nothing was saved.
  }
}

export function NominatePage() {
  usePageTitle('Nominate a study')
  const navigate = useNavigate()
  const submit = useSubmitNomination()

  const [draft] = useState(loadDraft)
  const [doi, setDoi] = useState(draft?.doi ?? '')
  const [values, setValues] = useState<NominationFormValues>(draft?.values ?? EMPTY_FORM)
  const [agreed, setAgreed] = useState(false)
  const [agreeError, setAgreeError] = useState(false)
  const [restored, setRestored] = useState(!!draft)
  const [showGuidelines, setShowGuidelines] = useState(true)

  const [error, setError] = useState<string | null>(null)
  const [existingId, setExistingId] = useState<string | null>(null)

  // A hand-entered reference: for papers without a DOI, or when a DOI can't be
  // resolved automatically.
  const [noDoi, setNoDoi] = useState(draft?.noDoi ?? false)
  const [manual, setManual] = useState<NominationMetadata | null>(draft?.manual ?? null)

  const doiRef = useRef<HTMLInputElement>(null)
  const agreeRef = useRef<HTMLInputElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)

  // Save as the reader types. Agreement to the Code of Conduct is never saved.
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ doi, values, noDoi, manual }))
    } catch {
      // Storage unavailable: the form still works, it just isn't saved.
    }
  }, [doi, values, noDoi, manual])

  function startOver() {
    clearDraft()
    setDoi('')
    setValues(EMPTY_FORM)
    setNoDoi(false)
    setManual(null)
    setRestored(false)
    setError(null)
  }

  const settledDoi = useDebounced(noDoi ? '' : doi, 500)
  const lookup = useDoiLookup(settledDoi)
  // Typed something that can't be a DOI: say so once typing pauses.
  const malformedDoi = settledDoi.trim() !== '' && !doiCandidate(settledDoi)
  const manualYearError = manual ? yearError(manual.publication_date) : null
  const lookupError = lookup.error instanceof ApiError ? lookup.error : null
  const lookupData = lookupError?.data as { allowManual?: boolean; existingId?: string } | undefined
  const duplicateId = lookup.data?.existingId ?? lookupData?.existingId ?? null

  function chooseNoDoi(value: boolean) {
    setNoDoi(value)
    setError(null)
    setManual(value ? (manual ?? EMPTY_REFERENCE) : null)
  }

  // The browser has already checked required fields and lengths by the time
  // this runs. These checks say what is missing beside the field concerned and
  // move focus there, instead of leaving Submit greyed out with no reason.
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setExistingId(null)
    if (!noDoi && duplicateId) {
      doiRef.current?.focus()
      return
    }
    if (manualYearError) {
      document.getElementById('manual-year')?.focus()
      return
    }
    if (!agreed) {
      setAgreeError(true)
      agreeRef.current?.focus()
      return
    }
    try {
      const { id } = await submit.mutateAsync({
        ...(noDoi ? { noDoi: true } : { doi }),
        ...values,
        metadata: manual ?? undefined,
      })
      clearDraft()
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
      // Move focus to the message so keyboard and screen-reader users land on it.
      window.requestAnimationFrame(() => errorRef.current?.focus())
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <p className="eyebrow">Add to the registry</p>
      <h1 className="mb-4 mt-1 font-display text-3xl font-semibold">Nominate a study</h1>

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
            <MarkdownDoc src="/nomination-guidelines.md" nested />
          </div>
        )}
        <p className="flex items-start gap-2 border-t border-line px-4 py-3 text-sm">
          <span aria-hidden>🚨</span>
          <span className="text-ink">
            All nominations must respect the{' '}
            <Link to="/code-of-conduct" target="_blank" className="font-medium text-green underline">
              Code of Conduct
            </Link>{' '}
            or they won’t be approved. Nominations appear right away marked “Pending review”
            until a maintainer reviews them.
          </span>
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        {restored && (
          <p className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-muted/40 px-3 py-2 text-sm">
            <span>We restored the nomination you were writing in this tab.</span>
            <button
              type="button"
              onClick={startOver}
              className="font-medium text-green underline hover:text-forest"
            >
              Start over
            </button>
          </p>
        )}
        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm font-medium">The paper</legend>
          {!noDoi && (
            <Field
              label="DOI"
              required
              hint="The paper’s Digital Object Identifier, e.g. 10.1257/aer.20190539. We look up the reference for you."
            >
              <input
                ref={doiRef}
                aria-describedby="doi-status"
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

          {/* Always mounted: a live region must exist before its content changes
              for screen readers to announce the lookup result. */}
          <div id="doi-status" role="status" aria-live="polite">
            {!noDoi && malformedDoi && (
              <p className="flex items-start gap-2 rounded-md border border-amber/30 bg-amber/10 px-3 py-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber" aria-hidden />
                <span>
                  That doesn’t look like a DOI. DOIs start with “10.”, for example
                  10.1257/aer.20190539. If the paper has none, tick the box below.
                </span>
              </p>
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
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={noDoi}
              onChange={(e) => chooseNoDoi(e.target.checked)}
              className="accent-primary"
            />
            Enter the reference manually (the paper has no DOI)
          </label>

          {manual && (
            <div className="space-y-3 rounded-lg border border-line bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground">
                {noDoi
                  ? 'Enter the reference so others can find the paper.'
                  : 'We couldn’t look up that DOI. Enter the reference so others can find the paper.'}
              </p>
              <ManualFields
                manual={manual}
                onChange={setManual}
                withUrl={noDoi}
                yearError={manualYearError}
              />
            </div>
          )}
        </fieldset>

        <NominationFormFields values={values} onChange={setValues} />

        <label className="flex items-start gap-2 text-sm">
          <input
            ref={agreeRef}
            type="checkbox"
            checked={agreed}
            onChange={(e) => {
              setAgreed(e.target.checked)
              if (e.target.checked) setAgreeError(false)
            }}
            aria-invalid={agreeError}
            aria-describedby={agreeError ? 'agree-error' : undefined}
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
        {agreeError && (
          <p id="agree-error" role="alert" className="-mt-3 text-sm text-destructive">
            Tick this box to confirm you agree to the Code of Conduct.
          </p>
        )}

        {error && (
          <p ref={errorRef} tabIndex={-1} role="alert" className="text-sm text-destructive focus:outline-none">
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
          disabled={submit.isPending}
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
          This study has already been nominated.{' '}
          <Link to={`/nominations/${duplicateId}`} className="font-medium text-green underline">
            Upvote it there instead
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
  yearError,
}: {
  manual: NominationMetadata
  onChange: (m: NominationMetadata) => void
  withUrl: boolean
  yearError: string | null
}) {
  // The raw text, so a just-typed ";" survives until the next author is typed.
  const [authorsText, setAuthorsText] = useState(manual.authors.join('; '))

  return (
    <>
      <Field label="Title" required>
        <input
          value={manual.title}
          onChange={(e) => onChange({ ...manual, title: e.target.value })}
          required
          className="input"
        />
      </Field>
      <Field label="Authors" hint="Separate authors with semicolons, e.g. Smith, J.; Lee, K.">
        <input
          value={authorsText}
          onChange={(e) => {
            setAuthorsText(e.target.value)
            onChange({
              ...manual,
              authors: e.target.value
                .split(';')
                .map((a) => a.trim())
                .filter(Boolean),
            })
          }}
          className="input"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
        <Field label="Journal or venue" hint="Journal, book, conference or repository.">
          <input
            value={manual.journal}
            onChange={(e) => onChange({ ...manual, journal: e.target.value })}
            className="input"
          />
        </Field>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Year</span>
          <input
            id="manual-year"
            value={manual.publication_date}
            onChange={(e) => onChange({ ...manual, publication_date: e.target.value })}
            inputMode="numeric"
            maxLength={4}
            aria-invalid={!!yearError}
            aria-describedby="year-help"
            className="input"
          />
          <span
            id="year-help"
            className={`mt-1 block text-xs ${yearError ? 'text-destructive' : 'text-muted-foreground'}`}
          >
            {yearError ?? 'Four digits, e.g. 2015.'}
          </span>
        </label>
      </div>
      {withUrl && (
        <Field label="Link to the paper" hint="Where readers can find it, starting https://">
          <input
            type="url"
            value={manual.url ?? ''}
            onChange={(e) => onChange({ ...manual, url: e.target.value })}
            className="input"
          />
        </Field>
      )}
    </>
  )
}
