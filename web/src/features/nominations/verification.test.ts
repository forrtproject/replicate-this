import { describe, it, expect } from 'vitest'
import { forecastSummary } from './verification'

describe('forecastSummary', () => {
  it('invites a first prediction when there are none', () => {
    expect(forecastSummary('replication', 0, 0)).toMatch(/anonymous/)
  })

  it('reports a single prediction as one response, not a consensus', () => {
    expect(forecastSummary('replication', 1, 0)).toBe('The one prediction so far is Yes.')
    expect(forecastSummary('reproduction', 0, 1)).toBe('The one prediction so far is No.')
  })

  it('reports counts while there are too few to call', () => {
    expect(forecastSummary('replication', 3, 1)).toBe(
      '3 Yes and 1 No so far: too few predictions to call.',
    )
  })

  it('summarises a clear majority in the wording of the requested check', () => {
    expect(forecastSummary('replication', 8, 2)).toBe('Most expect this to replicate.')
    expect(forecastSummary('reproduction', 1, 9)).toBe('Most expect the results not to hold up.')
    expect(forecastSummary('both', 5, 5)).toBe('Researchers are split on this one.')
  })
})
