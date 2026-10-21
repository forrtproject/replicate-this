import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useSession } from '@/lib/auth-client'
import { useToast } from '@/lib/toast'
import { savePendingAction, takePendingAction } from '@/lib/pending-action'
import { useSetPrediction } from './api'
import { FORECAST_CONSENSUS_MIN, FORECAST_QUESTION, forecastSummary } from './verification'
import type { VerificationType } from '@/types'

interface Props {
  nominationId: string
  verificationType: VerificationType
  predictYes: number
  predictNo: number
  userPrediction: boolean | null
}

/**
 * Yes/no forecast with a distribution bar. The question follows the requested
 * check ("Will it replicate?" / "Will the results prove robust?").
 */
export function PredictionBar({
  nominationId,
  verificationType,
  predictYes,
  predictNo,
  userPrediction,
}: Props) {
  const { data: session } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const setPrediction = useSetPrediction(nominationId)
  // mutateAsync, not mutate's callbacks: those are skipped if the component
  // remounts mid-request, which would save the answer without confirming it.
  const { mutateAsync: savePrediction } = setPrediction
  const toast = useToast()
  const [optimistic, setOptimistic] = useState<
    { mine: boolean | null; yes: number; no: number } | null
  >(null)

  const mine = optimistic ? optimistic.mine : userPrediction
  const yes = optimistic?.yes ?? predictYes
  const no = optimistic?.no ?? predictNo
  const total = yes + no
  const yesPct = total === 0 ? 0 : Math.round((yes / total) * 100)

  // Back from signing in after picking Yes/No while signed out: record that
  // answer (a set, not a toggle) and say so, with Undo back to what was there.
  useEffect(() => {
    if (!session) return
    const pending = takePendingAction('predict', nominationId, location.pathname)
    if (!pending) return
    const label = pending.value ? 'Yes' : 'No'
    savePrediction(pending.value)
      .then((res) =>
        toast(
          res.previous === pending.value
            ? { message: `Your prediction was already ${label}.` }
            : {
                message: `Your prediction was saved: ${label}.`,
                action: {
                  label: 'Undo',
                  onAction: () => void savePrediction(res.previous).catch(() => {}),
                },
              },
        ),
      )
      .catch(() => toast({ message: 'Your prediction couldn’t be saved. Please try again.' }))
  }, [session, nominationId, location.pathname, savePrediction, toast])

  function choose(value: boolean) {
    // Signed out: remember the answer, sign in, and record it on return.
    if (!session) {
      savePendingAction({ kind: 'predict', nominationId, value }, location.pathname)
      navigate(`/sign-in?redirect=${encodeURIComponent(location.pathname + location.search)}`)
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

  const forecast = FORECAST_QUESTION[verificationType] ?? FORECAST_QUESTION.replication
  // Plain-language read of the split, worded for how many responses there are.
  const consensus = forecastSummary(verificationType, yes, no)
  // With only a handful of responses a percentage overstates them: show counts.
  const few = total < FORECAST_CONSENSUS_MIN

  return (
    <div className="flex flex-1 flex-col">
      <div className="space-y-1.5">
        {/* h-7 matches the interest panel's label row, so both bars land on one line. */}
        <div className="flex h-7 items-baseline justify-between text-xs text-muted-foreground">
          <span>{forecast.question}</span>
          <span>
            <span className="data">{total}</span>{' '}
            {total === 1 ? 'prediction' : 'predictions'}
          </span>
        </div>

        {/* Empty until someone predicts; otherwise a zero-response bar reads as all "No". */}
        <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          {total > 0 && (
            <>
              <div className="bg-green transition-all" style={{ width: `${yesPct}%` }} />
              <div className="bg-amber transition-all" style={{ width: `${100 - yesPct}%` }} />
            </>
          )}
        </div>

        <div className="flex gap-2">
          <PredictButton active={mine === true} onClick={() => choose(true)}>
            Yes {total > 0 && <span className="data">· {few ? yes : `${yesPct}%`}</span>}
          </PredictButton>
          <PredictButton active={mine === false} onClick={() => choose(false)}>
            No {total > 0 && <span className="data">· {few ? no : `${100 - yesPct}%`}</span>}
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
