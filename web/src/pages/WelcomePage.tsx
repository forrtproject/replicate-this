import { PageBand } from '@/components/layout/PageBand'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import {
  useProfile,
  useUpdateEmailPrefs,
  useCompleteOnboarding,
  useUpdateName,
} from '@/features/profile/api'
import { AvatarEditor } from '@/features/profile/AvatarEditor'
import { DisplayNameEditor, DISPLAY_NAME_HINT } from '@/features/profile/DisplayNameEditor'
import { LinksEditor } from '@/features/profile/LinksEditor'
import { ApiError } from '@/lib/api'
import { isValidEmail } from '@/lib/utils'
import { EMAIL_PREF_OPTIONS, type EmailPrefs, type ProfileLinks } from '@/types'
import { usePageTitle } from '@/lib/page-title'

const STEPS = ['Name', 'Photo', 'Public profile', 'Notifications'] as const

/**
 * One-time post-signup walkthrough. Guides a new researcher through the four
 * things worth setting up front — display name, avatar, public links, email
 * notifications — then marks them onboarded and drops them on the dashboard.
 */
export function WelcomePage() {
  usePageTitle('Welcome')
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: profile, isLoading } = useProfile()
  const complete = useCompleteOnboarding()
  const [step, setStep] = useState(0)
  // Step 1's name is saved by Continue rather than by a separate button.
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [stepError, setStepError] = useState('')
  const updateName = useUpdateName()

  async function next() {
    setStepError('')
    if (step === 0 && nameDraft !== null && profile && nameDraft.trim() !== profile.name) {
      try {
        await updateName.mutateAsync(nameDraft.trim())
      } catch (e) {
        setStepError(e instanceof ApiError ? e.message : 'Could not save your name.')
        return
      }
    }
    setStep((s) => s + 1)
  }

  async function finish() {
    await complete.mutateAsync()
    // Ensure the onboarded flag is fresh before the RequireAuth gate re-reads it,
    // otherwise the stale (onboarded=false) cache bounces us straight back here.
    await qc.refetchQueries({ queryKey: ['profile'] })
    navigate('/dashboard', { replace: true })
  }

  if (isLoading || !profile) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
  }

  const isLast = step === STEPS.length - 1

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <PageBand bleed>
      <h1 className="font-display text-[2rem] font-semibold leading-tight">Welcome. Set up your profile</h1>
      <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-band-ink/80">
        Four quick steps that help teammates recognise and reach you. Everything is optional
        and can be changed later in your profile.
      </p>
      </PageBand>
      <div className="max-w-2xl">

      {/* A real sequence, so the steps are numbered. */}
      <ol className="grid grid-cols-4 gap-2" aria-label="Setup steps">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? 'step' : undefined}>
            <span
              className={`block h-1 rounded-full ${i <= step ? 'bg-green' : 'bg-line'}`}
              aria-hidden
            />
            <span
              className={`mt-2 flex items-center gap-1 text-xs ${
                i === step ? 'font-semibold text-ink' : 'text-muted-foreground'
              }`}
            >
              {i < step && <Check className="h-3 w-3 text-forest" aria-hidden />}
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      <section className="mt-6 rounded-lg border border-line bg-card p-6">
        {step === 0 && <NameStep current={profile.name} onDraftChange={setNameDraft} />}
        {step === 1 && (
          <div>
            <StepIntro
              title="Picture"
              hint="Pick an emoji or upload a photo. It appears next to your name on study teams."
            />
            <AvatarEditor current={profile.image} name={profile.name} />
          </div>
        )}
        {step === 2 && <LinksStep initial={profile.links} />}
        {step === 3 && (
          <NotificationStep
            initialEmail={profile.notificationEmail}
            initialPrefs={profile.emailPrefs}
          />
        )}
      </section>

      {stepError && <p className="mt-3 text-sm text-destructive">{stepError}</p>}
      <div className="mt-5 flex items-center justify-between">
        <button
          onClick={finish}
          disabled={complete.isPending}
          className="text-sm text-muted-foreground underline hover:text-ink disabled:opacity-60"
        >
          Skip setup
        </button>
        <div className="flex items-center gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="btn-secondary px-4 py-2"
            >
              Back
            </button>
          )}
          {isLast ? (
            <button
              onClick={finish}
              disabled={complete.isPending}
              className="btn-primary px-4 py-2"
            >
              {complete.isPending ? 'Finishing…' : 'Go to your dashboard'}
            </button>
          ) : (
            <button onClick={next} disabled={updateName.isPending} className="btn-primary px-4 py-2">
              {updateName.isPending ? 'Saving…' : step === 0 ? 'Save and continue' : 'Continue'}
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}

function StepIntro({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-4">
      <h2 className="section-title text-lg">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  )
}

function NameStep({
  current,
  onDraftChange,
}: {
  current: string
  onDraftChange: (name: string) => void
}) {
  return (
    <div>
      <StepIntro title="Your display name" hint={DISPLAY_NAME_HINT} />
      <DisplayNameEditor current={current} onDraftChange={onDraftChange} />
    </div>
  )
}

function LinksStep({ initial }: { initial: ProfileLinks }) {
  return (
    <div>
      <StepIntro
        title="Public links"
        hint="Shown next to your name so collaborators can find and credit you. Add only what you’re happy to share."
      />
      <LinksEditor initial={initial} />
    </div>
  )
}

function NotificationStep({
  initialEmail,
  initialPrefs,
}: {
  initialEmail: string
  initialPrefs: EmailPrefs
}) {
  const update = useUpdateEmailPrefs()
  const [email, setEmail] = useState(initialEmail)
  const [prefs, setPrefs] = useState<EmailPrefs>(initialPrefs)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const options = useMemo(() => EMAIL_PREF_OPTIONS.filter((o) => !o.maintainerOnly), [])
  const emailValid = isValidEmail(email)

  function save() {
    setError('')
    update.mutate(
      { email: email.trim(), prefs },
      {
        onSuccess: () => {
          setSaved(true)
          setTimeout(() => setSaved(false), 1500)
        },
        onError: (e) =>
          setError(e instanceof ApiError ? e.message : 'Could not save your settings.'),
      },
    )
  }

  return (
    <div>
      <StepIntro
        title="Email notifications"
        hint="We filled in the address you signed in with; any address works. Everything also appears in your dashboard."
      />
      <label className="block text-sm">
        <span className="mb-1 block text-muted-foreground">Notification email</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@university.edu"
          className="input max-w-80"
        />
      </label>
      <fieldset className="mt-3">
        <legend className="mb-1.5 text-sm text-muted-foreground">Email me about</legend>
        <div className="space-y-1.5">
          {options.map((o) => (
            <label key={o.key} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={prefs[o.key] === true}
                onChange={(e) => setPrefs((p) => ({ ...p, [o.key]: e.target.checked }))}
                className="mt-0.5 accent-primary"
              />
              <span>
                {o.label}
                <span className="block text-xs text-muted-foreground">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={save}
          disabled={update.isPending || !emailValid}
          title={emailValid ? undefined : 'Enter a valid email address first.'}
          className="rounded-md bg-green px-3 py-2 text-sm font-medium text-white hover:bg-forest disabled:opacity-60"
        >
          {update.isPending ? 'Saving…' : 'Save settings'}
        </button>
        {saved && <span className="text-xs text-green">Saved</span>}
      </div>
    </div>
  )
}
