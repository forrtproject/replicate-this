import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import {
  useProfile,
  useUpdateEmailPrefs,
  useCompleteOnboarding,
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
    <div className="mx-auto max-w-xl px-4 py-10">
      <p className="eyebrow">Welcome to Replicate This</p>
      <h1 className="mt-1 font-display text-3xl font-semibold">Let’s set up your profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        A minute now makes it easier for teammates to recognise and reach you. You can change
        any of this later in your profile.
      </p>

      <ol className="mt-6 flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
              i === step
                ? 'border-green bg-green/10 text-green'
                : i < step
                  ? 'border-line text-muted-foreground'
                  : 'border-line text-muted-foreground/60'
            }`}
          >
            {i < step ? <Check className="h-3.5 w-3.5" /> : <span>{i + 1}</span>}
            {label}
          </li>
        ))}
      </ol>

      <section className="mt-6 rounded-lg border border-line bg-card p-5">
        {step === 0 && <NameStep current={profile.name} />}
        {step === 1 && <AvatarEditor current={profile.image} name={profile.name} />}
        {step === 2 && <LinksStep initial={profile.links} />}
        {step === 3 && (
          <NotificationStep
            initialEmail={profile.notificationEmail}
            initialPrefs={profile.emailPrefs}
          />
        )}
      </section>

      <div className="mt-5 flex items-center justify-between">
        <button
          onClick={finish}
          disabled={complete.isPending}
          className="text-sm text-muted-foreground underline hover:text-ink disabled:opacity-60"
        >
          Skip for now
        </button>
        <div className="flex items-center gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:border-green"
            >
              Back
            </button>
          )}
          {isLast ? (
            <button
              onClick={finish}
              disabled={complete.isPending}
              className="rounded-md bg-green px-4 py-2 text-sm font-medium text-white hover:bg-forest disabled:opacity-60"
            >
              {complete.isPending ? 'Finishing…' : 'Finish'}
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="rounded-md bg-green px-4 py-2 text-sm font-medium text-white hover:bg-forest"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function StepIntro({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-3">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function NameStep({ current }: { current: string }) {
  return (
    <div>
      <StepIntro title="Your display name" hint={DISPLAY_NAME_HINT} />
      <DisplayNameEditor current={current} />
    </div>
  )
}

function LinksStep({ initial }: { initial: ProfileLinks }) {
  return (
    <div>
      <StepIntro
        title="Add public links (optional)"
        hint="Shown on your public profile, nominations and contributions so collaborators can find and credit you. Add only what you’re happy to share."
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
        hint="We've filled in the address you signed in with. Change it if you'd rather use another. Everything also arrives in-app, so uncheck anything you don't want by email."
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
