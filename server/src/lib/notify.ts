import { eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import { config } from '@/lib/env'
import { sendEmail } from '@/lib/mailer'
import { loadReviewNomination, buildReviewEmail, type ReviewNomination } from '@/lib/review-email'
import { resolveEmailPrefs, type EmailPrefKey } from '@/types'

type NotificationInput = {
  userUid: string
  type: string
  data?: Record<string, unknown>
}

/**
 * Which email category each notification type belongs to. Types not listed here
 * are in-app only.
 */
const TYPE_CATEGORY: Record<string, EmailPrefKey> = {
  // Things happening to your own nominations.
  nomination_approved: 'my_nominations',
  nomination_rejected: 'my_nominations',
  nomination_completed: 'my_nominations',
  nomination_published: 'my_nominations',
  nomination_admin_edited: 'my_nominations',
  // People engaging with you.
  new_contribution: 'contributions',
  new_inquiry: 'contributions',
  team_member_joined: 'contributions',
  // Studies you subscribed to.
  watched_comment: 'watched',
  watched_update: 'watched',
  watched_contribution: 'watched',
  watched_status: 'watched',
  // Maintainer queue events.
  new_nomination: 'admin',
  nomination_edited: 'admin',
  completion_requested: 'admin',
  upvote_milestone: 'admin',
}

const SUBJECTS: Record<string, string> = {
  nomination_approved: 'Your nomination was approved',
  nomination_rejected: 'Your nomination was rejected',
  nomination_completed: 'A study you nominated was marked completed',
  nomination_published: 'A study you nominated was published',
  nomination_admin_edited: 'A maintainer edited your nomination',
  new_contribution: 'Someone is contributing to your nomination',
  new_inquiry: 'You received a new inquiry',
  team_member_joined: 'Someone joined a replication team you’re on',
  watched_comment: 'New comment on a study you subscribe to',
  watched_update: 'New progress update on a study you subscribe to',
  watched_contribution: 'New contributor on a study you subscribe to',
  watched_status: 'Status change on a study you subscribe to',
  new_nomination: 'New nomination awaiting review',
  nomination_edited: 'An edited nomination is awaiting review',
  completion_requested: 'Completion approval requested',
  upvote_milestone: 'A nomination reached an upvote milestone',
}

export async function notify(notifications: NotificationInput[]): Promise<void> {
  if (notifications.length === 0) return
  await db.insert(schema.notifications).values(
    notifications.map((n) => ({ userUid: n.userUid, type: n.type, data: n.data ?? {} })),
  )
  // Email delivery is best-effort — never fail the request over it.
  try {
    await emailOptedInRecipients(notifications)
  } catch (err) {
    console.error('[notify] email dispatch failed', err)
  }
}

/** Emails each recipient who has an address and hasn't opted out of the category. */
async function emailOptedInRecipients(notifications: NotificationInput[]): Promise<void> {
  const emailable = notifications.filter((n) => TYPE_CATEGORY[n.type])
  if (emailable.length === 0) return

  const uids = [...new Set(emailable.map((n) => n.userUid))]
  const users = await db
    .select({
      id: schema.user.id,
      notificationEmail: schema.user.notificationEmail,
      emailPrefs: schema.user.emailPrefs,
      deleted: schema.user.deleted,
    })
    .from(schema.user)
    .where(inArray(schema.user.id, uids))
  const byUid = new Map(users.map((u) => [u.id, u]))

  // Nomination-review emails carry the full study details plus per-recipient
  // approve/reject buttons; load the nomination once per batch.
  const reviewCache = new Map<string, ReviewNomination | null>()

  for (const n of emailable) {
    const u = byUid.get(n.userUid)
    if (!u || u.deleted || !u.notificationEmail) continue
    const prefs = resolveEmailPrefs(u.emailPrefs)
    if (!prefs[TYPE_CATEGORY[n.type]]) continue

    if (n.type === 'new_nomination' || n.type === 'nomination_edited') {
      const id = String(n.data?.nominationId ?? '')
      if (id && !reviewCache.has(id)) reviewCache.set(id, await loadReviewNomination(id))
      const nomination = id ? reviewCache.get(id) : null
      if (nomination) {
        const email = buildReviewEmail(nomination, u.id, {
          edited: n.type === 'nomination_edited',
        })
        await sendEmail({
          to: u.notificationEmail,
          subject: `[Replicate This] ${email.subject}`,
          text: email.text,
          html: email.html,
        })
        continue
      }
      // Nomination unexpectedly missing — fall through to the generic email.
    }

    const subject = SUBJECTS[n.type] ?? 'New activity on Replicate This'
    const nominationId = n.data?.nominationId
    const lines = [subject + '.']
    if (nominationId) lines.push(`View it: ${config.webAppUrl}/nominations/${nominationId}`)
    lines.push(
      '',
      `Manage which emails you get, or turn them off: ${config.webAppUrl}/profile`,
    )
    await sendEmail({
      to: u.notificationEmail,
      subject: `[Replicate This] ${subject}`,
      text: lines.join('\n'),
    })
  }
}

/** Fan a notification out to every maintainer. */
export async function notifyMaintainers(
  type: string,
  data: Record<string, unknown>,
): Promise<void> {
  const admins = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.role, 'maintainer'))
  await notify(admins.map((a) => ({ userUid: a.id, type, data })))
}

/**
 * Fan a notification out to everyone subscribed ("watching") a nomination,
 * except the user who triggered the activity.
 */
export async function notifySubscribers(
  nominationId: string,
  type: string,
  data: Record<string, unknown>,
  excludeUid?: string | null,
): Promise<void> {
  const subs = await db
    .select({ userUid: schema.subscriptions.userUid })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.nominationId, nominationId))
  await notify(
    subs
      .filter((s) => s.userUid !== excludeUid)
      .map((s) => ({ userUid: s.userUid, type, data: { nominationId, ...data } })),
  )
}
