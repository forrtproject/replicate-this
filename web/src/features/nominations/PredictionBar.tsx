import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useSession } from '@/lib/auth-client'
import { useSetPrediction } from './api'

interface Props {
  nominationId: string
  predictYes: number
  predictNo: number
  userPrediction: boolean | null
}

/** "Will it replicate?" yes/no prediction with a distribution bar. */
export function PredictionBar({
  nominationId,
  predictYes,
  predictNo,
  userPrediction,
}: Props) {
  const { data: session } = useSession()
  const navigate = useNavigate()
  const setPrediction = useSetPrediction(nominationId)
  const [optimistic, setOptimistic] = useState<
    { mine: boolean | null; yes: number; no: number } | null
  >(null)

  const mine = optimistic ? optimistic.mine : userPrediction
  const yes = optimistic?.yes ?? predictYes
  const no = optimistic?.no ?? predictNo
  const total = yes + no
  const yesPct = total === 0 ? 0 : Math.round((yes / total) * 100)

  function choose(value: boolean) {
    if (!session) {
      navigate(`/sign-in?redirect=/nominations/${nominationId}`)
      return
    }
    // null clears it when re-clicking the current choice
    const next = mine === value ? null : value
    let y = predictYes
    let n = predictNo
    if (userPrediction === true) y -= 1
    if (userPrediction === false) n -= 1
    if (next === true) y += 1
    if (next === false) n += 1
    setOptimistic({ mine: next, yes: y, no: n })
    setPrediction.mutate(next, { onSettled: () => setOptimistic(null) })
  }

  // Plain-language read of the split, so the numbers don't have to be decoded.
  const consensus =
    total === 0
      ? 'Predictions are anonymous and you can change yours any time.'
      : yesPct >= 65
        ? 'Most expect this to replicate.'
        : yesPct <= 35
          ? 'Most expect this not to replicate.'
          : 'Researchers are split on this one.'

  return (
    <div className="flex flex-1 flex-col">
      <div className="space-y-1.5">
        {/* h-7 matches the interest panel's label row, so both bars land on one line. */}
        <div className="flex h-7 items-baseline justify-between text-xs text-muted-foreground">
          <span>Will it replicate?</span>
          <span>
            <span className="data">{total}</span>{' '}
            {total === 1 ? 'prediction' : 'predictions'}
          </span>
        </div>

        <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="bg-green transition-all" style={{ width: `${yesPct}%` }} />
          <div className="bg-amber transition-all" style={{ width: `${100 - yesPct}%` }} />
        </div>

        <div className="flex gap-2">
          <PredictButton active={mine === true} onClick={() => choose(true)}>
            Yes {total > 0 && <span className="data">· {yesPct}%</span>}
          </PredictButton>
          <PredictButton active={mine === false} onClick={() => choose(false)}>
            No {total > 0 && <span className="data">· {100 - yesPct}%</span>}
          </PredictButton>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-4 text-xs text-muted-foreground">
        <span>{consensus}</span>
        {mine !== null && (
          <span>
            Your call: <span className="font-medium text-ink">{mine ? 'Yes' : 'No'}</span>
          </span>
        )}
      </div>
    </div>
  )
}

function PredictButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-green bg-green-tint text-forest'
          : 'border-line text-muted-foreground hover:border-green hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}
