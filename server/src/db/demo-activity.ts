/**
 * Dev-only: adds discussion, progress updates and notifications on top of
 * `db:seed` + `db:demo`, so comment threads, moderation queues, update
 * timelines and the dashboard inbox have something to show. Skips itself if
 * any comments already exist.
 *
 *   npx tsx src/db/demo-activity.ts
 */
import { eq, sql } from 'drizzle-orm'
import { db, schema, pool } from '@/db'

const DAY = 24 * 3600 * 1000
const ago = (days: number) => new Date(Date.now() - days * DAY)

async function byTitle(prefix: string) {
  const [row] = await db
    .select({ id: schema.nominations.id })
    .from(schema.nominations)
    .where(sql`${schema.nominations.metadata}->>'title' like ${prefix + '%'}`)
    .limit(1)
  if (!row) throw new Error(`No nomination titled "${prefix}…" — run db:seed and db:demo first`)
  return row.id
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to run in production')
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.comments)
  if (n > 0) {
    console.log('Comments already exist; skipping.')
    return
  }

  const egoDepletion = await byTitle('Ego Depletion')
  const powerPosing = await byTitle('Power Posing')
  const growthDebt = await byTitle('Growth in a Time of Debt')
  const feelingFuture = await byTitle('Feeling the Future')

  const [c1] = await db
    .insert(schema.comments)
    .values({
      nominationId: egoDepletion,
      authorUid: 'demo_user_03',
      content:
        'The 2016 multi-site RRR used the e-crossing task. Is the plan to keep that manipulation, or to test the original Stroop version as well?',
      createdAt: ago(9),
    })
    .returning()
  await db.insert(schema.comments).values([
    {
      nominationId: egoDepletion,
      parentId: c1.id,
      authorUid: 'demo_user_04',
      content:
        'Both, ideally. We are drafting a protocol with the original Stroop task as the primary manipulation and e-crossing as a secondary arm. Happy to share the draft once it is on OSF.',
      createdAt: ago(8),
    },
    {
      nominationId: egoDepletion,
      authorUid: 'seed_alice_0002',
      content:
        'Worth checking the manipulation checks reported in Hagger et al. (2016): self-reported effort barely differed between conditions in several labs.',
      createdAt: ago(5),
    },
    {
      nominationId: powerPosing,
      authorUid: 'demo_user_07',
      content:
        'Carney has since stated she no longer believes the effects are real. The hormonal outcomes seem the most useful target for a direct replication.',
      createdAt: ago(14),
    },
  ])
  const [flagged] = await db
    .insert(schema.comments)
    .values({
      nominationId: feelingFuture,
      authorUid: 'demo_user_11',
      content: 'Anyone who still takes this paper seriously should not be doing research.',
      createdAt: ago(2),
    })
    .returning()
  await db.insert(schema.commentFlags).values({
    commentId: flagged.id,
    userUid: 'demo_user_05',
    reason: 'Personal attack rather than a point about the study.',
    createdAt: ago(1),
  })

  await db.insert(schema.nominationUpdates).values([
    {
      nominationId: egoDepletion,
      authorUid: 'demo_user_04',
      content:
        'Team of four labs confirmed. The protocol draft is on OSF and we are collecting feedback until the end of the month.',
      createdAt: ago(20),
    },
    {
      nominationId: growthDebt,
      authorUid: 'demo_user_02',
      content:
        'Reproduction complete. The spreadsheet error is confirmed; with the excluded years restored, mean growth above 90% debt is 2.2%, not −0.1%.',
      articleUrl: 'https://doi.org/10.1093/cje/bet075',
      createdAt: ago(40),
    },
  ])

  await db.insert(schema.notifications).values([
    { userUid: 'seed_alice_0002', type: 'nomination_approved', data: { nominationId: powerPosing }, createdAt: ago(1) },
    {
      userUid: 'seed_alice_0002',
      type: 'new_contribution',
      data: { nominationId: powerPosing, contributorToken: 'demo_use' },
      createdAt: ago(3),
    },
    {
      userUid: 'seed_alice_0002',
      type: 'nomination_approved',
      data: { nominationId: egoDepletion },
      readAt: ago(6),
      createdAt: ago(7),
    },
  ])

  // Keep the seed admin's own view of its role consistent.
  await db.update(schema.user).set({ onboarded: true }).where(eq(schema.user.id, 'seed_admin_0001'))
  console.log('Demo activity added.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => pool.end())
