import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSubmitNomination } from '@/features/nominations/api'
import {
  NominationFormFields,
  Field,
  type NominationFormValues,
} from '@/features/nominations/NominationFormFields'
import { ApiError } from '@/lib/api'
import { MarkdownDoc } from '@/components/ui/MarkdownDoc'
import type { NominationMetadata } from '@/types'

const EMPTY_FORM: NominationFormValues = {
  journal: '',
  discipline: '',
  verificationType: 'replication',
  justification: '',
  dataLocation: '',
  robustnessChecks: '',
  designDeviations: '',
  availability: [],
  availabilityLinks: {},
  replicationGames: false,
}

export function NominatePage() {
  const navigate = useNavigate()
  const submit = useSubmitNomination()

  const [doi, setDoi] = useState('')
  const [values, setValues] = useState<NominationFormValues>(EMPTY_FORM)
  const [agreed, setAgreed] = useState(false)
  const [showGuidelines, setShowGuidelines] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [existingId, setExistingId] = useState<string | null>(null)

  // Manual reference entry, revealed when DOI lookup fails (422 allowManual).
  const [manual, setManual] = useState<NominationMetadata | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setExistingId(null)
    try {
      const { id } = await submit.mutateAsync({
        doi,
        ...values,
        metadata: manual ?? undefined,
      })
      navigate(`/nominations/${id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { allowManual?: boolean; existingId?: string } | undefined
        setError(err.message)
        if (data?.existingId) setExistingId(data.existingId)
        if (data?.allowManual && !manual) {
          setManual({ title: '', authors: [], journal: '', publication_date: '' })
        }
      } else {
        setError('Something went wrong. Please try again.')
      }
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <p className="eyebrow">Add to the registry</p>
      <h1 className="mb-4 mt-1 font-display text-3xl font-semibold">Nominate a Study</h1>

      {/* Code of Conduct notice */}
      <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-amber/30 bg-amber/10 px-4 py-3 text-sm">
        <span aria-hidden>🚨</span>
        <p className="text-ink">
          <span className="font-semibold">Important note:</span> All posters must respect the
          Code of Conduct or their nomination will not be approved. Please read the{' '}
          <Link to="/code-of-conduct" target="_blank" className="font-medium text-green underline">
            Code of Conduct here
          </Link>
          .
        </p>
      </div>

      <p className="mb-6 text-sm text-muted-foreground">
        We fetch the reference from Crossref (or doi.org) automatically. Nominations appear
        right away with an “Under Review” tag; a maintainer reviews them shortly after.
      </p>

      <form onSubmit={onSubmit} className="space-y-5">
        <Field label="DOI" hint="The paper’s Digital Object Identifier, e.g. 10.1257/aer.20190539.">
          <input
            value={doi}
            onChange={(e) => setDoi(e.target.value)}
            required
            placeholder="10.1000/example"
            className="input"
          />
        </Field>

        <NominationFormFields values={values} onChange={setValues} />

        {/* Embedded, GitHub-editable guidelines */}
        <div className="rounded-lg border border-line bg-muted/40 p-3">
          <button
            type="button"
            onClick={() => setShowGuidelines((v) => !v)}
            className="flex w-full items-center justify-between text-sm font-medium"
          >
            <span>Nomination guidelines</span>
            <span className="text-xs text-green">{showGuidelines ? 'Hide' : 'Read'}</span>
          </button>
          {showGuidelines && (
            <div className="mt-3 max-h-72 overflow-y-auto border-t border-line pt-3">
              <MarkdownDoc src="/nomination-guidelines.md" />
            </div>
          )}
        </div>

        {manual && (
          <fieldset className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <legend className="px-1 text-xs font-medium text-amber-800">
              Couldn’t resolve that DOI — please enter the reference manually
            </legend>
            <ManualFields manual={manual} onChange={setManual} />
          </fieldset>
        )}

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
          disabled={submit.isPending || !agreed}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {submit.isPending ? 'Submitting…' : 'Submit nomination'}
        </button>
      </form>
    </div>
  )
}

function ManualFields({
  manual,
  onChange,
}: {
  manual: NominationMetadata
  onChange: (m: NominationMetadata) => void
}) {
  return (
    <>
      <input
        value={manual.title}
        onChange={(e) => onChange({ ...manual, title: e.target.value })}
        placeholder="Title"
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
        className="input"
      />
      <input
        value={manual.publication_date}
        onChange={(e) => onChange({ ...manual, publication_date: e.target.value })}
        placeholder="Year (e.g. 2010)"
        className="input"
      />
    </>
  )
}
