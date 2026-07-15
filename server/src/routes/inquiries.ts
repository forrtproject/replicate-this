import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { notify } from '@/lib/notify'
import { alertAdmins } from '@/lib/admin-alerts'
import { PUBLIC_STATUSES } from '@/db/queries'
import { requireUser, HttpError, type AppEnv } from '@/middleware/auth'

export const inquiriesRouter = new Hono<AppEnv>()

/**
 * Send an inquiry to a nomination's nominator + contributors.
 *
 * The in-app notification is the primary, guaranteed delivery. Email is a
 * best-effort bonus layer (transient, zero-PII) and is deferred until Postmark
 * + OAuth offline tokens are wired — so deliveryStatus stays 'pending' for now.
 */
inquiriesRouter.post('/:nominationId', async (c) => {
  const user = requireUser(c)
  const nominationId = c.req.param('nominationId')
  const body = await c.req.json().catch(() => ({}))
  const content = String(body.content ?? '').trim()
  if (content.length < 5) throw new HttpError(400, 'Please write a short message.')

  const [nomination] = await db
    .select({
      status: schema.nominations.status,
      nominatorUid: schema.nominations.nominatorUid,
    })
    .from(schema.nominations)
    .where(eq(schema.nominations.id, nominationId))
    .limit(1)
  if (!nomination) throw new HttpError(404, 'Nomination not found.')
  if (!PUBLIC_STATUSES.includes(nomination.status as never)) {
    throw new HttpError(400, 'This nomination is not open for inquiries.')
  }

  await db.insert(schema.inquiries).values({
    nominationId,
    senderUid: user.id,
    content,
    deliveryStatus: 'pending',
  })

  // Recipients: nominator + all contributors.
  const contributors = await db
    .select({ uid: schema.contributions.contributorUid })
    .from(schema.contributions)
    .where(eq(schema.contributions.nominationId, nominationId))

  const recipients = new Set<string>(contributors.map((r) => r.uid))
  if (nomination.nominatorUid) recipients.add(nomination.nominatorUid)
  recipients.delete(user.id)

  await notify(
    [...recipients].map((uid) => ({
      userUid: uid,
      type: 'new_inquiry',
      data: { nominationId, senderToken: user.id.slice(0, 8) },
    })),
  )

  // Alert admins for moderation oversight of user-posted messages.
  await alertAdmins({
    type: 'moderation_new_inquiry',
    subject: 'New message posted on a nomination',
    body:
      `A new inquiry was posted on nomination ${nominationId} by ` +
      `researcher #${user.id.slice(0, 8)}:\n\n${content}`,
    data: { nominationId, senderToken: user.id.slice(0, 8) },
  })

  return c.json({ ok: true }, 201)
})
