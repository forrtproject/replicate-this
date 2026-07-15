import { config } from '@/lib/env'

/**
 * Minimal Slack Web API client for the community-workspace integration.
 *
 * When a nomination is approved we create a locked (private) channel for the
 * replication team; contributors are invited into it on request. Slack has no
 * API to create accounts or add outsiders to a workspace on standard plans,
 * so users who aren't members yet get the standing workspace invite link
 * (SLACK_INVITE_URL) and are invited to the channel once they've joined.
 *
 * Zero-PII: the email a user submits to be found on Slack is sent straight to
 * users.lookupByEmail and never stored.
 */

export const slackEnabled = () => Boolean(config.slack.botToken)

interface SlackResponse extends Record<string, unknown> {
  ok: boolean
  error?: string
}

export class SlackApiError extends Error {
  constructor(
    public method: string,
    public code: string,
  ) {
    super(`Slack ${method} failed: ${code}`)
  }
}

async function slackCall(method: string, params: Record<string, string>): Promise<SlackResponse> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.slack.botToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  })
  const data = (await res.json()) as SlackResponse
  if (!data.ok) throw new SlackApiError(method, data.error ?? 'unknown_error')
  return data
}

/**
 * Slack channel names: max 80 chars, lowercase letters/digits/hyphens only.
 * The name is the paper title's slug ending in "-discussion"; a disambiguator
 * is inserted before the suffix when Slack reports the name taken.
 */
export function channelNameFor(title: string, disambiguator = ''): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'replication'
  const tail = `${disambiguator && `-${disambiguator}`}-discussion`
  return slug.slice(0, 80 - tail.length).replace(/-+$/, '') + tail
}

/** Create a locked (private) channel; returns its id. */
export async function createPrivateChannel(name: string): Promise<string> {
  const data = await slackCall('conversations.create', { name, is_private: 'true' })
  return (data.channel as { id: string }).id
}

export type SlackJoinResult = 'invited' | 'already_in_channel' | 'not_in_workspace'

/**
 * Invite the workspace member with this email into the channel. The email is
 * used for the lookup only — it is not persisted anywhere.
 */
export async function inviteByEmail(channelId: string, email: string): Promise<SlackJoinResult> {
  let userId: string
  try {
    const data = await slackCall('users.lookupByEmail', { email })
    userId = (data.user as { id: string }).id
  } catch (err) {
    if (err instanceof SlackApiError && err.code === 'users_not_found') {
      return 'not_in_workspace'
    }
    throw err
  }

  try {
    await slackCall('conversations.invite', { channel: channelId, users: userId })
  } catch (err) {
    if (err instanceof SlackApiError && err.code === 'already_in_channel') {
      return 'already_in_channel'
    }
    throw err
  }
  return 'invited'
}
