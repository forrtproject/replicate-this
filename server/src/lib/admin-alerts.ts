import { config } from '@/lib/env'
import { notifyMaintainers } from '@/lib/notify'
import { sendEmail } from '@/lib/mailer'

/**
 * Notify admins (maintainers) of a noteworthy event: an in-app notification for
 * every maintainer plus a single email to the shared team inbox (ADMIN_EMAIL).
 * Best-effort — never throws, so it can't break the triggering request.
 */
export async function alertAdmins(opts: {
  type: string
  subject: string
  body: string
  data?: Record<string, unknown>
}): Promise<void> {
  try {
    await notifyMaintainers(opts.type, opts.data ?? {})
    await sendEmail({
      to: config.adminEmail,
      subject: `[Replicate This] ${opts.subject}`,
      text: opts.body,
    })
  } catch (err) {
    console.error('[alertAdmins] failed', err)
  }
}

/** Upvote counts that trigger an admin alert when first reached. */
export const UPVOTE_MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000] as const

/** The highest milestone reached at `count`, or 0. */
export function milestoneFor(count: number): number {
  let hit = 0
  for (const m of UPVOTE_MILESTONES) if (count >= m) hit = m
  return hit
}
