import { Hono } from 'hono'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireUser, type AppEnv } from '@/middleware/auth'

export const notificationsRouter = new Hono<AppEnv>()

notificationsRouter.get('/', async (c) => {
  const user = requireUser(c)
  const rows = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userUid, user.id))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(50)
  const unread = rows.filter((r) => r.readAt === null).length
  return c.json({ notifications: rows, unread })
})

notificationsRouter.post('/read', async (c) => {
  const user = requireUser(c)
  await db
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(schema.notifications.userUid, user.id),
        isNull(schema.notifications.readAt),
      ),
    )
  return c.json({ ok: true })
})

// Mark a single notification read (e.g. when the user clicks it). Scoped to the
// owner so one user can't touch another's notifications.
notificationsRouter.post('/:id/read', async (c) => {
  const user = requireUser(c)
  const id = c.req.param('id')
  await db
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(schema.notifications.id, id),
        eq(schema.notifications.userUid, user.id),
        isNull(schema.notifications.readAt),
      ),
    )
  return c.json({ ok: true })
})
