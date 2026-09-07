import { createAuthClient } from 'better-auth/react'
import { genericOAuthClient } from 'better-auth/client/plugins'
import { apiOrigin } from './config'

/**
 * Better Auth lives in the Hono server under /api/auth. In dev, Vite proxies
 * /api to the server (see vite.config.ts); on GitHub Pages the server is on a
 * separate origin, so VITE_API_ORIGIN points the client at it.
 */
export const authClient = createAuthClient({
  ...(apiOrigin ? { baseURL: apiOrigin } : {}),
  basePath: '/api/auth',
  plugins: [genericOAuthClient()],
})

export const { useSession, signIn, signOut } = authClient
