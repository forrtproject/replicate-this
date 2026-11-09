import { cloneElement, useId } from 'react'
import {
  DISCIPLINES,
  AVAILABILITY_OPTIONS,
  type AvailabilityKey,
  type VerificationType,
} from '@/types'
import { matchJournalTags } from './journal-tags'

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

      <h2 className="section-title border-t border-line pt-6 text-lg">Kind of check</h2>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          What kind of second look? <span className="font-normal text-muted-foreground">(required)</span>
        </legend>
        <div className="space-y-2.5">
          {(
            [
              ['replication', 'Replication', 'Run the study again with new data and the same methods.'],
              [
                'reproduction',
                'Reproduction',
                'Re-run the original analysis on the original data or code, and test whether the results are robust.',
              ],
              ['both', 'Either, or not sure', 'Leave it to the team that takes it on.'],
            ] as const
          ).map(([value, label, hint]) => (
            <label key={value} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="verificationType"
                value={value}
                checked={values.verificationType === value}
                onChange={() => set({ verificationType: value })}
                className="mt-1 accent-[var(--color-green)]"
              />
              <span>
                {label}
                <span className="block text-[0.8125rem] text-muted-foreground">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <h2 className="section-title border-t border-line pt-6 text-lg">The case for a second look</h2>
      <Field
        label="Why revisit this?"
        required
        hint="Shown first on the study’s page. For example: it is highly cited, informs policy, the result was surprising, or the evidence is thin. At least 20 characters."
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


      {(isReproduction || values.robustnessChecks.trim() !== '') && (
      <Field
        label="Suggested robustness checks"
        optional
        hint="For the reproduction: alternative analyses worth trying."
      >
        <textarea
          value={values.robustnessChecks}
          onChange={(e) => set({ robustnessChecks: e.target.value })}
          rows={2}
          className="input"
        />
      </Field>
      )}

      {(isReplication || values.designDeviations.trim() !== '') && (
        <Field
          label="Suggested changes to the design"
          optional
          hint="For the replication: how the new study should differ from the original, if at all."
        >
          <textarea
            value={values.designDeviations}
            onChange={(e) => set({ designDeviations: e.target.value })}
            rows={2}
            className="input"
          />
        </Field>
      )}

      <h2 className="section-title border-t border-line pt-6 text-lg">Materials and tags</h2>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          What’s openly available?{' '}
          <span className="font-normal text-muted-foreground">(check all that apply)</span>
        </legend>
        <div className="space-y-3">
          {AVAILABILITY_OPTIONS.map((o) => {
            const checked = values.availability.includes(o.key)
            return (
              <div key={o.key}>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAvailability(o.key)}
                    className="mt-0.5 accent-[var(--color-green)]"
                  />
                  <span>
                    {o.label}
                    <span className="block text-[0.8125rem] text-muted-foreground">{o.hint}</span>
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

      <Field
        label="Other data or code location"
        optional
        hint="For example an OSF or Zenodo page, if it isn’t linked above."
      >
        <input
          value={values.dataLocation}
          onChange={(e) => set({ dataLocation: e.target.value })}
          placeholder="https://osf.io/…"
          className="input"
        />
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          Tags <span className="font-normal text-muted-foreground">(check all that apply)</span>
        </legend>
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <input
              id="replication-workshop"
              type="checkbox"
              checked={values.replicationWorkshop}
              onChange={(e) => set({ replicationWorkshop: e.target.checked })}
              className="mt-0.5 accent-[var(--color-green)]"
            />
            <span>
              <label htmlFor="replication-workshop" className="cursor-pointer">
                Suits a one-day workshop
              </label>
              <span className="block text-[0.8125rem] text-muted-foreground">
                A team could replicate or reproduce it in a day.
              </span>
            </span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <input
              id="experimental-research"
              type="checkbox"
              checked={values.experimentalResearch}
              onChange={(e) => set({ experimentalResearch: e.target.checked })}
              className="mt-0.5 accent-[var(--color-green)]"
            />
            <span>
              <label htmlFor="experimental-research" className="cursor-pointer">
                Experimental research
              </label>
              <span className="block text-[0.8125rem] text-muted-foreground">
                The study manipulates conditions rather than observing them.
              </span>
            </span>
          </div>
        </div>
      </fieldset>


    </>
  )
}

/** Live list of journals the resulting study could go to, for the form's sidebar. */
export function JournalPreview({ values }: { values: NominationFormValues }) {
  return (
    <section className="mt-4 rounded-lg border border-band-line bg-band p-5 text-sm" aria-labelledby="journals">
      <h2 id="journals" className="label">
        Where the result could be published
      </h2>
      {!values.discipline ? (
        <p className="mt-2 text-muted-foreground">Choose a discipline to see the list.</p>
      ) : (
        <>
          <ul className="mt-2 space-y-1 text-ink/85">
            {matchJournalTags(values).map((j) => (
              <li key={j.key} title={j.hint}>
                {j.name}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Updates as you fill in the form.</p>
        </>
      )}
    </section>
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
  optional = false,
  children,
}: {
  label: string
  hint?: string
  /** Shows "(required)" after the label; the control itself carries `required`. */
  required?: boolean
  /** Shows "(optional)" after the label. */
  optional?: boolean
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
        {optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
      </label>
      {cloneElement(children, { id, 'aria-describedby': describedBy })}
      {hint && (
        <p id={hintId} className="mt-1 text-[0.8125rem] leading-snug text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}
