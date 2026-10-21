import { cloneElement, useId } from 'react'
import {
  DISCIPLINES,
  AVAILABILITY_OPTIONS,
  type AvailabilityKey,
  type VerificationType,
} from '@/types'
import { DefinedTerm } from './VerificationBadge'
import { JournalTags } from './JournalTags'

/** The nomination fields shared by the submit and edit forms. */
export interface NominationFormValues {
  discipline: string
  disciplineOther: string
  verificationType: VerificationType
  justification: string
  dataLocation: string
  robustnessChecks: string
  designDeviations: string
  availability: AvailabilityKey[]
  availabilityLinks: Partial<Record<AvailabilityKey, string>>
  replicationWorkshop: boolean
  experimentalResearch: boolean
}

export function NominationFormFields({
  values,
  onChange,
}: {
  values: NominationFormValues
  onChange: (values: NominationFormValues) => void
}) {
  const set = (patch: Partial<NominationFormValues>) => onChange({ ...values, ...patch })

  const isReproduction =
    values.verificationType === 'reproduction' || values.verificationType === 'both'
  const isReplication =
    values.verificationType === 'replication' || values.verificationType === 'both'

  function toggleAvailability(key: AvailabilityKey) {
    set({
      availability: values.availability.includes(key)
        ? values.availability.filter((k) => k !== key)
        : [...values.availability, key],
    })
  }

  return (
    <>
      <Field label="Discipline" required>
        <select
          value={values.discipline}
          onChange={(e) => set({ discipline: e.target.value })}
          required
          className="input"
        >
          <option value="" disabled>
            Select discipline
          </option>
          {DISCIPLINES.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </Field>

      {values.discipline === 'Other' && (
        <Field label="Please specify the discipline" required>
          <input
            value={values.disciplineOther}
            onChange={(e) => set({ disciplineOther: e.target.value })}
            required
            minLength={2}
            maxLength={80}
            placeholder="e.g. Political Science"
            className="input"
          />
        </Field>
      )}

      <fieldset>
        <legend className="mb-1 text-sm font-medium">Replication or reproduction?</legend>
        <p className="mb-2 text-xs text-muted-foreground">
          <DefinedTerm term="Reproduction" /> re-runs the original data or code (including
          simulation and other computational studies) and/or checks the results hold up under
          other reasonable analyses. <DefinedTerm term="Replication" /> collects new data.
        </p>
        <div className="space-y-1.5">
          {(
            [
              ['replication', 'Replication (collect new data)'],
              ['reproduction', 'Reproduction (re-run the original data or code, and/or check robustness)'],
              ['both', 'Either / not sure'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="verificationType"
                value={value}
                checked={values.verificationType === value}
                onChange={() => set({ verificationType: value })}
                className="accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label="Scientific justification"
        required
        hint="Why is this paper valuable to replicate or reproduce? e.g. highly influential, surprising results, methodologically innovative. At least 20 characters."
      >
        <textarea
          value={values.justification}
          onChange={(e) => set({ justification: e.target.value })}
          required
          minLength={20}
          rows={4}
          className="input"
        />
      </Field>

      {isReproduction && (
        <Field
          label="Data location"
          hint="Where do the original data or code live? e.g. a Zenodo or OSF link. For simulation studies, link the code."
        >
          <input
            value={values.dataLocation}
            onChange={(e) => set({ dataLocation: e.target.value })}
            placeholder="https://osf.io/…"
            className="input"
          />
        </Field>
      )}

      <Field
        label="Suggested robustness checks"
        hint="Any specific alternative specifications worth trying? (optional)"
      >
        <textarea
          value={values.robustnessChecks}
          onChange={(e) => set({ robustnessChecks: e.target.value })}
          rows={2}
          className="input"
        />
      </Field>

      {isReplication && (
        <Field
          label="Suggested deviations from the original design"
          hint="If replicating, how should the new design differ from the original? (optional)"
        >
          <textarea
            value={values.designDeviations}
            onChange={(e) => set({ designDeviations: e.target.value })}
            rows={2}
            className="input"
          />
        </Field>
      )}

      <fieldset>
        <legend className="mb-1 text-sm font-medium">
          What’s openly available?{' '}
          <span className="font-normal text-muted-foreground">(check all that apply)</span>
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {AVAILABILITY_OPTIONS.map((o) => {
            const checked = values.availability.includes(o.key)
            return (
              <div key={o.key}>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAvailability(o.key)}
                    className="mt-0.5 accent-primary"
                  />
                  <span>
                    {o.label}
                    <span className="block text-xs text-muted-foreground">{o.hint}</span>
                  </span>
                </label>
                {checked && (
                  <label className="mt-1.5 block pl-6">
                    <span className="mb-1 block text-xs font-medium">
                      Link to {o.label.toLowerCase()}{' '}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </span>
                    <input
                      type="url"
                      value={values.availabilityLinks[o.key] ?? ''}
                      onChange={(e) =>
                        set({
                          availabilityLinks: {
                            ...values.availabilityLinks,
                            [o.key]: e.target.value,
                          },
                        })
                      }
                      placeholder="https://"
                      className="input"
                    />
                  </label>
                )}
              </div>
            )
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">
          Tags <span className="font-normal text-muted-foreground">(check all that apply)</span>
        </legend>
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <input
              id="replication-workshop"
              type="checkbox"
              checked={values.replicationWorkshop}
              onChange={(e) => set({ replicationWorkshop: e.target.checked })}
              className="mt-0.5 accent-primary"
            />
            <span>
              <label htmlFor="replication-workshop" className="cursor-pointer">
                Workshop Suitability
              </label>
              <span className="block text-xs text-muted-foreground">
                This paper could be reproduced by a team in a one-day workshop.
              </span>
            </span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <input
              id="experimental-research"
              type="checkbox"
              checked={values.experimentalResearch}
              onChange={(e) => set({ experimentalResearch: e.target.checked })}
              className="mt-0.5 accent-primary"
            />
            <label htmlFor="experimental-research" className="cursor-pointer">
              Experimental research
            </label>
          </div>
        </div>
      </fieldset>

      {values.discipline && (
        <div className="rounded-lg border border-line bg-muted/40 px-4 py-3">
          <p className="text-sm font-medium">Target journals</p>
          <p className="mb-2 mt-0.5 text-xs text-muted-foreground">
            Based on your answers, the resulting study could be submitted to these outlets.
            Tags update as you edit the form.
          </p>
          <JournalTags nomination={values} />
        </div>
      )}
    </>
  )
}

/**
 * A labelled form control. The hint is linked as the control's description,
 * not folded into its label, so screen readers announce a short name ("Title")
 * followed by the guidance. Expects a single input, select or textarea child.
 */
export function Field({
  label,
  hint,
  required = false,
  children,
}: {
  label: string
  hint?: string
  /** Shows "(required)" after the label; the control itself carries `required`. */
  required?: boolean
  children: React.ReactElement<{ id?: string; 'aria-describedby'?: string }>
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const describedBy =
    [children.props['aria-describedby'], hint && hintId].filter(Boolean).join(' ') || undefined
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
        {required && <span className="font-normal text-muted-foreground"> (required)</span>}
      </label>
      {cloneElement(children, { id, 'aria-describedby': describedBy })}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}
