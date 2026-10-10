import { useState } from 'react'
import { Dices } from 'lucide-react'
import { ApiError } from '@/lib/api'
import { useNameSuggestion, useUpdateName } from './api'

export const DISPLAY_NAME_HINT =
  'How you appear on your nominations, comments and contributions. We encourage your real name — it makes collaborating and crediting work easier — and started you off with the one from your sign-in where we had it. Prefer a pseudonym? Hit Randomize for a suggestion, then Save. Names are unique across the site.'

/** Edit the display name, with a Randomize button that suggests a pseudonym. */
export function DisplayNameEditor({ current }: { current: string }) {
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
      onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not save your name.'),
    })
  }

  // Only fills the input — the user still has to hit Save.
  function roll() {
    setError('')
    suggest.mutate(undefined, {
      onSuccess: (res) => setName(res.name),
      onError: () => setError('Could not generate a suggestion. Try again.'),
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          aria-label="Display name"
          className="input max-w-72"
        />
        <button
          type="button"
          onClick={save}
          disabled={update.isPending || name.trim().length < 3 || name === current}
          className="rounded-md bg-green px-3 py-2 text-sm font-medium text-white hover:bg-forest disabled:opacity-60"
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={roll}
          disabled={suggest.isPending}
          title="Suggest a random pseudonym"
          className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-2 text-sm font-medium hover:border-green disabled:opacity-60"
        >
          <Dices className="h-4 w-4" />
          {suggest.isPending ? 'Rolling…' : 'Randomize'}
        </button>
        {name !== current && !suggest.isPending && (
          <button
            type="button"
            onClick={() => setName(current)}
            className="text-xs text-muted-foreground underline hover:text-ink"
          >
            Reset
          </button>
        )}
        {saved && <span className="text-xs text-green">Saved</span>}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
