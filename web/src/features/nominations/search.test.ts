import { describe, it, expect } from 'vitest'
import type { NominationSummary } from '@/types'
import { matchesSearch } from './search'

const ioannidis = {
  doi: '10.1371/journal.pmed.0020124',
  metadata: {
    title: 'Why Most Published Research Findings Are False',
    authors: ['Ioannidis, J. P. A.'],
    journal: 'PLoS Medicine',
    publication_date: '2005',
  },
} as NominationSummary

const noDoi = {
  doi: null,
  metadata: { title: 'Über Replikation', authors: ['Müller, Anna'], journal: '', publication_date: '' },
} as NominationSummary

describe('matchesSearch', () => {
  it('matches everything for an empty query', () => {
    expect(matchesSearch(ioannidis, '  ')).toBe(true)
  })

  it('finds a partial title, an author surname and a journal', () => {
    expect(matchesSearch(ioannidis, 'published research')).toBe(true)
    expect(matchesSearch(ioannidis, 'ioannidis')).toBe(true)
    expect(matchesSearch(ioannidis, 'plos')).toBe(true)
  })

  it('requires every word to match', () => {
    expect(matchesSearch(ioannidis, 'ioannidis false')).toBe(true)
    expect(matchesSearch(ioannidis, 'ioannidis climate')).toBe(false)
  })

  it('finds a DOI typed bare, as a URL, or with a doi: prefix', () => {
    expect(matchesSearch(ioannidis, '10.1371/journal.pmed.0020124')).toBe(true)
    expect(matchesSearch(ioannidis, 'https://doi.org/10.1371/JOURNAL.PMED.0020124')).toBe(true)
    expect(matchesSearch(ioannidis, 'doi:10.1371/journal.pmed')).toBe(true)
    expect(matchesSearch(ioannidis, '10.1371/other')).toBe(false)
  })

  it('ignores accents and handles papers without a DOI', () => {
    expect(matchesSearch(noDoi, 'muller uber')).toBe(true)
    expect(matchesSearch(noDoi, '10.1371/journal')).toBe(false)
  })
})
