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

export function ProfilePage() {
  const { data: session } = useSession()
  const researcherId = session?.user?.id?.slice(0, 6) ?? ''
  const token = session?.user?.id?.slice(0, 8) ?? ''

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow">Your account</p>
          <h1 className="mt-1 font-display text-3xl font-semibold">Profile</h1>
        </div>
        {token && (
          <Link to={`/researchers/${token}`} className="text-sm text-green hover:underline">
            View your public profile →
          </Link>
        )}
      </div>

      <AvatarCard />
      <DisplayNameCard />
      <LinksCard />
      <EmailNotificationsCard
        isMaintainer={(session?.user as { role?: string } | undefined)?.role === 'maintainer'}
      />
      <ResearcherIdFooter id={researcherId} />
      <DangerZone />
    </div>
  )
}

function AvatarCard() {
  const { data: profile, isLoading } = useProfile()
  return (
    <Card
      title="Profile photo"
      hint="Pick an emoji or upload a picture. It appears on your profile and next to your name on replication teams."
    >
      {isLoading || !profile ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <AvatarEditor current={profile.image} name={profile.name} />
      )}
    </Card>
  )
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-card p-5">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {hint && <p className="mb-3 mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className={hint ? '' : 'mt-3'}>{children}</div>
    </section>
  )
}

// Deliberately low-key: the pseudonym is your identity now. The Researcher ID
// only matters for the rare "ask a maintainer for admin" flow, so it lives as a
// small muted line rather than a prominent card.
function ResearcherIdFooter({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <p className="flex flex-wrap items-center gap-2 px-1 text-xs text-muted-foreground">
      <span>
        Researcher ID <span className="data font-medium">#{id}</span> — only needed to request
        the maintainer role.
      </span>
      <button
        onClick={() =>
          navigator.clipboard?.writeText(`#${id}`).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
        }
        className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 hover:border-green"
      >
        {copied ? <Check className="h-3 w-3 text-green" /> : <Copy className="h-3 w-3" />}
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
      title="Public profile links"
      hint="Optional links shown on your public profile, nominations and contributions, so others can find, credit and reach you. Add only what you're happy to share."
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
      hint="Where we email you about activity on the site. We take this from your sign-in — change it to any address you prefer. Everything also arrives as an in-app notification, so uncheck anything you'd rather not hear about by email."
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
        <span className="mb-1 block text-muted-foreground">Notification email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@university.edu"
          className="input max-w-80"
        />
      </label>

      <fieldset>
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

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={update.isPending || !emailValid}
          title={emailValid ? undefined : 'Enter a valid email address first.'}
          className="rounded-md bg-green px-3 py-2 text-sm font-medium text-white hover:bg-forest disabled:opacity-60"
        >
          {update.isPending ? 'Saving…' : 'Save email settings'}
        </button>
        {saved && <span className="text-xs text-green">Saved</span>}
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
    <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
      <h2 className="font-display text-lg font-semibold text-destructive">Delete account</h2>
      <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
        Signs you out for good and erases your login and personal details (name, links,
        provider). Your nominations, votes, contributions and messages are kept as public
        scientific records, shown as “Deleted account.” This cannot be undone.
      </p>
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
          className="rounded-md border border-destructive/40 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
        >
          Delete my account
        </button>
      )}
    </section>
  )
}
