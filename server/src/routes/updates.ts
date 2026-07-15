import { Hono } from 'hono'
import { and, asc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { PUBLIC_STATUSES } from '@/db/queries'
import { notifyMaintainers, notifySubscribers } from '@/lib/notify'
import { requireUser, HttpError, type AppEnv } from '@/middleware/auth'

export const updatesRouter = new Hono<AppEnv>()

async function getNomination(id: string) {
  const [n] = await db
    .select({
      id: schema.nominations.id,
      status: schema.nominations.status,
      nominatorUid: schema.nominations.nominatorUid,
      doi: schema.nominations.doi,
    })
    .from(schema.nominations)
    .where(eq(schema.nominations.id, id))
    .limit(1)
  if (!n || !PUBLIC_STATUSES.includes(n.status as never)) {
    throw new HttpError(404, 'Nomination not found.')
  }
  return n
}

/** The replication team: the nominator, contributors, and maintainers. */
async function isTeamMember(
  nomination: { nominatorUid: string | null },
  nominationId: string,
  user: { id: string; role: string },
): Promise<boolean> {
  if (user.role === 'maintainer') return true
  if (nomination.nominatorUid === user.id) return true
  const [row] = await db
    .select({ uid: schema.contributions.contributorUid })
    .from(schema.contributions)
    .where(
      and(
        eq(schema.contributions.nominationId, nominationId),
        eq(schema.contributions.contributorUid, user.id),
      ),
    )
    .limit(1)
  return Boolean(row)
}

// Public timeline of progress updates, oldest first.
updatesRouter.get('/:nominationId', async (c) => {
  const nominationId = c.req.param('nominationId')
  await getNomination(nominationId)

  const rows = await db
    .select({
      id: schema.nominationUpdates.id,
      authorUid: schema.nominationUpdates.authorUid,
      name: schema.user.name,
      content: schema.nominationUpdates.content,
      articleUrl: schema.nominationUpdates.articleUrl,
      createdAt: schema.nominationUpdates.createdAt,
    })
    .from(schema.nominationUpdates)
    .innerJoin(schema.user, eq(schema.user.id, schema.nominationUpdates.authorUid))
    .where(eq(schema.nominationUpdates.nominationId, nominationId))
    .orderBy(asc(schema.nominationUpdates.createdAt))

  return c.json({
    updates: rows.map((r) => ({
      id: r.id,
      token: r.authorUid.slice(0, 8),
      name: r.name,
      content: r.content,
      articleUrl: r.articleUrl,
      createdAt: r.createdAt,
    })),
  })
})

// Post a progress update (nominator, contributor, or maintainer). Optional —
// teams are never required to post. An update with an article link doubles as
// a completion request: maintainers are alerted and must approve before the
// status flips to 'completed'.
updatesRouter.post('/:nominationId', async (c) => {
  const user = requireUser(c)
  const nominationId = c.req.param('nominationId')
  const nomination = await getNomination(nominationId)

  if (!(await isTeamMember(nomination, nominationId, user))) {
    throw new HttpError(403, 'Only the replication team can post updates.')
  }

  const body = await c.req.json().catch(() => ({}))
  const content = String(body.content ?? '').trim()
  const articleUrl = String(body.articleUrl ?? '').trim()
  if (content.length < 2) throw new HttpError(400, 'Please write an update.')
  if (content.length > 5000) throw new HttpError(400, 'That update is too long.')
  if (articleUrl && !/^https?:\/\/.+/i.test(articleUrl)) {
    throw new HttpError(400, 'The article link must be a full http(s) URL.')
  }

  const [ins] = await db
    .insert(schema.nominationUpdates)
    .values({ nominationId, authorUid: user.id, content, articleUrl })
    .returning({ id: schema.nominationUpdates.id })

  await db
    .update(schema.nominations)
    .set({ lastActivityAt: new Date() })
    .where(eq(schema.nominations.id, nominationId))

  await notifySubscribers(nominationId, 'watched_update', {}, user.id)
  if (articleUrl) {
    await notifyMaintainers('completion_requested', {
      nominationId,
      doi: nomination.doi,
      updateId: ins.id,
    })
  }

  return c.json({ id: ins.id }, 201)
})
