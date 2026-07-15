import { createAuthClient } from 'better-auth/react'
import { genericOAuthClient } from 'better-auth/client/plugins'

/**
 * Better Auth lives in the Hono server under /api/auth. In dev, Vite proxies
 * /api to the server (see vite.config.ts); in prod both are served same-origin.
 */
export const authClient = createAuthClient({
  basePath: '/api/auth',
  plugins: [genericOAuthClient()],
})

export const { useSession, signIn, signOut } = authClient
