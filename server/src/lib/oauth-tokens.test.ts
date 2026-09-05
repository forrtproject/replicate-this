import { describe, it, expect } from 'vitest'
import { stripOAuthTokens } from './oauth-tokens'

describe('stripOAuthTokens', () => {
  it('nulls the three provider tokens on a full account row', () => {
    const stripped = stripOAuthTokens({
      accountId: '12345',
      providerId: 'google',
      userId: 'abc',
      accessToken: 'ya29.a0Ae',
      refreshToken: '1//0gRefresh',
      idToken: 'eyJhbGciOiJSUzI1NiJ9.eyJlbWFpbCI6InJlYWxAZXhhbXBsZS5jb20ifQ.sig',
      scope: 'openid email',
    })

    expect(stripped.accessToken).toBeNull()
    expect(stripped.refreshToken).toBeNull()
    expect(stripped.idToken).toBeNull()
  })

  it('leaves the non-token fields untouched', () => {
    const stripped = stripOAuthTokens({
      accountId: '12345',
      providerId: 'orcid',
      userId: 'abc',
      scope: 'openid',
    })

    expect(stripped).toMatchObject({
      accountId: '12345',
      providerId: 'orcid',
      userId: 'abc',
      scope: 'openid',
    })
  })

  it('nulls tokens on a partial update payload', () => {
    // Repeat sign-in updates only the changed fields.
    const stripped = stripOAuthTokens({ accessToken: 'fresh', scope: 'openid email' })

    expect(stripped.accessToken).toBeNull()
    expect(stripped.refreshToken).toBeNull()
    expect(stripped.idToken).toBeNull()
    expect(stripped.scope).toBe('openid email')
  })
})
