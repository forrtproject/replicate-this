import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { config } from '@/lib/env'
import { slackEnabled, inviteByEmail, SlackApiError } from '@/lib/slack'
import { requireUser, HttpError, type AppEnv } from '@/middleware/auth'

export const slackRouter = new Hono<AppEnv>()

/**
 * Invite the signed-in user into a nomination's locked team channel.
 *
 * body: { email } — the address on THEIR Slack account, volunteered for this
 * one lookup and never stored (zero-PII). Responses:
 *   { result: 'invited' | 'already_in_channel', channelName }
 *   { result: 'not_in_workspace', inviteUrl }  — create an account / join the
 *     workspace via the invite link first, then retry.
 */
slackRouter.post('/nominations/:id/join', async (c) => {
  const user = requireUser(c)
  const id = c.req.param('id')

  if (!slackEnabled()) {
    throw new HttpError(503, 'Slack integration isn’t configured.')
  }

  const body = await c.req.json().catch(() => ({}))
  const email = String(body.email ?? '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'Please enter the email address of your Slack account.')
  }

  const [n] = await db
    .select({
      slackChannelId: schema.nominations.slackChannelId,
      slackChannelName: schema.nominations.slackChannelName,
      nominatorUid: schema.nominations.nominatorUid,
    })
    .from(schema.nominations)
    .where(eq(schema.nominations.id, id))
    .limit(1)
  if (!n) throw new HttpError(404, 'Nomination not found.')
  if (!n.slackChannelId) {
    throw new HttpError(404, 'This study doesn’t have a Slack channel yet.')
  }

  // Only the replication team gets into the locked channel.
  const [membership] = await db
    .select({ contributorUid: schema.contributions.contributorUid })
    .from(schema.contributions)
    .where(
      and(
        eq(schema.contributions.nominationId, id),
        eq(schema.contributions.contributorUid, user.id),
      ),
    )
    .limit(1)
  if (!membership && n.nominatorUid !== user.id) {
    throw new HttpError(403, 'Join the replication team first to enter its Slack channel.')
  }

  try {
    const result = await inviteByEmail(n.slackChannelId, email)
    if (result === 'not_in_workspace') {
      if (!config.slack.inviteUrl) {
        throw new HttpError(
          503,
          'No Slack account found for that email, and no workspace invite link is configured. Contact a maintainer.',
        )
      }
      return c.json({ result, inviteUrl: config.slack.inviteUrl })
    }
    return c.json({ result, channelName: n.slackChannelName })
  } catch (err) {
    if (err instanceof SlackApiError) {
      console.error(`[slack] invite failed for nomination ${id}:`, err.message)
      throw new HttpError(502, 'Slack rejected the invitation. Please try again later.')
    }
    throw err
  }
})
