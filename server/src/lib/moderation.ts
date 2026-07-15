import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { notify, notifySubscribers } from '@/lib/notify'
import { slackEnabled, channelNameFor, createPrivateChannel, SlackApiError } from '@/lib/slack'
import type { NominationMetadata } from '@/types'

/**
 * Approve / reject a pending nomination. Shared by the admin API and the
 * email one-click review flow, so moderation logging and nominator /
 * subscriber notifications stay consistent no matter where the decision
 * was made.
 */

export type ModerationResult = 'done' | 'not_pending' | 'not_found'

async function log(adminUid: string, nominationId: string, action: string, reason?: string) {
  await db.insert(schema.moderationLogs).values({ adminUid, nominationId, action, reason })
}

async function currentStatus(id: string): Promise<string | null> {
  const [row] = await db
    .select({ status: schema.nominations.status })
    .from(schema.nominations)
    .where(eq(schema.nominations.id, id))
    .limit(1)
  return row?.status ?? null
}

/**
 * Create the team's locked Slack channel if the integration is configured and
 * the nomination doesn't have one yet. Never throws — a Slack outage or
 * misconfiguration must not block moderation.
 */
export async function ensureSlackChannel(nominationId: string): Promise<void> {
  if (!slackEnabled()) return
  try {
    const [n] = await db
      .select({
        slackChannelId: schema.nominations.slackChannelId,
        metadata: schema.nominations.metadata,
        doi: schema.nominations.doi,
      })
      .from(schema.nominations)
      .where(eq(schema.nominations.id, nominationId))
      .limit(1)
    if (!n || n.slackChannelId) return

    const title = (n.metadata as NominationMetadata).title || n.doi
    let name = channelNameFor(title)
    let channelId: string
    try {
      channelId = await createPrivateChannel(name)
    } catch (err) {
      // Same-titled paper (or a re-nomination) already claimed the name —
      // retry once with a nomination-id fragment to disambiguate.
      if (err instanceof SlackApiError && err.code === 'name_taken') {
        name = channelNameFor(title, nominationId.slice(0, 6))
        channelId = await createPrivateChannel(name)
      } else {
        throw err
      }
    }
    await db
      .update(schema.nominations)
      .set({ slackChannelId: channelId, slackChannelName: name })
      .where(eq(schema.nominations.id, nominationId))
  } catch (err) {
    console.error(`[slack] channel creation failed for nomination ${nominationId}:`, err)
  }
}

export async function approveNomination(adminUid: string, id: string): Promise<ModerationResult> {
  const [updated] = await db
    .update(schema.nominations)
    .set({ status: 'approved' })
    .where(and(eq(schema.nominations.id, id), eq(schema.nominations.status, 'pending')))
    .returning({ nominatorUid: schema.nominations.nominatorUid })
  if (!updated) {
    return (await currentStatus(id)) === null ? 'not_found' : 'not_pending'
  }

  await log(adminUid, id, 'approved')
  await ensureSlackChannel(id)
  if (updated.nominatorUid) {
    await notify([
      { userUid: updated.nominatorUid, type: 'nomination_approved', data: { nominationId: id } },
    ])
  }
  await notifySubscribers(id, 'watched_status', { status: 'approved' }, adminUid)
  return 'done'
}

export async function rejectNomination(
  adminUid: string,
  id: string,
  reason: string,
  // The email flow only acts on still-pending nominations; the admin UI may
  // reject at any point before work starts (unchanged behaviour).
  opts: { onlyPending?: boolean } = {},
): Promise<ModerationResult> {
  const where = opts.onlyPending
    ? and(eq(schema.nominations.id, id), eq(schema.nominations.status, 'pending'))
    : eq(schema.nominations.id, id)
  const [updated] = await db
    .update(schema.nominations)
    .set({ status: 'rejected' })
    .where(where)
    .returning({ nominatorUid: schema.nominations.nominatorUid })
  if (!updated) {
    return (await currentStatus(id)) === null ? 'not_found' : 'not_pending'
  }

  await log(adminUid, id, 'rejected', reason)
  if (updated.nominatorUid) {
    await notify([
      {
        userUid: updated.nominatorUid,
        type: 'nomination_rejected',
        data: { nominationId: id, reason },
      },
    ])
  }
  return 'done'
}
