import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Copy, Check } from 'lucide-react'
import { useSession, signOut } from '@/lib/auth-client'
import { useProfile, useUpdateEmailPrefs, useDeleteAccount } from '@/features/profile/api'
import { AvatarEditor } from '@/features/profile/AvatarEditor'
import { DisplayNameEditor, DISPLAY_NAME_HINT } from '@/features/profile/DisplayNameEditor'
import { LinksEditor } from '@/features/profile/LinksEditor'
import { ApiError } from '@/lib/api'
import { isValidEmail } from '@/lib/utils'
import { EMAIL_PREF_OPTIONS, type EmailPrefs } from '@/types'
import { usePageTitle } from '@/lib/page-title'
import { PageBand } from '@/components/layout/PageBand'

export function ProfilePage() {
  usePageTitle('Your profile')
  const { data: session } = useSession()
  const researcherId = session?.user?.id?.slice(0, 6) ?? ''
  const token = session?.user?.id?.slice(0, 8) ?? ''

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <PageBand bleed className="mb-0!">
        <h1 className="font-display text-[2rem] font-semibold leading-tight">Profile</h1>
        <p className="mt-1 text-sm text-band-ink/80">
          How others see you on the registry, and how we reach you.{' '}
          {token && (
            <Link to={`/researchers/${token}`} className="text-brand-deep underline-offset-2 hover:underline">
              View your public profile
            </Link>
          )}
        </p>
      </PageBand>

      <div className="divide-y divide-line">
        <AvatarCard />
        <DisplayNameCard />
        <LinksCard />
        <EmailNotificationsCard
          isMaintainer={(session?.user as { role?: string } | undefined)?.role === 'maintainer'}
        />
        <DangerZone />
      </div>
      <ResearcherIdFooter id={researcherId} />
    </div>
  )
}

function AvatarCard() {
  const { data: profile, isLoading } = useProfile()
  return (
    <Card
      title="Picture"
      hint="Shown on your public profile and next to your name on study teams."
    >
      {isLoading || !profile ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <AvatarEditor current={profile.image} name={profile.name} />
      )}
    </Card>
  )
}

/** One settings group: title and explanation on the left, controls on the right. */
function Card({
  title,
  hint,
  tone,
  children,
}: {
  title: string
  hint?: string
  tone?: 'danger'
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-4 py-8 md:grid-cols-[16rem_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 className={`section-title text-lg ${tone === 'danger' ? 'text-destructive' : ''}`}>{title}</h2>
        {hint && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{hint}</p>}
      </div>
      <div className="min-w-0 max-w-xl">{children}</div>
    </section>
  )
}

// Deliberately low-key: the pseudonym is your identity now. The Researcher ID
// only matters for the rare "ask a maintainer for admin" flow, so it lives as a
// small muted line rather than a prominent card.
function ResearcherIdFooter({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <p className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-6 text-xs text-muted-foreground">
      <span>
        Researcher ID <span className="data rounded bg-muted px-1.5 py-0.5 font-medium text-ink">{id}</span>. You only need it to
        request the maintainer role.
      </span>
      <button
        onClick={() =>
          navigator.clipboard?.writeText(id).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
        }
        className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 hover:border-brand"
      >
        {copied ? <Check className="h-3 w-3 text-brand" /> : <Copy className="h-3 w-3" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </p>
  )
}

function DisplayNameCard() {
  const { data: profile, isLoading } = useProfile()
  return (
    <Card title="Display name" hint={DISPLAY_NAME_HINT}>
      {isLoading || !profile ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <DisplayNameEditor current={profile.name} />
      )}
    </Card>
  )
}

function LinksCard() {
  const { data: profile, isLoading } = useProfile()
  return (
    <Card
      title="Public links"
      hint="Optional. Shown next to your name so others can find, credit and reach you. Add only what you’re happy to share."
    >
      {isLoading || !profile ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <LinksEditor initial={profile.links} />
      )}
    </Card>
  )
}

function EmailNotificationsCard({ isMaintainer }: { isMaintainer: boolean }) {
  const { data: profile, isLoading } = useProfile()
  return (
    <Card
      title="Email notifications"
      hint="Everything also appears in your dashboard. If your sign-in provider shared an address, we filled it in; any address works."
    >
      {isLoading || !profile ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <EmailPrefsEditor
          initialEmail={profile.notificationEmail}
          initialPrefs={profile.emailPrefs}
          isMaintainer={isMaintainer}
        />
      )}
    </Card>
  )
}

function EmailPrefsEditor({
  initialEmail,
  initialPrefs,
  isMaintainer,
}: {
  initialEmail: string
  initialPrefs: EmailPrefs
  isMaintainer: boolean
}) {
  const update = useUpdateEmailPrefs()
  const [email, setEmail] = useState(initialEmail)
  const [prefs, setPrefs] = useState<EmailPrefs>(initialPrefs)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const options = EMAIL_PREF_OPTIONS.filter((o) => !o.maintainerOnly || isMaintainer)
  const emailValid = isValidEmail(email)
  const dirty =
    email !== initialEmail || options.some((o) => (prefs[o.key] === true) !== (initialPrefs[o.key] === true))

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
          setError(e instanceof ApiError ? e.message : 'Could not save your email settings.'),
      },
    )
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Send emails to</span>
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

      {!emailValid ? (
        <p className="text-sm text-muted-foreground">
          Email notifications are off. Add an address to choose what to receive.
        </p>
      ) : (
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Email me about</legend>
        <div className="space-y-2.5">
          {options.map((o) => (
            <label key={o.key} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={prefs[o.key] === true}
                onChange={(e) => setPrefs((p) => ({ ...p, [o.key]: e.target.checked }))}
                className="mt-1 accent-[var(--color-brand)]"
              />
              <span>
                {o.label}
                <span className="block text-xs text-muted-foreground">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={save}
          disabled={update.isPending || !emailValid || !dirty}
          title={emailValid ? undefined : 'Enter a valid email address first.'}
          className="btn-primary"
        >
          {update.isPending ? 'Saving…' : 'Save email settings'}
        </button>
        {saved && (
          <span role="status" className="text-sm text-brand-deep">
            Saved
          </span>
        )}
      </div>
    </div>
  )
}

function DangerZone() {
  const navigate = useNavigate()
  const del = useDeleteAccount()
  const [confirming, setConfirming] = useState(false)

  async function remove() {
    await del.mutateAsync()
    await signOut()
    navigate('/nominations')
  }

  return (
    <Card
      title="Delete account"
      tone="danger"
      hint="Erases your login and personal details. Your nominations, votes, contributions and messages stay as public records under “Deleted account”."
    >
      <p className="mb-3 text-sm text-muted-foreground">This cannot be undone.</p>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">Are you sure?</span>
          <button
            onClick={remove}
            disabled={del.isPending}
            className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-60"
          >
            {del.isPending ? 'Deleting…' : 'Yes, delete my account'}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-sm text-muted-foreground hover:text-ink"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="btn-secondary text-destructive!"
        >
          Delete my account
        </button>
      )}
    </Card>
  )
}
