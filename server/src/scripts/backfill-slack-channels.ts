import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import { slackEnabled } from '@/lib/slack'
import { ensureSlackChannel } from '@/lib/moderation'
import type { NominationMetadata } from '@/types'

/**
 * Create the locked Slack team channel for nominations that were approved
 * before the Slack integration was configured. New approvals get a channel
 * automatically; this catches up the ones that predate the bot token.
 *
 *   npm run slack:backfill              # all approved / in_progress studies
 *   npm run slack:backfill -- <nom-id>  # a single nomination
 */
async function main() {
  if (!slackEnabled()) {
    console.error('SLACK_BOT_TOKEN is not set — nothing to do.')
    process.exit(1)
  }

  const onlyId = process.argv[2]
  const where = onlyId
    ? eq(schema.nominations.id, onlyId)
    : and(
        inArray(schema.nominations.status, ['approved', 'in_progress']),
        eq(schema.nominations.slackChannelId, ''),
      )

  const rows = await db
    .select({
      id: schema.nominations.id,
      metadata: schema.nominations.metadata,
      slackChannelId: schema.nominations.slackChannelId,
    })
    .from(schema.nominations)
    .where(where)

  if (rows.length === 0) {
    console.log('No nominations need a channel.')
    process.exit(0)
  }

  for (const row of rows) {
    const title = (row.metadata as NominationMetadata).title
    if (row.slackChannelId) {
      console.log(`skip   ${row.id}  already has a channel  (${title})`)
      continue
    }
    await ensureSlackChannel(row.id)
    const [after] = await db
      .select({ name: schema.nominations.slackChannelName })
      .from(schema.nominations)
      .where(eq(schema.nominations.id, row.id))
    console.log(
      after?.name
        ? `created  #${after.name}  (${title})`
        : `FAILED   ${row.id}  — see the [slack] error above  (${title})`,
    )
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
