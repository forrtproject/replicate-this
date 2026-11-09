/**
 * Dev seed: a maintainer, two researchers, and a few nominations with votes
 * and predictions. Run with `npm run db:seed`. Idempotent-ish: clears app rows
 * first. NOT for production.
 */
import { db, schema, pool } from '@/db'

async function seed() {
  // Wipe app + auth rows (dev only).
  await db.delete(schema.predictions)
  await db.delete(schema.votes)
  await db.delete(schema.contributions)
  await db.delete(schema.notifications)
  await db.delete(schema.moderationLogs)
  await db.delete(schema.nominations)
  await db.delete(schema.user)

  const users = [
    { id: '4f2a9c71e8b3d05a', name: 'SteadyAxiom12', role: 'maintainer', email: 'a@privacy.forrt.org' },
    { id: 'c81e5d3a90f7b264', name: 'CuriousQuasar42', role: 'user', email: 'b@privacy.forrt.org' },
    { id: '9b0d47e2a6c1f835', name: 'RigorousNeutrino7', role: 'user', email: 'c@privacy.forrt.org' },
  ]
  await db.insert(schema.user).values(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      emailVerified: true,
      role: u.role,
    })),
  )

  const nominations = [
    {
      doi: '10.1177/0956797610383437',
      discipline: 'Psychology',
      verificationType: 'replication',
      availability: ['open_data', 'open_materials'],
      status: 'approved',
      justification:
        'Highly cited power-posing study with a widely discussed failed replication record.',
      metadata: {
        title: 'Power Posing: Brief Nonverbal Displays Affect Neuroendocrine Levels',
        authors: ['Carney, D.', 'Cuddy, A.', 'Yap, A.'],
        journal: 'Psychological Science',
        publication_date: '2010-09-21',
      },
    },
    {
      doi: '10.1126/science.aac4716',
      discipline: 'Psychology',
      verificationType: 'reproduction',
      availability: ['open_data', 'open_code', 'preregistration', 'open_access'],
      status: 'in_progress',
      justification:
        'The Reproducibility Project itself — a cornerstone meta-study worth continuous verification.',
      metadata: {
        title: 'Estimating the reproducibility of psychological science',
        authors: ['Open Science Collaboration'],
        journal: 'Science',
        publication_date: '2015-08-28',
      },
    },
    {
      doi: '10.1016/j.cell.2014.09.045',
      discipline: 'Biology',
      verificationType: 'both',
      availability: [],
      status: 'approved',
      justification:
        'Influential cell-biology result with downstream clinical implications; independent reproduction valuable.',
      metadata: {
        title: 'A landmark cell signalling pathway result',
        authors: ['Doe, J.', 'Smith, K.'],
        journal: 'Cell',
        publication_date: '2014',
      },
    },
    {
      doi: '10.1038/s41586-020-2649-2',
      discipline: 'Economics',
      verificationType: 'reproduction',
      availability: ['open_data', 'open_code'],
      status: 'pending',
      justification:
        'Freshly nominated — awaiting maintainer review, but visible so the community can start signalling priority.',
      metadata: {
        title: 'A recently nominated economics study under review',
        authors: ['Nguyen, T.'],
        journal: 'Nature',
        publication_date: '2020',
      },
    },
  ]

  const inserted = await db
    .insert(schema.nominations)
    .values(
      nominations.map((n) => ({ ...n, nominatorUid: 'c81e5d3a90f7b264' })),
    )
    .returning({ id: schema.nominations.id })

  const [n1, n2, n3] = inserted

  await db.insert(schema.votes).values([
    { nominationId: n1.id, userUid: '4f2a9c71e8b3d05a' },
    { nominationId: n1.id, userUid: '9b0d47e2a6c1f835' },
    { nominationId: n2.id, userUid: '9b0d47e2a6c1f835' },
  ])

  await db.insert(schema.predictions).values([
    { nominationId: n1.id, userUid: '4f2a9c71e8b3d05a', willReplicate: false },
    { nominationId: n1.id, userUid: '9b0d47e2a6c1f835', willReplicate: false },
    { nominationId: n2.id, userUid: '9b0d47e2a6c1f835', willReplicate: true },
  ])

  await db.insert(schema.contributions).values([
    { nominationId: n2.id, contributorUid: '9b0d47e2a6c1f835', message: 'Have a lab ready for Q3.' },
  ])

  console.log(`Seeded ${users.length} users and ${inserted.length} nominations.`)
  console.log(`Nomination ids: ${n1.id}, ${n2.id}, ${n3.id}`)
  await pool.end()
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
