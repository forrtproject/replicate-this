import type { Context, MiddlewareHandler } from 'hono'
import { auth } from '@/auth'

export type AuthUser = {
  id: string
  role: string
  createdAt: Date
}

export type AppEnv = {
  Variables: {
    user: AuthUser | null
  }
}

/** Populates c.var.user from the Better Auth session (or null). */
export const withSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  c.set(
    'user',
    session
      ? {
          id: session.user.id,
          role: (session.user as { role?: string }).role ?? 'user',
          createdAt: new Date(session.user.createdAt),
        }
      : null,
  )
  await next()
}

/** Returns the current user or throws a 401 JSON response. */
export function requireUser(c: Context<AppEnv>): AuthUser {
  const user = c.get('user')
  if (!user) {
    throw new HttpError(401, 'You must be signed in.')
  }
  return user
}

/** Returns the current maintainer or throws 401/403. */
export function requireMaintainer(c: Context<AppEnv>): AuthUser {
  const user = requireUser(c)
  if (user.role !== 'maintainer') {
    throw new HttpError(403, 'Maintainer access required.')
  }
  return user
}

/** Thrown by route handlers; converted to a JSON error by the app's onError. */
export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}
