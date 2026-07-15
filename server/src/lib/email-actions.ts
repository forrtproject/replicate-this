import { createHmac, timingSafeEqual } from 'node:crypto'
import { config } from '@/lib/env'

/**
 * Signed, expiring tokens for one-click moderation from email. A token grants
 * a single maintainer the ability to approve/reject a single nomination —
 * nothing else — and the holder's maintainer role is re-checked when the
 * link is used.
 */

const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000 // links stay valid for 14 days

export interface ReviewTokenPayload {
  nominationId: string
  adminUid: string
}

const b64url = (buf: Buffer) => buf.toString('base64url')

function sign(payload: string): string {
  return b64url(createHmac('sha256', config.betterAuthSecret).update(payload).digest())
}

export function signReviewToken(
  nominationId: string,
  adminUid: string,
  now: number = Date.now(),
): string {
  const payload = b64url(
    Buffer.from(JSON.stringify({ n: nominationId, u: adminUid, exp: now + TOKEN_TTL_MS })),
  )
  return `${payload}.${sign(payload)}`
}

export function verifyReviewToken(
  token: string,
  now: number = Date.now(),
): ReviewTokenPayload | null {
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null

  const expected = Buffer.from(sign(payload))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      n?: unknown
      u?: unknown
      exp?: unknown
    }
    if (typeof data.n !== 'string' || typeof data.u !== 'string' || typeof data.exp !== 'number') {
      return null
    }
    if (now > data.exp) return null
    return { nominationId: data.n, adminUid: data.u }
  } catch {
    return null
  }
}

/** URL of the email review page for one maintainer + nomination. */
export function reviewUrl(nominationId: string, adminUid: string, action?: 'approve' | 'reject') {
  const token = signReviewToken(nominationId, adminUid)
  const suffix = action ? `?action=${action}` : ''
  return `${config.betterAuthUrl}/api/email-actions/review/${token}${suffix}`
}
