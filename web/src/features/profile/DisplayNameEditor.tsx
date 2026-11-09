import { useState } from 'react'
import { Dices } from 'lucide-react'
import { ApiError } from '@/lib/api'
import { useNameSuggestion, useUpdateName } from './api'

export const DISPLAY_NAME_HINT =
  'Shown on your nominations, comments and study teams. A real name makes it easier to collaborate and credit work; a pseudonym is fine too. Names are unique on the site.'

/** Edit the display name, with a Randomize button that suggests a pseudonym. */
export function DisplayNameEditor({
  current,
  onDraftChange,
}: {
  current: string
  /**
   * Hands the edited name to a parent that saves it itself (the welcome flow
   * saves on Continue); the editor then shows no Save button of its own.
   */
  onDraftChange?: (name: string) => void
}) {
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
      onSuccess: (res) => {
        setName(res.name)
        onDraftChange?.(res.name)
      },
      onError: () => setError('Could not generate a suggestion. Try again.'),
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            onDraftChange?.(e.target.value)
          }}
          maxLength={50}
          aria-label="Display name"
          className="input max-w-72"
        />
        <button
          type="button"
          onClick={roll}
          disabled={suggest.isPending}
          className="btn-secondary"
        >
          <Dices className="h-4 w-4" aria-hidden />
          {suggest.isPending ? 'Suggesting…' : 'Suggest a pseudonym'}
        </button>
      </div>
      {!onDraftChange && (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={update.isPending || name.trim().length < 3 || name === current}
          className="btn-primary"
        >
          {update.isPending ? 'Saving…' : 'Save name'}
        </button>
        {saved ? (
          <span role="status" className="text-sm text-brand-deep">
            Saved
          </span>
        ) : name === current ? null : (
          <button
            type="button"
            onClick={() => setName(current)}
            className="text-sm text-muted-foreground underline hover:text-ink"
          >
            Undo
          </button>
        )}
      </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
