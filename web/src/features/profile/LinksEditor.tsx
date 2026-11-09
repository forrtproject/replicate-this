import { useState } from 'react'
import { X } from 'lucide-react'
import { ApiError } from '@/lib/api'
import { PROFILE_LINKS, type ProfileLinkKey, type ProfileLinks } from '@/types'
import { LinkIcon } from './LinkIcon'
import { useUpdateLinks } from './api'

/**
 * Public profile links. ORCID and a personal website always get a field; every
 * other profile (Bluesky, Mastodon, GitHub, …) is one click on its logo away,
 * so the form stays short for people who only want the essentials. Handles are
 * fine — the server turns "@you.bsky.social" or a bare ORCID iD into a URL.
 */
export function LinksEditor({ initial }: { initial: ProfileLinks }) {
  const update = useUpdateLinks()
  const [links, setLinks] = useState<ProfileLinks>(initial)
  // Extra profiles shown as fields: the ones already filled in, plus any added.
  const [shown, setShown] = useState<ProfileLinkKey[]>(() =>
    PROFILE_LINKS.filter((l) => !l.primary && initial[l.key]).map((l) => l.key),
  )
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  // Compared with what was last saved, so Save is only live when there is a change.
  const [baseline, setBaseline] = useState<ProfileLinks>(initial)
  const dirty = PROFILE_LINKS.some(
    ({ key }) => (links[key] ?? '').trim() !== (baseline[key] ?? '').trim(),
  )

  const fields = PROFILE_LINKS.filter((l) => l.primary || shown.includes(l.key))
  const addable = PROFILE_LINKS.filter((l) => !l.primary && !shown.includes(l.key))

  function set(key: ProfileLinkKey, value: string) {
    setLinks((prev) => ({ ...prev, [key]: value }))
  }

  function remove(key: ProfileLinkKey) {
    setShown((s) => s.filter((k) => k !== key))
    set(key, '')
  }

  function save() {
    setError('')
    const cleaned: ProfileLinks = {}
    for (const { key } of PROFILE_LINKS) {
      const v = links[key]?.trim()
      if (v) cleaned[key] = v
    }
    update.mutate(cleaned, {
      // Show the canonical form the server stored (e.g. a full ORCID URL).
      onSuccess: (res) => {
        setLinks(res.links)
        setBaseline(res.links)
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
      },
      onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not save links.'),
    })
  }

  return (
    <div className="space-y-2.5">
      {fields.map(({ key, label, placeholder, primary }) => (
        <label key={key} className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-2 font-medium text-ink">
            <LinkIcon kind={key} mono={key !== 'orcid'} className="h-4 w-4 text-muted-foreground" />
            {label}
          </span>
          <input
            value={links[key] ?? ''}
            onChange={(e) => set(key, e.target.value)}
            placeholder={placeholder}
            className="input"
          />
          {primary ? (
            <span className="w-6" />
          ) : (
            <button
              type="button"
              onClick={() => remove(key)}
              aria-label={`Remove ${label}`}
              className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
      ))}

      {addable.length > 0 && (
        <label className="block pt-1">
          <span className="sr-only">Add another profile</span>
          <select
            value=""
            onChange={(e) => {
              const key = e.target.value as ProfileLinkKey
              if (key) setShown((s) => [...s, key])
            }}
            className="input max-w-64"
          >
            <option value="">Add another profile…</option>
            {addable.map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={update.isPending || !dirty}
          className="btn-primary"
        >
          {update.isPending ? 'Saving…' : 'Save links'}
        </button>
        {saved && (
          <span role="status" className="text-sm text-forest">
            Saved
          </span>
        )}
      </div>
    </div>
  )
}
