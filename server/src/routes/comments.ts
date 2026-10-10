import { Hono } from 'hono'
import { and, asc, eq, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { PUBLIC_STATUSES } from '@/db/queries'
import { alertAdmins } from '@/lib/admin-alerts'
import { notifySubscribers } from '@/lib/notify'
import { requireUser, HttpError, type AppEnv } from '@/middleware/auth'

export const commentsRouter = new Hono<AppEnv>()

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

  const viewer = c.get('user')?.id ?? null

  // Oldest first — the client nests replies under their parent in this order.
  const rows = await db
    .select({
      id: schema.comments.id,
      parentId: schema.comments.parentId,
      authorUid: schema.comments.authorUid,
      name: schema.user.name,
      image: schema.user.image,
      links: schema.user.links,
      content: schema.comments.content,
      hidden: schema.comments.hidden,
      createdAt: schema.comments.createdAt,
      likes: sql<number>`(select count(*)::int from comment_likes l where l.comment_id = ${schema.comments.id})`,
      viewerLiked: viewer
        ? sql<boolean>`exists (select 1 from comment_likes l where l.comment_id = ${schema.comments.id} and l.user_uid = ${viewer})`
        : sql<boolean>`false`,
      viewerFlagged: viewer
        ? sql<boolean>`exists (select 1 from comment_flags f where f.comment_id = ${schema.comments.id} and f.user_uid = ${viewer})`
        : sql<boolean>`false`,
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
      image: r.image ?? '',
      links: (r.links ?? {}) as Record<string, string>,
      content: r.content,
      hidden: r.hidden,
      createdAt: r.createdAt,
      likes: r.likes,
      viewerLiked: r.viewerLiked,
      viewerFlagged: r.viewerFlagged,
      isOwn: viewer === r.authorUid,
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
  if (parentId && !UUID_RE.test(parentId)) {
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

/** A visible comment on a public nomination — the only kind that can be liked or flagged. */
async function loadVisibleComment(commentId: string) {
  if (!UUID_RE.test(commentId)) throw new HttpError(404, 'Comment not found.')
  const [row] = await db
    .select({
      nominationId: schema.comments.nominationId,
      authorUid: schema.comments.authorUid,
      content: schema.comments.content,
      hidden: schema.comments.hidden,
    })
    .from(schema.comments)
    .where(eq(schema.comments.id, commentId))
    .limit(1)
  if (!row || row.hidden) throw new HttpError(404, 'Comment not found.')
  await ensurePublicNomination(row.nominationId)
  return row
}

// Like / unlike a comment.
commentsRouter.post('/:commentId/like', async (c) => {
  const user = requireUser(c)
  const commentId = c.req.param('commentId')
  await loadVisibleComment(commentId)

  const removed = await db
    .delete(schema.commentLikes)
    .where(
      and(eq(schema.commentLikes.commentId, commentId), eq(schema.commentLikes.userUid, user.id)),
    )
    .returning({ commentId: schema.commentLikes.commentId })
  if (removed.length === 0) {
    await db
      .insert(schema.commentLikes)
      .values({ commentId, userUid: user.id })
      .onConflictDoNothing()
  }
  return c.json({ liked: removed.length === 0 })
})

// Flag a comment for maintainer review (Code of Conduct). One flag per user per
// comment; the comment stays visible until a maintainer acts on it.
commentsRouter.post('/:commentId/flag', async (c) => {
  const user = requireUser(c)
  const commentId = c.req.param('commentId')
  const comment = await loadVisibleComment(commentId)
  if (comment.authorUid === user.id) throw new HttpError(400, 'You can’t flag your own comment.')

  const body = await c.req.json().catch(() => ({}))
  const reason = String(body.reason ?? '').trim().slice(0, 1000)

  const inserted = await db
    .insert(schema.commentFlags)
    .values({ commentId, userUid: user.id, reason })
    .onConflictDoNothing()
    .returning({ commentId: schema.commentFlags.commentId })

  // Only a user's first flag on a comment alerts maintainers.
  if (inserted.length > 0) {
    await alertAdmins({
      type: 'moderation_comment_flagged',
      subject: 'A comment was flagged for review',
      body:
        `Researcher #${user.id.slice(0, 8)} flagged a comment on nomination ` +
        `${comment.nominationId}${reason ? ` — reason: ${reason}` : ''}.\n\n` +
        `Comment:\n${comment.content}`,
      data: { nominationId: comment.nominationId, commentId },
    })
  }
  return c.json({ flagged: true })
})
