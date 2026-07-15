import { Hono } from 'hono'
import { and, eq, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { PUBLIC_STATUSES } from '@/db/queries'
import { requireUser, HttpError, type AppEnv } from '@/middleware/auth'

export const subscriptionsRouter = new Hono<AppEnv>()

async function countSubscribers(nominationId: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.nominationId, nominationId))
  return n
}

// Toggle the current user's subscription (GitHub-style "watch"). Subscribers
// get in-app notifications for comments, updates, contributors and status changes.
subscriptionsRouter.post('/:nominationId/toggle', async (c) => {
  const user = requireUser(c)
  const nominationId = c.req.param('nominationId')

  const [n] = await db
    .select({ status: schema.nominations.status })
    .from(schema.nominations)
    .where(eq(schema.nominations.id, nominationId))
    .limit(1)
  if (!n || !PUBLIC_STATUSES.includes(n.status as never)) {
    throw new HttpError(404, 'Nomination not found.')
  }

  const where = and(
    eq(schema.subscriptions.nominationId, nominationId),
    eq(schema.subscriptions.userUid, user.id),
  )
  const existing = await db.select().from(schema.subscriptions).where(where).limit(1)

  let subscribed: boolean
  if (existing[0]) {
    await db.delete(schema.subscriptions).where(where)
    subscribed = false
  } else {
    await db.insert(schema.subscriptions).values({ nominationId, userUid: user.id })
    subscribed = true
  }

  return c.json({ subscribed, subscribers: await countSubscribers(nominationId) })
})
