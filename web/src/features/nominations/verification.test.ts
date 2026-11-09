import { describe, it, expect } from 'vitest'
import { forecastSummary } from './verification'

describe('forecastSummary', () => {
  it('invites a first prediction when there are none', () => {
    expect(forecastSummary('replication', 0, 0)).toMatch(/anonymous/)
  })

  it('reports a single prediction as one response, not a consensus', () => {
    expect(forecastSummary('replication', 1, 0)).toBe('1 prediction so far, too few to call.')
    expect(forecastSummary('reproduction', 0, 1)).toBe('1 prediction so far, too few to call.')
  })

  it('reports counts while there are too few to call', () => {
    expect(forecastSummary('replication', 3, 1)).toBe(
      '4 predictions so far, too few to call.',
    )
  })

  it('summarises a clear majority in the wording of the requested check', () => {
    expect(forecastSummary('replication', 8, 2)).toBe('Most expect this to replicate.')
    expect(forecastSummary('reproduction', 1, 9)).toBe('Most expect the results not to hold up.')
    expect(forecastSummary('both', 5, 5)).toBe('Researchers are split on this one.')
  })
})
