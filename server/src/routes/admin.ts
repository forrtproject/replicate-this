import { Hono } from 'hono'
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { notify, notifySubscribers } from '@/lib/notify'
import { approveNomination, rejectNomination, ensureSlackChannel } from '@/lib/moderation'
import { requireMaintainer, HttpError, type AppEnv } from '@/middleware/auth'

export const adminRouter = new Hono<AppEnv>()

// All admin routes require maintainer.
adminRouter.use('*', async (c, next) => {
  requireMaintainer(c)
  await next()
})

// Moderation queue. ?tab=pending (default) | archived
adminRouter.get('/nominations', async (c) => {
  const tab = c.req.query('tab') ?? 'pending'
  const statuses =
    tab === 'archived' ? (['rejected'] as const) : (['pending'] as const)
  const rows = await db
    .select()
    .from(schema.nominations)
    .where(inArray(schema.nominations.status, statuses as unknown as string[]))
    .orderBy(
      tab === 'archived'
        ? desc(schema.nominations.createdAt)
        : schema.nominations.createdAt,
    )
  return c.json({ nominations: rows })
})

async function log(adminUid: string, nominationId: string, action: string, reason?: string) {
  await db.insert(schema.moderationLogs).values({ adminUid, nominationId, action, reason })
}

adminRouter.post('/nominations/:id/approve', async (c) => {
  const admin = requireMaintainer(c)
  const result = await approveNomination(admin.id, c.req.param('id'))
  if (result === 'not_found') throw new HttpError(404, 'Nomination not found.')
  return c.json({ ok: true })
})

adminRouter.post('/nominations/:id/reject', async (c) => {
  const admin = requireMaintainer(c)
  const body = await c.req.json().catch(() => ({}))
  const reason = String(body.reason ?? '').trim()
  if (!reason) throw new HttpError(400, 'A rejection reason is required.')

  const result = await rejectNomination(admin.id, c.req.param('id'), reason)
  if (result === 'not_found') throw new HttpError(404, 'Nomination not found.')
  return c.json({ ok: true })
})

adminRouter.post('/nominations/:id/undo-reject', async (c) => {
  const admin = requireMaintainer(c)
  const id = c.req.param('id')
  await db
    .update(schema.nominations)
    .set({ status: 'pending' })
    .where(and(eq(schema.nominations.id, id), eq(schema.nominations.status, 'rejected')))
  await log(admin.id, id, 'undo_rejection')
  return c.json({ ok: true })
})

// Advance or revert the lifecycle: approved | in_progress | completed | published.
// Reverting is just setting an earlier status — maintainers may always step back,
// with no preconditions. Only ADVANCING to 'completed' is gated: the team must
// first post a progress update linking the resulting research article.
const SETTABLE = ['approved', 'in_progress', 'completed', 'published'] as const
const LIFECYCLE = ['pending', 'approved', 'in_progress', 'completed', 'published'] as const
adminRouter.post('/nominations/:id/status', async (c) => {
  const admin = requireMaintainer(c)
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const status = String(body.status ?? '')
  if (!SETTABLE.includes(status as never)) {
    throw new HttpError(400, 'Status must be approved, in_progress, completed, or published.')
  }

  const [current] = await db
    .select({
      status: schema.nominations.status,
      nominatorUid: schema.nominations.nominatorUid,
    })
    .from(schema.nominations)
    .where(eq(schema.nominations.id, id))
    .limit(1)
  if (!current) throw new HttpError(404, 'Nomination not found.')

  const isRevert =
    LIFECYCLE.indexOf(status as never) < LIFECYCLE.indexOf(current.status as never)

  if (status === 'completed' && !isRevert) {
    const [linked] = await db
      .select({ id: schema.nominationUpdates.id })
      .from(schema.nominationUpdates)
      .where(
        and(
          eq(schema.nominationUpdates.nominationId, id),
          ne(schema.nominationUpdates.articleUrl, ''),
        ),
      )
      .limit(1)
    if (!linked) {
      throw new HttpError(
        400,
        'A progress update linking the research article is required before marking this completed.',
      )
    }
  }

  await db.update(schema.nominations).set({ status }).where(eq(schema.nominations.id, id))
  await log(admin.id, id, `${isRevert ? 'revert_status' : 'set_status'}_${status}`)
  // The team channel is normally created on approval; cover nominations that
  // reach an active status another way (e.g. Slack configured after approval).
  if (status === 'approved' || status === 'in_progress') {
    await ensureSlackChannel(id)
  }
  if (current.nominatorUid && !isRevert && (status === 'completed' || status === 'published')) {
    await notify([
      { userUid: current.nominatorUid, type: `nomination_${status}`, data: { nominationId: id } },
    ])
  }
  await notifySubscribers(id, 'watched_status', { status }, admin.id)
  return c.json({ ok: true })
})

