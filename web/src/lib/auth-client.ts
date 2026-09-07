import { createAuthClient } from 'better-auth/react'
import {
  genericOAuthClient,
  oauthPopupClient,
  getStoredPopupToken,
} from 'better-auth/client/plugins'
import { apiOrigin } from './config'

/**
 * Better Auth lives in the Hono server under /api/auth. In dev, Vite proxies
 * /api to the server (see vite.config.ts); on GitHub Pages the server is on a
 * separate origin, so VITE_API_ORIGIN points the client at it.
 *
 * Cross-origin the session cookie is third-party and browsers drop it, so
 * sign-in goes through a popup that hands back a token. The bundled fetch
 * plugin only attaches that token inside an iframe, so a top-level page has to
 * send it itself.
 */
export const authClient = createAuthClient({
  ...(apiOrigin ? { baseURL: apiOrigin } : {}),
  basePath: '/api/auth',
  plugins: [genericOAuthClient(), oauthPopupClient()],
  fetchOptions: {
    onRequest(context) {
      const token = getStoredPopupToken()
      if (!token) return context
      const headers = new Headers(context.headers)
      if (!headers.has('authorization')) headers.set('authorization', `Bearer ${token}`)
      return { ...context, headers }
    },
  },
})

/** True when the SPA and API are on different origins, so cookies won't carry. */
export const usePopupSignIn = apiOrigin !== ''

export const { useSession, signIn, signOut } = authClient
