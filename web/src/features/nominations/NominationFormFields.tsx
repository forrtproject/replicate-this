import {
  DISCIPLINES,
  AVAILABILITY_OPTIONS,
  type AvailabilityKey,
  type VerificationType,
} from '@/types'
import { DefinedTerm } from './VerificationBadge'
import { JournalTags } from './JournalTags'
import { ReplicationGamesInfo, REPLICATION_GAMES_URL } from './ReplicationGamesTag'

/** The nomination fields shared by the submit and edit forms. */
export interface NominationFormValues {
  journal: string
  discipline: string
  verificationType: VerificationType
  justification: string
  dataLocation: string
  robustnessChecks: string
  designDeviations: string
  availability: AvailabilityKey[]
  availabilityLinks: Partial<Record<AvailabilityKey, string>>
  replicationGames: boolean
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
      <Field
        label="Journal"
        hint="Where the paper was published. We’ll fill this from the DOI if you leave it blank."
      >
        <input
          value={values.journal}
          onChange={(e) => set({ journal: e.target.value })}
          placeholder="e.g. American Economic Review"
          className="input"
        />
      </Field>

      <Field label="Discipline">
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

      <fieldset>
        <legend className="mb-1 text-sm font-medium">Replication or reproduction?</legend>
        <p className="mb-2 text-xs text-muted-foreground">
          <DefinedTerm term="Reproduction" /> uses the original data/code;{' '}
          <DefinedTerm term="Replication" /> collects new data.
        </p>
        <div className="space-y-1.5">
          {(
            [
              ['replication', 'Replication — collect new data'],
              ['reproduction', 'Reproduction — re-analyse the original data/code'],
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
        hint="Why is this paper valuable to replicate or reproduce? e.g. highly influential, surprising results, methodologically innovative."
      >
        <textarea
          value={values.justification}
          onChange={(e) => set({ justification: e.target.value })}
          required
          rows={4}
          className="input"
        />
      </Field>

      {isReproduction && (
        <Field
          label="Data location"
          hint="Where do the original data/code live? e.g. a Zenodo or OSF link."
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
          <span className="font-normal text-muted-foreground">(optional)</span>
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
                  <div className="mt-1.5 pl-6">
                    <input
                      value={values.availabilityLinks[o.key] ?? ''}
                      onChange={(e) =>
                        set({
                          availabilityLinks: {
                            ...values.availabilityLinks,
                            [o.key]: e.target.value,
                          },
                        })
                      }
                      placeholder={`Link to ${o.label.toLowerCase()} (optional)`}
                      className="input"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">
          Tags <span className="font-normal text-muted-foreground">(optional)</span>
        </legend>
        <div className="flex items-start gap-2 text-sm">
          <input
            id="replication-games"
            type="checkbox"
            checked={values.replicationGames}
            onChange={(e) => set({ replicationGames: e.target.checked })}
            className="mt-0.5 accent-primary"
          />
          <span>
            <label htmlFor="replication-games" className="cursor-pointer">
              Replication Games suitability
            </label>{' '}
            <ReplicationGamesInfo />
            <span className="block text-xs text-muted-foreground">
              This paper could be reproduced by a team in a one-day Replication Games event.{' '}
              <a
                href={REPLICATION_GAMES_URL}
                target="_blank"
                rel="noreferrer"
                className="text-green underline"
              >
                Learn more
              </a>
            </span>
          </span>
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

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}
