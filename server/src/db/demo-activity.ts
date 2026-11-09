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

/**
 * `db:seed` uses placeholder papers and `db:demo` stamps everything with
 * today's date. Swap the placeholders for real papers (metadata checked
 * against Crossref) and spread creation dates over the past months, so the
 * screens show a plausible history.
 */
async function makeFixturesRealistic() {
  const swaps = [
    {
      from: 'A landmark cell signalling pathway result',
      doi: '10.1038/nature05414',
      metadata: {
        title: 'An obesity-associated gut microbiome with increased capacity for energy harvest',
        authors: ['Turnbaugh, P.', 'Ley, R.', 'Mahowald, M.'],
        journal: 'Nature',
        publication_date: '2006-12',
      },
      justification:
        'Foundational evidence that gut microbiota from obese mice transfer weight gain. Microbiome methods have changed a lot since; a replication with current sequencing would show how robust the effect is.',
    },
    {
      from: 'A recently nominated economics study under review',
      doi: '10.1257/aer.90.5.1362',
      metadata: {
        title:
          'Minimum Wages and Employment: A Case Study of the Fast-Food Industry in New Jersey and Pennsylvania: Comment',
        authors: ['Neumark, D.', 'Wascher, W.'],
        journal: 'American Economic Review',
        publication_date: '2000-12',
      },
      justification:
        'Central to the minimum-wage debate, and its payroll data led to conclusions opposite to the original study. Re-running both analyses side by side would clarify where they diverge.',
    },
    {
      from: 'A Recent Large-Scale Study of Online Social Influence',
      doi: '10.1126/science.1255484',
      metadata: {
        title: 'Publication bias in the social sciences: Unlocking the file drawer',
        authors: ['Franco, A.', 'Malhotra, N.', 'Simonovits, G.'],
        journal: 'Science',
        publication_date: '2014-09',
      },
      justification:
        'Widely cited estimate of how often null results go unpublished. The TESS study records are open, so the coding and the headline rates can be reproduced directly.',
    },
  ]
  for (const sw of swaps) {
    await db
      .update(schema.nominations)
      .set({ doi: sw.doi, metadata: sw.metadata, justification: sw.justification })
      .where(sql`${schema.nominations.metadata}->>'title' = ${sw.from}`)
  }

  // Demo data locations point at example.org; drop them rather than show fake links.
  await db.execute(sql`update nominations set data_location = '' where data_location like '%example.org%'`)

  // Stagger dates: accounts joined over the past year, nominations over the
  // past five months, newest last in this list.
  const users = await db.select({ id: schema.user.id }).from(schema.user)
  for (const [i, u] of users.entries()) {
    await db
      .update(schema.user)
      .set({ createdAt: ago(360 - i * 21) })
      .where(eq(schema.user.id, u.id))
  }
  const noms = await db
    .select({ id: schema.nominations.id, status: schema.nominations.status })
    .from(schema.nominations)
  const order: Record<string, number> = { published: 0, completed: 1, in_progress: 2, approved: 3, pending: 4 }
  noms.sort((a, b) => (order[a.status] ?? 5) - (order[b.status] ?? 5))
  for (const [i, nom] of noms.entries()) {
    const created = ago(150 - i * 11)
    await db
      .update(schema.nominations)
      .set({ createdAt: created, lastActivityAt: created })
      .where(eq(schema.nominations.id, nom.id))
  }
  await db.execute(sql`update contributions set created_at = now() - interval '25 days' where created_at > now() - interval '1 day'`)

  // Finished studies list who did the work.
  for (const [title, uid, message] of [
    ['Growth in a Time of Debt', 'demo_user_06', 'Ran the re-analysis from the original spreadsheet.'],
    ['Growth in a Time of Debt', 'demo_user_05', 'Checked the country weightings.'],
    ['Why Most Published Research Findings Are False', 'demo_user_11', 'Re-derived the PPV model and its sensitivity analyses.'],
  ] as const) {
    await db
      .insert(schema.contributions)
      .values({ nominationId: await byTitle(title), contributorUid: uid, message, createdAt: ago(90) })
      .onConflictDoNothing()
  }

  // The signed-in demo researcher has backed and forecast a few studies, so
  // the "you upvoted" and "you said" states appear.
  for (const title of ['Feeling the Future', 'Inhibiting and Facilitating']) {
    const id = await byTitle(title)
    await db.insert(schema.votes).values({ nominationId: id, userUid: 'c81e5d3a90f7b264' }).onConflictDoNothing()
    await db
      .insert(schema.predictions)
      .values({ nominationId: id, userUid: 'c81e5d3a90f7b264', willReplicate: false })
      .onConflictDoNothing()
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to run in production')
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.comments)
  if (n > 0) {
    console.log('Comments already exist; skipping.')
    return
  }

  await makeFixturesRealistic()

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
      authorUid: 'c81e5d3a90f7b264',
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
        'The protocol draft is on OSF and we are collecting feedback until the end of the month. We are also looking for one or two more labs to run the second site.',
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
    { userUid: 'c81e5d3a90f7b264', type: 'nomination_approved', data: { nominationId: powerPosing }, createdAt: ago(1) },
    {
      userUid: 'c81e5d3a90f7b264',
      type: 'new_contribution',
      data: { nominationId: await byTitle('Estimating the reproducibility'), contributorToken: '9b0d47e2' },
      createdAt: ago(3),
    },
    {
      userUid: 'c81e5d3a90f7b264',
      type: 'nomination_approved',
      data: { nominationId: await byTitle('An obesity-associated gut microbiome') },
      readAt: ago(6),
      createdAt: ago(7),
    },
  ])

  // Keep the seed admin's own view of its role consistent.
  await db.update(schema.user).set({ onboarded: true }).where(eq(schema.user.id, '4f2a9c71e8b3d05a'))
  console.log('Demo activity added.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => pool.end())
