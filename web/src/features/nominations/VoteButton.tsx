import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSession } from '@/lib/auth-client'
import { useToggleVote } from './api'

interface Props {
  nominationId: string
  upvotes: number
  userUpvoted: boolean
}

/** "I want to see this replicated." Upvote-only toggle, optimistic. */
export function VoteButton({ nominationId, upvotes, userUpvoted }: Props) {
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

  return (
    <button
      onClick={handleClick}
      aria-pressed={on}
      aria-label={on ? 'Remove your upvote' : 'Upvote — want this replicated'}
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
