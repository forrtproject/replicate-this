import { Hono } from 'hono'
import { and, eq, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { alertAdmins, milestoneFor } from '@/lib/admin-alerts'
import { requireUser, HttpError, type AppEnv } from '@/middleware/auth'

export const votesRouter = new Hono<AppEnv>()

async function getNomination(id: string) {
  const [n] = await db
    .select({
      id: schema.nominations.id,
      lastMilestone: schema.nominations.lastMilestone,
      metadata: schema.nominations.metadata,
    })
    .from(schema.nominations)
    .where(eq(schema.nominations.id, id))
    .limit(1)
  if (!n) throw new HttpError(404, 'Nomination not found.')
  return n
}

async function countUpvotes(nominationId: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.votes)
    .where(eq(schema.votes.nominationId, nominationId))
  return n
}

// Alert admins the first time a nomination reaches an upvote milestone.
async function checkMilestone(
  nomination: { id: string; lastMilestone: number; metadata: unknown },
  upvotes: number,
) {
  const milestone = milestoneFor(upvotes)
  if (milestone <= nomination.lastMilestone) return
  await db
    .update(schema.nominations)
    .set({ lastMilestone: milestone })
    .where(eq(schema.nominations.id, nomination.id))
  const title = (nomination.metadata as { title?: string })?.title ?? 'A nomination'
  await alertAdmins({
    type: 'upvote_milestone',
    subject: `“${title}” reached ${milestone} upvotes`,
    body: `“${title}” has reached ${milestone} upvotes on the registry.`,
    data: { nominationId: nomination.id, milestone },
  })
}

// Toggle the current user's "want replicated" upvote. Login required, no time gate.
votesRouter.post('/:nominationId/toggle', async (c) => {
  const user = requireUser(c)
  const nominationId = c.req.param('nominationId')
  const nomination = await getNomination(nominationId)

  const where = and(
    eq(schema.votes.nominationId, nominationId),
    eq(schema.votes.userUid, user.id),
  )
  const existing = await db.select().from(schema.votes).where(where).limit(1)

  let upvoted: boolean
  if (existing[0]) {
    await db.delete(schema.votes).where(where)
    upvoted = false
  } else {
    await db.insert(schema.votes).values({ nominationId, userUid: user.id })
    upvoted = true
  }

  const upvotes = await countUpvotes(nominationId)
  if (upvoted) await checkMilestone(nomination, upvotes)

  return c.json({ upvoted, upvotes })
})
