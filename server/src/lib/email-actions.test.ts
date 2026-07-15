import { describe, it, expect } from 'vitest'
import { signReviewToken, verifyReviewToken } from './email-actions'

const NOM = 'e94b5a89-a763-4ac7-b570-6bf2adefb25b'
const ADMIN = 'admin-uid-123'

describe('review tokens', () => {
  it('round-trips the nomination and admin ids', () => {
    const token = signReviewToken(NOM, ADMIN)
    expect(verifyReviewToken(token)).toEqual({ nominationId: NOM, adminUid: ADMIN })
  })

  it('rejects a tampered payload', () => {
    const token = signReviewToken(NOM, ADMIN)
    const [payload, sig] = token.split('.')
    const other = Buffer.from(
      JSON.stringify({ n: NOM, u: 'someone-else', exp: Date.now() + 1000 }),
    ).toString('base64url')
    expect(verifyReviewToken(`${other}.${sig}`)).toBeNull()
    expect(verifyReviewToken(`${payload}.${sig}x`)).toBeNull()
  })

  it('rejects garbage and empty tokens', () => {
    expect(verifyReviewToken('')).toBeNull()
    expect(verifyReviewToken('not-a-token')).toBeNull()
    expect(verifyReviewToken('a.b')).toBeNull()
  })

  it('expires after 14 days', () => {
    const issued = Date.now()
    const token = signReviewToken(NOM, ADMIN, issued)
    const thirteenDays = issued + 13 * 24 * 60 * 60 * 1000
    const fifteenDays = issued + 15 * 24 * 60 * 60 * 1000
    expect(verifyReviewToken(token, thirteenDays)).not.toBeNull()
    expect(verifyReviewToken(token, fifteenDays)).toBeNull()
  })
})
