import { Hono } from 'hono'
import { and, eq, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireUser, HttpError, type AppEnv } from '@/middleware/auth'

export const predictionsRouter = new Hono<AppEnv>()

async function counts(nominationId: string) {
  const [row] = await db
    .select({
      yes: sql<number>`count(*) filter (where will_replicate)::int`,
      no: sql<number>`count(*) filter (where not will_replicate)::int`,
    })
    .from(schema.predictions)
    .where(eq(schema.predictions.nominationId, nominationId))
  return { predictYes: row.yes, predictNo: row.no }
}

// Set/replace/clear the current user's "will it replicate?" prediction.
// body: { willReplicate: boolean | null }  (null clears it)
predictionsRouter.put('/:nominationId', async (c) => {
  const user = requireUser(c)
  const nominationId = c.req.param('nominationId')
  const body = await c.req.json().catch(() => ({}))
  const value = body.willReplicate

  if (value !== true && value !== false && value !== null) {
    throw new HttpError(400, 'willReplicate must be true, false, or null.')
  }

  const exists = await db
    .select({ id: schema.nominations.id })
    .from(schema.nominations)
    .where(eq(schema.nominations.id, nominationId))
    .limit(1)
  if (!exists[0]) throw new HttpError(404, 'Nomination not found.')

  const where = and(
    eq(schema.predictions.nominationId, nominationId),
    eq(schema.predictions.userUid, user.id),
  )

  if (value === null) {
    await db.delete(schema.predictions).where(where)
  } else {
    await db
      .insert(schema.predictions)
      .values({ nominationId, userUid: user.id, willReplicate: value })
      .onConflictDoUpdate({
        target: [schema.predictions.nominationId, schema.predictions.userUid],
        set: { willReplicate: value },
      })
  }

  return c.json({ prediction: value, ...(await counts(nominationId)) })
})
