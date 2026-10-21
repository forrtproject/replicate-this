import { describe, it, expect } from 'vitest'
import { yearError } from './reference'

const now = new Date('2026-10-21')

describe('yearError', () => {
  it('accepts an empty field and ordinary years', () => {
    expect(yearError('', now)).toBeNull()
    expect(yearError('2015', now)).toBeNull()
    expect(yearError('1600', now)).toBeNull()
  })

  it('accepts next year for forthcoming papers', () => {
    expect(yearError('2027', now)).toBeNull()
  })

  it('rejects malformed and impossible years', () => {
    expect(yearError('15', now)).toMatch(/four digits/)
    expect(yearError('2015-03', now)).toMatch(/four digits/)
    expect(yearError('9999', now)).toMatch(/between 1600 and 2027/)
    expect(yearError('1599', now)).toMatch(/between/)
  })
})