/* ---------------- User management ---------------- */

interface UserRow extends Record<string, unknown> {
  id: string
  role: string
  name: string
  links: Record<string, string> | null
  created_at: string
  nominations: number
  contributions: number
  providers: string | null
}

// Pseudonymous user list. The only identifying signals are the ones users chose
// to share themselves: an optional display name and opt-in contact links.
adminRouter.get('/users', async (c) => {
  const res = await db.execute<UserRow>(sql`
    select u.id, u.role, u.name, u.links, u.created_at,
      (select count(*)::int from nominations n where n.nominator_uid = u.id) as nominations,
      (select count(*)::int from contributions ct where ct.contributor_uid = u.id) as contributions,
      (select string_agg(distinct a.provider_id, ',') from account a where a.user_id = u.id) as providers
    from "user" u
    where u.deleted = false
    order by u.created_at desc
  `)
  return c.json({
    users: res.rows.map((r) => ({
      id: r.id,
      token: r.id.slice(0, 8),
      role: r.role,
      name: r.name,
      links: r.links ?? {},
      createdAt: r.created_at,
      nominations: r.nominations,
      contributions: r.contributions,
      providers: r.providers ? r.providers.split(',') : [],
    })),
  })
})

const ROLES = ['user', 'maintainer'] as const

// Grant or revoke maintainer. Guardrails: no self-changes, always keep >=1 maintainer.
adminRouter.patch('/users/:uid/role', async (c) => {
  const admin = requireMaintainer(c)
  const uid = c.req.param('uid')
  const body = await c.req.json().catch(() => ({}))
  const role = String(body.role ?? '')

  if (!ROLES.includes(role as never)) {
    throw new HttpError(400, 'Role must be user or maintainer.')
  }
  if (uid === admin.id) {
    throw new HttpError(400, 'You can’t change your own role.')
  }

  const [target] = await db
    .select({ id: schema.user.id, role: schema.user.role, deleted: schema.user.deleted })
    .from(schema.user)
    .where(eq(schema.user.id, uid))
    .limit(1)
  if (!target || target.deleted) throw new HttpError(404, 'User not found.')

  if (target.role === 'maintainer' && role === 'user') {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.user)
      .where(eq(schema.user.role, 'maintainer'))
    if (n <= 1) throw new HttpError(400, 'Can’t remove the last maintainer.')
  }

  await db
    .update(schema.user)
    .set({ role, updatedAt: new Date() })
    .where(eq(schema.user.id, uid))

  await db.insert(schema.moderationLogs).values({
    adminUid: admin.id,
    nominationId: null,
    action: role === 'maintainer' ? 'grant_maintainer' : 'revoke_maintainer',
    reason: `target #${uid.slice(0, 8)}`,
  })

  return c.json({ ok: true, role })
})

/* ---------------- Comment moderation ---------------- */

// Recent comments across all nominations (including hidden) for one-click review.
adminRouter.get('/comments', async (c) => {
  const rows = await db
    .select({
      id: schema.comments.id,
      nominationId: schema.comments.nominationId,
      content: schema.comments.content,
      hidden: schema.comments.hidden,
      createdAt: schema.comments.createdAt,
      authorUid: schema.comments.authorUid,
      authorName: schema.user.name,
      metadata: schema.nominations.metadata,
    })
    .from(schema.comments)
    .innerJoin(schema.nominations, eq(schema.nominations.id, schema.comments.nominationId))
    .innerJoin(schema.user, eq(schema.user.id, schema.comments.authorUid))
    .orderBy(desc(schema.comments.createdAt))
    .limit(100)

  return c.json({
    comments: rows.map((r) => ({
      id: r.id,
      nominationId: r.nominationId,
      nominationTitle: (r.metadata as { title?: string })?.title ?? '',
      content: r.content,
      hidden: r.hidden,
      createdAt: r.createdAt,
      authorToken: r.authorUid.slice(0, 8),
      authorName: r.authorName,
    })),
  })
})

// Hide or unhide a comment. body: { hidden?: boolean } (defaults to hide).
adminRouter.post('/comments/:id/hide', async (c) => {
  const admin = requireMaintainer(c)
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const hidden = body.hidden !== false

  const [updated] = await db
    .update(schema.comments)
    .set({ hidden })
    .where(eq(schema.comments.id, id))
    .returning({ nominationId: schema.comments.nominationId })
  if (!updated) throw new HttpError(404, 'Comment not found.')

  await db.insert(schema.moderationLogs).values({
    adminUid: admin.id,
    nominationId: updated.nominationId,
    action: hidden ? 'hide_comment' : 'unhide_comment',
  })
  return c.json({ ok: true, hidden })
})
