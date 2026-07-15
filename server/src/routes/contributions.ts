import { Hono } from 'hono'
import { and, eq, sql, desc } from 'drizzle-orm'
import { db, schema } from '@/db'
import { notify, notifySubscribers } from '@/lib/notify'
import { PUBLIC_STATUSES } from '@/db/queries'
import { requireUser, HttpError, type AppEnv } from '@/middleware/auth'

export const contributionsRouter = new Hono<AppEnv>()

async function getNomination(id: string) {
  const [n] = await db
    .select({
      id: schema.nominations.id,
      status: schema.nominations.status,
      nominatorUid: schema.nominations.nominatorUid,
    })
    .from(schema.nominations)
    .where(eq(schema.nominations.id, id))
    .limit(1)
  if (!n) throw new HttpError(404, 'Nomination not found.')
  return n
}

async function count(nominationId: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.contributions)
    .where(eq(schema.contributions.nominationId, nominationId))
  return n
}

// Current user's contributions, with the nomination they joined.
contributionsRouter.get('/mine', async (c) => {
  const user = requireUser(c)
  const rows = await db
    .select({
      nominationId: schema.contributions.nominationId,
      message: schema.contributions.message,
      createdAt: schema.contributions.createdAt,
      nomination: schema.nominations,
    })
    .from(schema.contributions)
    .innerJoin(
      schema.nominations,
      eq(schema.nominations.id, schema.contributions.nominationId),
    )
    .where(eq(schema.contributions.contributorUid, user.id))
    .orderBy(desc(schema.contributions.createdAt))
  return c.json({ contributions: rows })
})

// Signal intent to replicate. Auto-accepted — no handshake.
contributionsRouter.post('/:nominationId', async (c) => {
  const user = requireUser(c)
  const nominationId = c.req.param('nominationId')
  const body = await c.req.json().catch(() => ({}))
  const message = String(body.message ?? '').trim()

  const nomination = await getNomination(nominationId)
  if (!PUBLIC_STATUSES.includes(nomination.status as never)) {
    throw new HttpError(400, 'This nomination is not open for contributions.')
  }
  if (nomination.nominatorUid === user.id) {
    throw new HttpError(400, 'You nominated this study — you are already involved.')
  }

  await db
    .insert(schema.contributions)
    .values({ nominationId, contributorUid: user.id, message })
    .onConflictDoUpdate({
      target: [schema.contributions.nominationId, schema.contributions.contributorUid],
      set: { message },
    })

  if (nomination.nominatorUid) {
    await notify([
      {
        userUid: nomination.nominatorUid,
        type: 'new_contribution',
        data: { nominationId, contributorToken: user.id.slice(0, 8) },
      },
    ])
  }
  await notifySubscribers(nominationId, 'watched_contribution', {}, user.id)

  return c.json({ userContributed: true, contributions: await count(nominationId) }, 201)
})

// Withdraw a contribution.
contributionsRouter.delete('/:nominationId', async (c) => {
  const user = requireUser(c)
  const nominationId = c.req.param('nominationId')
  await db
    .delete(schema.contributions)
    .where(
      and(
        eq(schema.contributions.nominationId, nominationId),
        eq(schema.contributions.contributorUid, user.id),
      ),
    )
  return c.json({ userContributed: false, contributions: await count(nominationId) })
})
