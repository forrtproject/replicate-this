import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronUp, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSession } from '@/lib/auth-client'
import { useToggleVote } from './api'

interface Props {
  nominationId: string
  upvotes: number
  userUpvoted: boolean
  /** 'tile' is the square counter used on registry cards; 'wide' is a full-width CTA. */
  variant?: 'tile' | 'wide'
}

/** "I want to see this replicated." Upvote-only toggle, optimistic. */
export function VoteButton({ nominationId, upvotes, userUpvoted, variant = 'tile' }: Props) {
  const { data: session } = useSession()
  const navigate = useNavigate()
  const toggle = useToggleVote(nominationId)
  const [optimistic, setOptimistic] = useState<{ on: boolean; n: number } | null>(null)

  const on = optimistic?.on ?? userUpvoted
  const count = optimistic?.n ?? upvotes

  function handleClick() {
    if (!session) {
      navigate('/sign-in?redirect=/registry')
      return
    }
    setOptimistic({ on: !on, n: count + (on ? -1 : 1) })
    toggle.mutate(undefined, { onSettled: () => setOptimistic(null) })
  }

  const label = on ? 'Remove your upvote' : 'Upvote — want this replicated'

  if (variant === 'wide') {
    return (
      <button
        onClick={handleClick}
        aria-pressed={on}
        aria-label={label}
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
            <Check className="h-4 w-4" strokeWidth={2.5} /> You want this replicated
          </>
        ) : (
          <>
            <ChevronUp className="h-4 w-4" strokeWidth={2.5} /> I want this replicated
          </>
        )}
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      aria-pressed={on}
      aria-label={label}
      className={cn(
        'flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-md border transition-colors',
        on
          ? 'border-green bg-green text-white'
          : 'border-line text-muted-foreground hover:border-green hover:text-green',
      )}
    >
      <ChevronUp className="h-4 w-4" strokeWidth={2.5} />
      <span className="data text-base font-semibold leading-none">{count}</span>
    </button>
  )
}
