import { describe, it, expect } from 'vitest'
import { sanitizeLinks, normalizeOrcid, LinkError } from './profile-links'

describe('normalizeOrcid', () => {
  const canonical = 'https://orcid.org/0000-0003-2121-5177'

  it('stores a bare iD and its URL identically', () => {
    expect(normalizeOrcid('0000-0003-2121-5177')).toBe(canonical)
    expect(normalizeOrcid('https://orcid.org/0000-0003-2121-5177')).toBe(canonical)
    expect(normalizeOrcid('orcid.org/0000-0003-2121-5177/')).toBe(canonical)
    expect(normalizeOrcid('0000000321215177')).toBe(canonical)
  })

  it('rejects a mistyped iD', () => {
    expect(() => normalizeOrcid('0000-0003-2121-5178')).toThrow(LinkError)
    expect(() => normalizeOrcid('not an orcid')).toThrow(LinkError)
  })
})

describe('sanitizeLinks', () => {
  it('expands handles to profile URLs', () => {
    expect(
      sanitizeLinks({
        bluesky: '@jane.bsky.social',
        mastodon: '@jane@fediscience.org',
        github: 'jane-doe',
        twitter: '@jane',
        osf: 'ABCDE',
      }),
    ).toEqual({
      bluesky: 'https://bsky.app/profile/jane.bsky.social',
      mastodon: 'https://fediscience.org/@jane',
      github: 'https://github.com/jane-doe',
      twitter: 'https://x.com/jane',
      osf: 'https://osf.io/abcde/',
    })
  })

  it('appends the default host to a bare Bluesky name', () => {
    expect(sanitizeLinks({ bluesky: 'jane' })).toEqual({
      bluesky: 'https://bsky.app/profile/jane.bsky.social',
    })
  })

  it('adds a scheme to a website typed without one', () => {
    expect(sanitizeLinks({ website: 'example.org/me' })).toEqual({
      website: 'https://example.org/me',
    })
  })

  it('drops unknown keys and empty values', () => {
    expect(sanitizeLinks({ website: '  ', myspace: 'https://myspace.com/x' })).toEqual({})
  })

  it('rejects values that are not addresses', () => {
    expect(() => sanitizeLinks({ website: 'localhost' })).toThrow(LinkError)
    expect(() => sanitizeLinks({ mastodon: 'jane' })).toThrow(LinkError)
  })
})
