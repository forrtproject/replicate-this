/**
 * An upvote or forecast someone clicked while signed out, kept so it can be
 * finished once they have signed in instead of making them find the button
 * again. It is used at most once, and only when all of these hold:
 *
 * - it is armed: the person actually started a sign-in (the sign-in page arms
 *   it); clicking and then wandering off never casts anything;
 * - it is recent (ten minutes);
 * - they are back on the page they clicked it on, for the same study.
 *
 * Kept in sessionStorage, so it never outlives the tab.
 */
export type PendingAction =
  | { kind: 'upvote'; nominationId: string }
  | { kind: 'predict'; nominationId: string; value: boolean }

interface Stored {
  action: PendingAction
  path: string
  at: number
  armed: boolean
}

const KEY = 'rt:pending-action'
export const PENDING_ACTION_TTL_MS = 10 * 60_000

function read(): Stored | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Stored) : null
  } catch {
    return null
  }
}

function write(value: Stored | null) {
  try {
    if (value) sessionStorage.setItem(KEY, JSON.stringify(value))
    else sessionStorage.removeItem(KEY)
  } catch {
    // Storage unavailable: the action simply isn't resumed.
  }
}

/** Remember an action clicked while signed out, on the page at `path`. */
export function savePendingAction(action: PendingAction, path: string, now = Date.now()) {
  write({ action, path, at: now, armed: false })
}

/** Called when a sign-in actually starts: only then may the action run. */
export function armPendingAction() {
  const stored = read()
  if (stored) write({ ...stored, armed: true })
}

/**
 * Called when a sign-in attempt fails or is closed. The action stays, so
 * retrying with another provider still finishes it, but it won't run unless a
 * sign-in is started again.
 */
export function disarmPendingAction() {
  const stored = read()
  if (stored) write({ ...stored, armed: false })
}

/** Forget it, e.g. when sign-in failed or was cancelled. */
export function clearPendingAction() {
  write(null)
}

/**
 * Hands back the action for this study and kind if it may run now, removing
 * it so it runs once. Anything stale, unarmed or from another page is dropped.
 */
export function takePendingAction<K extends PendingAction['kind']>(
  kind: K,
  nominationId: string,
  path: string,
  now = Date.now(),
): Extract<PendingAction, { kind: K }> | null {
  const stored = read()
  if (!stored) return null
  if (!stored.armed || now - stored.at > PENDING_ACTION_TTL_MS || stored.path !== path) {
    write(null)
    return null
  }
  if (stored.action.kind !== kind || stored.action.nominationId !== nominationId) return null
  write(null)
  return stored.action as Extract<PendingAction, { kind: K }>
}
