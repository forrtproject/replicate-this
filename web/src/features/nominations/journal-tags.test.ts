import { describe, expect, it } from 'vitest'
import { matchJournalTags, type JournalTagInput } from './journal-tags'

const keys = (n: JournalTagInput) => matchJournalTags(n).map((t) => t.key)

describe('matchJournalTags', () => {
  it('always includes R2', () => {
    expect(
      keys({ discipline: 'Other', verificationType: 'replication', availability: [] }),
    ).toEqual(['R2'])
  })

  it('adds JRR when a reproduction is wanted', () => {
    expect(
      keys({ discipline: 'Sociology', verificationType: 'reproduction', availability: [] }),
    ).toEqual(['R2', 'JRR'])
    expect(
      keys({ discipline: 'Sociology', verificationType: 'both', availability: [] }),
    ).toEqual(['R2', 'JRR'])
  })

  it('adds JCRE for economics regardless of type', () => {
    expect(
      keys({ discipline: 'Economics', verificationType: 'replication', availability: [] }),
    ).toContain('JCRE')
  })

  it('adds RC when open code is available', () => {
    expect(
      keys({ discipline: 'Other', verificationType: 'replication', availability: ['open_code'] }),
    ).toEqual(['R2', 'RC'])
  })

  it('adds RX for experimental disciplines', () => {
    expect(
      keys({ discipline: 'Psychology', verificationType: 'replication', availability: [] }),
    ).toEqual(['R2', 'RX'])
  })

  it('stacks every qualifying tag', () => {
    expect(
      keys({ discipline: 'Economics', verificationType: 'both', availability: ['open_code'] }),
    ).toEqual(['R2', 'JRR', 'JCRE', 'RC'])
  })
})
