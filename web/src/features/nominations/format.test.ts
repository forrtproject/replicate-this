import { describe, it, expect } from 'vitest'
import { formatAuthors, formatYear, formatReference } from './format'

describe('formatAuthors', () => {
  it('falls back when empty', () => {
    expect(formatAuthors([])).toBe('Unknown author')
  })
  it('lists one or two authors verbatim', () => {
    expect(formatAuthors(['Carney, D.'])).toBe('Carney, D.')
    expect(formatAuthors(['Carney, D.', 'Cuddy, A.'])).toBe('Carney, D., Cuddy, A.')
  })
  it('uses et al. for three or more', () => {
    expect(formatAuthors(['A', 'B', 'C'])).toBe('A et al.')
  })
})

describe('formatYear', () => {
  it('takes the first four characters', () => {
    expect(formatYear('2010-09-21')).toBe('2010')
    expect(formatYear('2021')).toBe('2021')
  })
})

describe('formatReference', () => {
  it('combines authors, journal, and year', () => {
    expect(
      formatReference({
        title: 'T',
        authors: ['Carney, D.', 'Cuddy, A.', 'Yap, A.'],
        journal: 'Psychological Science',
        publication_date: '2010-09-21',
      }),
    ).toBe('Carney, D. et al. · Psychological Science · (2010)')
  })
})
