import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronUp, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSession } from '@/lib/auth-client'
import { useToast } from '@/lib/toast'
import { savePendingAction, takePendingAction } from '@/lib/pending-action'
import { useSetUpvote, useToggleVote } from './api'
import { APPROACH_COPY } from './verification'
import type { VerificationType } from '@/types'

interface Props {
  nominationId: string
  upvotes: number
  userUpvoted: boolean
  /** Words the action for the requested check ("replicated" / "reproduced"). */
  verificationType: VerificationType
  /** 'tile' is the square counter used on registry cards; 'wide' is a full-width CTA. */
  variant?: 'tile' | 'wide'
}

/** "I want this replicated / reproduced." Upvote-only toggle, optimistic. */
export function VoteButton({
  nominationId,
  upvotes,
  userUpvoted,
  verificationType,
  variant = 'tile',
}: Props) {
  const { data: session } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const copy = APPROACH_COPY[verificationType] ?? APPROACH_COPY.both
  const toggle = useToggleVote(nominationId)
  // mutateAsync, not mutate's callbacks: those are skipped if the component
  // remounts mid-request, which would add the vote without confirming it.
  const { mutateAsync: setUpvote } = useSetUpvote(nominationId)
  const toast = useToast()
  const [optimistic, setOptimistic] = useState<{ on: boolean; n: number } | null>(null)

  // Back from signing in after clicking this while signed out: add the vote
  // (never toggle, so an existing vote can't be removed) and say so, with Undo.
  useEffect(() => {
    if (!session) return
    if (!takePendingAction('upvote', nominationId, location.pathname)) return
    setUpvote(true)
      .then((res) =>
        toast(
          res.already
            ? { message: 'You had already upvoted this study.' }
            : {
                message: 'Your upvote was added.',
                action: { label: 'Undo', onAction: () => void setUpvote(false).catch(() => {}) },
              },
        ),
      )
      .catch(() => toast({ message: 'Your upvote couldn’t be added. Please try again.' }))
  }, [session, nominationId, location.pathname, setUpvote, toast])

  const on = optimistic?.on ?? userUpvoted
  const count = optimistic?.n ?? upvotes

  function handleClick() {
    // Signed out: remember the vote, sign in, and come back to exactly this
    // page (study or filtered list), where it is added (see the effect above).
    if (!session) {
      savePendingAction({ kind: 'upvote', nominationId }, location.pathname)
      navigate(`/sign-in?redirect=${encodeURIComponent(location.pathname + location.search)}`)
      return
    }
    setOptimistic({ on: !on, n: count + (on ? -1 : 1) })
    toggle.mutate(undefined, { onSettled: () => setOptimistic(null) })
  }

  // A toggle keeps one name and reports on/off through aria-pressed. The tile's
  // name includes the count it shows, so what is heard matches what is seen.
  const tileLabel = `${copy.want}: ${count} ${count === 1 ? 'upvote' : 'upvotes'}`

  if (variant === 'wide') {
    return (
      <button
        onClick={handleClick}
        aria-pressed={on}
        className={cn(
          // py-1.5 matches the forecast panel's Yes/No buttons.
          'flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
          on
            ? 'border-green bg-green-tint text-forest hover:bg-muted'
            : 'border-line text-ink hover:border-green hover:text-green',
        )}
      >
        {on ? (
          <>
            <Check className="h-4 w-4" strokeWidth={2.5} /> {copy.wanted}
          </>
        ) : (
          <>
            <ChevronUp className="h-4 w-4" strokeWidth={2.5} /> {copy.want}
          </>
        )}
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      aria-pressed={on}
      aria-label={tileLabel}
      className={cn(
        'flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-md border transition-colors',
        on
          ? 'border-green bg-green text-white'
          : 'border-line text-muted-foreground hover:border-green hover:text-green',
      )}
    >
      <ChevronUp className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      <span className="data text-base font-semibold leading-none">{count}</span>
    </button>
  )
}
