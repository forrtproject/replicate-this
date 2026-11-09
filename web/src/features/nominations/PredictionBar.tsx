import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useSession } from '@/lib/auth-client'
import { useToast } from '@/lib/toast'
import { savePendingAction, takePendingAction } from '@/lib/pending-action'
import { useSetPrediction } from './api'
import { FORECAST_CONSENSUS_MIN, forecastSummary } from './verification'
import type { VerificationType } from '@/types'

interface Props {
  nominationId: string
  verificationType: VerificationType
  predictYes: number
  predictNo: number
  userPrediction: boolean | null
  /** The check is done: show the forecast as it stood, without voting. */
  closed?: boolean
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
  closed = false,
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

  // Plain-language read of the split, worded for how many responses there are.
  const consensus = forecastSummary(verificationType, yes, no)
  // With only a handful of responses a percentage or a bar overstates them:
  // show counts, and draw the bar only once there are enough to mean something.
  const few = total < FORECAST_CONSENSUS_MIN

  if (closed) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        {total === 0 ? (
          'No one made a prediction before the result.'
        ) : (
          <>
            Before the result: <span className="data font-medium text-ink">{yes}</span> said yes,{' '}
            <span className="data font-medium text-ink">{no}</span> said no.
          </>
        )}
      </p>
    )
  }

  return (
    <div className="mt-3">
      {!few && (
        <div className="mb-2 flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="bg-green" style={{ width: `${yesPct}%` }} />
          <div className="bg-[#c9c4b6]" style={{ width: `${100 - yesPct}%` }} />
        </div>
      )}

      <div className="flex gap-2">
        <PredictButton active={mine === true} onClick={() => choose(true)}>
          Yes {total > 0 && <span className="data font-normal text-muted-foreground">{few ? yes : `${yesPct}%`}</span>}
        </PredictButton>
        <PredictButton active={mine === false} onClick={() => choose(false)}>
          No {total > 0 && <span className="data font-normal text-muted-foreground">{few ? no : `${100 - yesPct}%`}</span>}
        </PredictButton>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {consensus}
        {mine !== null && (
          <>
            {' '}
            You said <span className="font-medium text-ink">{mine ? 'yes' : 'no'}</span>.
          </>
        )}
      </p>
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
        'inline-flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-green bg-green-tint text-forest'
          : 'border-line text-ink hover:border-green',
      )}
    >
      {children}
    </button>
  )
}
