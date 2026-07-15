import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchDoiMetadata, normalizeDoi, DoiLookupError } from './crossref'

describe('normalizeDoi', () => {
  it('lowercases and trims', () => {
    expect(normalizeDoi('  10.1000/ABC  ')).toBe('10.1000/abc')
  })
  it('strips a trailing slash', () => {
    expect(normalizeDoi('10.1000/abc/')).toBe('10.1000/abc')
  })
  it('strips a doi.org URL prefix', () => {
    expect(normalizeDoi('https://doi.org/10.1000/AbC')).toBe('10.1000/abc')
  })
  it('strips a doi: prefix', () => {
    expect(normalizeDoi('doi:10.1000/abc')).toBe('10.1000/abc')
  })
})

const crossrefOk = {
  ok: true,
  status: 200,
  json: async () => ({
    message: {
      title: ['Power posing and testosterone'],
      author: [{ family: 'Carney', given: 'D.' }],
      'container-title': ['Psychological Science'],
      published: { 'date-parts': [[2010, 9, 21]] },
    },
  }),
} as Response

describe('fetchDoiMetadata', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('returns structured metadata from Crossref', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(crossrefOk)
    const meta = await fetchDoiMetadata('10.1037/test')
    expect(meta).toEqual({
      title: 'Power posing and testosterone',
      authors: ['Carney, D.'],
      journal: 'Psychological Science',
      publication_date: '2010-09-21',
    })
  })

  it('falls back to doi.org when Crossref 404s', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          title: 'Fallback paper',
          author: [{ family: 'Doe', given: 'J.' }],
          'container-title': 'DataCite Journal',
          published: { 'date-parts': [[2021]] },
        }),
      } as Response)

    const meta = await fetchDoiMetadata('10.5555/datacite')
    expect(meta.title).toBe('Fallback paper')
    expect(meta.journal).toBe('DataCite Journal')
    expect(meta.publication_date).toBe('2021')
  })

  it('throws a manual-allowed error when both sources fail', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)

    await expect(fetchDoiMetadata('10.0/bad')).rejects.toMatchObject({
      name: 'DoiLookupError',
      allowManual: true,
    })
  })

  it('falls back to doi.org when Crossref times out', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ title: 'Recovered', 'container-title': 'J', author: [] }),
      } as Response)

    const meta = await fetchDoiMetadata('10.1/timeout')
    expect(meta.title).toBe('Recovered')
  })
})

describe('DoiLookupError', () => {
  it('defaults allowManual to false', () => {
    expect(new DoiLookupError('x').allowManual).toBe(false)
  })
})
