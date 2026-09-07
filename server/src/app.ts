import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth, enabledProviders } from '@/auth'
import { config } from '@/lib/env'
import { withSession, HttpError, type AppEnv } from '@/middleware/auth'
import { nominationsRouter } from '@/routes/nominations'
import { votesRouter } from '@/routes/votes'
import { predictionsRouter } from '@/routes/predictions'
import { contributionsRouter } from '@/routes/contributions'
import { commentsRouter } from '@/routes/comments'
import { subscriptionsRouter } from '@/routes/subscriptions'
import { updatesRouter } from '@/routes/updates'
import { inquiriesRouter } from '@/routes/inquiries'
import { notificationsRouter } from '@/routes/notifications'
import { profileRouter } from '@/routes/profile'
import { slackRouter } from '@/routes/slack'
import { adminRouter } from '@/routes/admin'
import { emailActionsRouter } from '@/routes/email-actions'

export function createApp() {
  const app = new Hono<AppEnv>()

  app.use(
    '*',
    cors({
      origin: config.webOrigin,
      credentials: true,
      allowHeaders: ['Content-Type'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  )

  // Better Auth owns everything under /api/auth/*.
  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))

  // This host serves only the API. Anyone (or anything) landing on the root
  // gets a pointer rather than a bare 404, and crawlers are turned away so the
  // API domain never shows up in search results.
  app.get('/', (c) => c.text('Replicate This API. The site is at ' + config.webAppUrl + '\n'))
  app.get('/robots.txt', (c) => c.text('User-agent: *\nDisallow: /\n'))

  app.get('/api/health', (c) => c.json({ ok: true }))

  // Which OAuth providers are configured (so the UI hides dead buttons).
  app.get('/api/providers', (c) => c.json(enabledProviders))

  // One-click moderation from maintainer emails — authenticated by a signed
  // token in the URL, not a session, so it's mounted before withSession.
  app.route('/api/email-actions', emailActionsRouter)

  // Everything below has the session resolved.
  app.use('/api/*', withSession)

  app.route('/api/nominations', nominationsRouter)
  app.route('/api/votes', votesRouter)
  app.route('/api/predictions', predictionsRouter)
  app.route('/api/contributions', contributionsRouter)
  app.route('/api/comments', commentsRouter)
  app.route('/api/subscriptions', subscriptionsRouter)
  app.route('/api/updates', updatesRouter)
  app.route('/api/inquiries', inquiriesRouter)
  app.route('/api/notifications', notificationsRouter)
  app.route('/api/profile', profileRouter)
  app.route('/api/slack', slackRouter)
  app.route('/api/admin', adminRouter)

  app.onError((err, c) => {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.status as 400)
    }
    console.error('[unhandled]', err)
    return c.json({ error: 'Internal server error.' }, 500)
  })

  return app
}
