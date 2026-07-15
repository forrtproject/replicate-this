import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Check, Dices } from 'lucide-react'
import { useSession, signOut } from '@/lib/auth-client'
import {
  useProfile,
  useUpdateLinks,
  useUpdateName,
  useNameSuggestion,
  useUpdateEmailPrefs,
  useDeleteAccount,
} from '@/features/profile/api'
import { ApiError } from '@/lib/api'
import {
  PROFILE_LINKS,
  EMAIL_PREF_OPTIONS,
  type EmailPrefs,
  type ProfileLinkKey,
  type ProfileLinks,
} from '@/types'

export function ProfilePage() {
  const { data: session } = useSession()
  const researcherId = session?.user?.id?.slice(0, 6) ?? ''

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div>
        <p className="eyebrow">Your account</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Profile</h1>
      </div>

      <ResearcherIdCard id={researcherId} />
      <PseudonymCard />
      <LinksCard />
      <EmailNotificationsCard
        isMaintainer={(session?.user as { role?: string } | undefined)?.role === 'maintainer'}
      />
      <DangerZone />
    </div>
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

function ResearcherIdCard({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Card
      title="Researcher ID"
      hint="Your pseudonymous identifier. Share it with a maintainer to request the admin role."
    >
      <div className="flex items-center gap-3">
        <span className="data text-xl font-semibold">#{id}</span>
        <button
          onClick={() =>
            navigator.clipboard?.writeText(`#${id}`).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            })
          }
          className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs font-medium hover:border-green"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </Card>
  )
}

function PseudonymCard() {
  const { data: profile, isLoading } = useProfile()
  return (
    <Card
      title="Pseudonym"
      hint="How you appear on your nominations, comments and contributions. You got a random one at sign-up — change it to anything that isn’t taken, or use Randomize for a suggestion and hit Save to keep it. Pseudonyms are unique across the site."
    >
      {isLoading || !profile ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <PseudonymEditor current={profile.name} />
      )}
    </Card>
  )
}

function PseudonymEditor({ current }: { current: string }) {
  const update = useUpdateName()
  const suggest = useNameSuggestion()
  const [name, setName] = useState(current)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function save() {
    setError('')
    update.mutate(name, {
      onSuccess: () => {
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
      },
      onError: (e) =>
        setError(e instanceof ApiError ? e.message : 'Could not save your pseudonym.'),
    })
  }

  // Only fills the input — the user still has to hit Save.
  function roll() {
    setError('')
    suggest.mutate(undefined, {
      onSuccess: (res) => setName(res.name),
      onError: () => setError('Could not generate a pseudonym. Try again.'),
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          className="input max-w-64"
        />
        <button
          onClick={save}
          disabled={update.isPending || name.trim().length < 3 || name === current}
          className="rounded-md bg-green px-3 py-2 text-sm font-medium text-white hover:bg-forest disabled:opacity-60"
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={roll}
          disabled={suggest.isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-2 text-sm font-medium hover:border-green disabled:opacity-60"
        >
          <Dices className="h-4 w-4" />
          {suggest.isPending ? 'Rolling…' : 'Randomize'}
        </button>
        {saved && <span className="text-xs text-green">Saved</span>}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

function LinksCard() {
  const { data: profile, isLoading } = useProfile()
  return (
    <Card
      title="Contact links"
      hint="Optional public links shown on your nominations and contributions, so others can reach you. Add only what you're happy to share."
    >
      {isLoading || !profile ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <LinksEditor initial={profile.links} />
      )}
    </Card>
  )
}

function LinksEditor({ initial }: { initial: ProfileLinks }) {
  const update = useUpdateLinks()
  const [links, setLinks] = useState<ProfileLinks>(initial)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function set(key: ProfileLinkKey, value: string) {
    setLinks((prev) => ({ ...prev, [key]: value }))
  }

  function save() {
    setError('')
    const cleaned: ProfileLinks = {}
    for (const { key } of PROFILE_LINKS) {
      const v = links[key]?.trim()
      if (v) cleaned[key] = v
    }
    update.mutate(cleaned, {
      onSuccess: () => {
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
      },
      onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not save links.'),
    })
  }

  return (
    <div className="space-y-2.5">
      {PROFILE_LINKS.map(({ key, label, placeholder }) => (
        <label key={key} className="grid grid-cols-[7rem_1fr] items-center gap-3 text-sm">
          <span className="text-muted-foreground">{label}</span>
          <input
            value={links[key] ?? ''}
            onChange={(e) => set(key, e.target.value)}
            placeholder={placeholder}
            className="input"
          />
        </label>
      ))}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={save}
          disabled={update.isPending}
          className="rounded-md bg-green px-3 py-2 text-sm font-medium text-white hover:bg-forest disabled:opacity-60"
        >
          {update.isPending ? 'Saving…' : 'Save links'}
        </button>
        {saved && <span className="text-xs text-green">Saved</span>}
      </div>
    </div>
  )
}

function EmailNotificationsCard({ isMaintainer }: { isMaintainer: boolean }) {
  const { data: profile, isLoading } = useProfile()
  return (
    <Card
      title="Email notifications"
      hint="Entirely optional — everything also arrives as an in-app notification. We never email your login address; add an address here only if you want emails, and clear it any time to stop them."
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
  const emailSet = email.trim().length > 0

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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@university.edu (leave empty for no emails)"
          className="input max-w-80"
        />
      </label>

      <fieldset className={emailSet ? '' : 'opacity-50'}>
        <legend className="mb-1.5 text-sm text-muted-foreground">Email me about</legend>
        <div className="space-y-1.5">
          {options.map((o) => (
            <label key={o.key} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={prefs[o.key] === true}
                disabled={!emailSet}
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
          disabled={update.isPending}
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
    navigate('/registry')
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
