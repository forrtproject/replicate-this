import { Hono } from 'hono'
import { and, asc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { PUBLIC_STATUSES } from '@/db/queries'
import { alertAdmins } from '@/lib/admin-alerts'
import { notifySubscribers } from '@/lib/notify'
import { requireUser, HttpError, type AppEnv } from '@/middleware/auth'

export const commentsRouter = new Hono<AppEnv>()

async function ensurePublicNomination(nominationId: string) {
  const [n] = await db
    .select({ status: schema.nominations.status })
    .from(schema.nominations)
    .where(eq(schema.nominations.id, nominationId))
    .limit(1)
  if (!n || !PUBLIC_STATUSES.includes(n.status as never)) {
    throw new HttpError(404, 'Nomination not found.')
  }
}

// Public comment thread for a nomination. Deleted authors keep their comments,
// shown via their (now "Deleted account") user row.
commentsRouter.get('/:nominationId', async (c) => {
  const nominationId = c.req.param('nominationId')
  await ensurePublicNomination(nominationId)

  // Maintainers see hidden comments too (flagged) so they can moderate in place.
  const isAdmin = c.get('user')?.role === 'maintainer'
  const filter = isAdmin
    ? eq(schema.comments.nominationId, nominationId)
    : and(
        eq(schema.comments.nominationId, nominationId),
        eq(schema.comments.hidden, false),
      )

  // Oldest first — the client nests replies under their parent in this order.
  const rows = await db
    .select({
      id: schema.comments.id,
      parentId: schema.comments.parentId,
      authorUid: schema.comments.authorUid,
      name: schema.user.name,
      links: schema.user.links,
      content: schema.comments.content,
      hidden: schema.comments.hidden,
      createdAt: schema.comments.createdAt,
    })
    .from(schema.comments)
    .innerJoin(schema.user, eq(schema.user.id, schema.comments.authorUid))
    .where(filter)
    .orderBy(asc(schema.comments.createdAt))

  return c.json({
    comments: rows.map((r) => ({
      id: r.id,
      parentId: r.parentId,
      token: r.authorUid.slice(0, 8),
      name: r.name,
      links: (r.links ?? {}) as Record<string, string>,
      content: r.content,
      hidden: r.hidden,
      createdAt: r.createdAt,
    })),
  })
})

// Post a comment (login required).
commentsRouter.post('/:nominationId', async (c) => {
  const user = requireUser(c)
  const nominationId = c.req.param('nominationId')
  await ensurePublicNomination(nominationId)

  const body = await c.req.json().catch(() => ({}))
  const content = String(body.content ?? '').trim()
  if (content.length < 2) throw new HttpError(400, 'Please write a comment.')
  if (content.length > 5000) throw new HttpError(400, 'That comment is too long.')

  // Optional threading: a reply must point at a comment on the same nomination.
  const parentId = body.parentId ? String(body.parentId) : null
  if (parentId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parentId)) {
    throw new HttpError(400, 'Invalid parent comment.')
  }
  if (parentId) {
    const [parent] = await db
      .select({ nominationId: schema.comments.nominationId })
      .from(schema.comments)
      .where(eq(schema.comments.id, parentId))
      .limit(1)
    if (!parent || parent.nominationId !== nominationId) {
      throw new HttpError(400, 'The comment you are replying to no longer exists.')
    }
  }

  const [ins] = await db
    .insert(schema.comments)
    .values({ nominationId, parentId, authorUid: user.id, content })
    .returning({ id: schema.comments.id })

  await db
    .update(schema.nominations)
    .set({ lastActivityAt: new Date() })
    .where(eq(schema.nominations.id, nominationId))

  await notifySubscribers(nominationId, 'watched_comment', {}, user.id)

  await alertAdmins({
    type: 'moderation_new_comment',
    subject: 'New comment posted on a nomination',
    body:
      `A comment was posted on nomination ${nominationId} by ` +
      `researcher #${user.id.slice(0, 8)}:\n\n${content}`,
    data: { nominationId, senderToken: user.id.slice(0, 8) },
  })

  return c.json({ id: ins.id }, 201)
})
