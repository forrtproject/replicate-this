import { beforeEach, describe, expect, it } from 'vitest'
import {
  PENDING_ACTION_TTL_MS,
  armPendingAction,
  clearPendingAction,
  disarmPendingAction,
  savePendingAction,
  takePendingAction,
} from './pending-action'

const upvote = { kind: 'upvote', nominationId: 'n1' } as const
const t0 = 1_000_000

describe('pending action', () => {
  beforeEach(() => sessionStorage.clear())

  it('runs once, after sign-in started, on the same page and study', () => {
    savePendingAction(upvote, '/nominations/n1', t0)
    armPendingAction()
    expect(takePendingAction('upvote', 'n1', '/nominations/n1', t0 + 1000)).toEqual(upvote)
    expect(takePendingAction('upvote', 'n1', '/nominations/n1', t0 + 2000)).toBeNull()
  })

  it('never runs if no sign-in was started', () => {
    savePendingAction(upvote, '/nominations/n1', t0)
    expect(takePendingAction('upvote', 'n1', '/nominations/n1', t0 + 1000)).toBeNull()
  })

  it('expires', () => {
    savePendingAction(upvote, '/nominations/n1', t0)
    armPendingAction()
    expect(
      takePendingAction('upvote', 'n1', '/nominations/n1', t0 + PENDING_ACTION_TTL_MS + 1),
    ).toBeNull()
  })

  it('is dropped when the person lands on a different page', () => {
    savePendingAction(upvote, '/nominations/n1', t0)
    armPendingAction()
    expect(takePendingAction('upvote', 'n1', '/dashboard', t0 + 1000)).toBeNull()
    // Gone for good, even back on the original page.
    expect(takePendingAction('upvote', 'n1', '/nominations/n1', t0 + 2000)).toBeNull()
  })

  it('leaves it for the right study when another card on the page asks', () => {
    savePendingAction(upvote, '/nominations', t0)
    armPendingAction()
    expect(takePendingAction('upvote', 'n2', '/nominations', t0 + 1000)).toBeNull()
    expect(takePendingAction('predict', 'n1', '/nominations', t0 + 1000)).toBeNull()
    expect(takePendingAction('upvote', 'n1', '/nominations', t0 + 1000)).toEqual(upvote)
  })

  it('still runs when a failed sign-in is retried', () => {
    savePendingAction(upvote, '/nominations/n1', t0)
    armPendingAction()
    disarmPendingAction() // first provider failed or the popup was closed
    armPendingAction() // tried again
    expect(takePendingAction('upvote', 'n1', '/nominations/n1', t0 + 1000)).toEqual(upvote)
  })

  it('never runs if sign-in failed and was not retried', () => {
    savePendingAction(upvote, '/nominations/n1', t0)
    armPendingAction()
    disarmPendingAction()
    expect(takePendingAction('upvote', 'n1', '/nominations/n1', t0 + 1000)).toBeNull()
  })

  it('can be cleared', () => {
    savePendingAction(upvote, '/nominations/n1', t0)
    armPendingAction()
    clearPendingAction()
    expect(takePendingAction('upvote', 'n1', '/nominations/n1', t0 + 1000)).toBeNull()
  })
})
