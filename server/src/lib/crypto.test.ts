import { describe, it, expect } from 'vitest'
import { hashWithPepper, deterministicEmail } from './crypto'

describe('hashWithPepper', () => {
  it('produces a 64-char lowercase hex string', () => {
    const result = hashWithPepper('input', 'pepper')
    expect(result).toHaveLength(64)
    expect(result).toMatch(/^[a-f0-9]+$/)
  })

  it('is deterministic for the same input and pepper', () => {
    expect(hashWithPepper('same', 'pepper')).toBe(hashWithPepper('same', 'pepper'))
  })

  it('differs when the pepper changes', () => {
    expect(hashWithPepper('same', 'p1')).not.toBe(hashWithPepper('same', 'p2'))
  })
})

describe('deterministicEmail', () => {
  it('ends in @privacy.forrt.org', () => {
    expect(deterministicEmail('user@example.com', 'pepper')).toMatch(
      /@privacy\.forrt\.org$/,
    )
  })

  it('is stable and case-insensitive on the real email', () => {
    const a = deterministicEmail('User@Example.com', 'pepper')
    const b = deterministicEmail('user@example.com ', 'pepper')
    expect(a).toBe(b)
  })

  it('differs for different real emails', () => {
    expect(deterministicEmail('a@x.com', 'p')).not.toBe(deterministicEmail('b@x.com', 'p'))
  })
})
