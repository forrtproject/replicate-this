/**
 * Non-destructive demo data. Adds realistic nominations with votes, predictions
 * and contributions so the site looks populated. Safe to re-run — it never
 * deletes anything and skips nominations whose DOI already exists.
 *
 *   npm run db:demo
 */
import { eq } from 'drizzle-orm'
import { db, schema, pool } from '@/db'
import { milestoneFor } from '@/lib/admin-alerts'

// Pseudonymous demo researchers. A few opt into a display name + contact link
// to show those features on the registry.
const DEMO_USERS: { id: string; name?: string; links?: Record<string, string> }[] = [
  { id: 'demo_user_01', name: 'Dr. Jane Cortez', links: { orcid: 'https://orcid.org/0000-0002-1825-0097' } },
  { id: 'demo_user_02' },
  { id: 'demo_user_03', name: 'Marco Bianchi', links: { github: 'https://github.com/mbianchi' } },
  { id: 'demo_user_04' },
  { id: 'demo_user_05' },
  { id: 'demo_user_06' },
  { id: 'demo_user_07', name: 'Aisha Rahman', links: { website: 'https://example.org/aisha' } },
  { id: 'demo_user_08' },
  { id: 'demo_user_09' },
  { id: 'demo_user_10' },
  { id: 'demo_user_11' },
  { id: 'demo_user_12' },
]
const IDS = DEMO_USERS.map((u) => u.id)

type Nom = {
  doi: string
  discipline: string
  verificationType: 'replication' | 'reproduction' | 'both'
  availability: string[]
  status: string
  upvotes: number
  yes: number
  no: number
  nominator: string
  metadata: { title: string; authors: string[]; journal: string; publication_date: string }
  justification: string
  dataLocation?: string
  robustnessChecks?: string
  designDeviations?: string
  contributors?: { uid: string; message: string }[]
}

const NOMS: Nom[] = [
  {
    doi: '10.1037/a0021524',
    discipline: 'Psychology',
    verificationType: 'replication',
    availability: ['open_data'],
    status: 'approved',
    upvotes: 12,
    yes: 2,
    no: 9,
    nominator: 'demo_user_01',
    metadata: {
      title: 'Feeling the Future: Anomalous Retroactive Influences on Cognition and Affect',
      authors: ['Bem, D. J.'],
      journal: 'Journal of Personality and Social Psychology',
      publication_date: '2011',
    },
    justification:
      'A landmark, highly cited claim of precognition that catalysed the replication debate. Independent, well-powered replications would clarify the evidence base.',
    designDeviations: 'Pre-register, increase power substantially, and use a blinded automated protocol.',
  },
  {
    doi: '10.1257/aer.100.2.573',
    discipline: 'Economics',
    verificationType: 'reproduction',
    availability: ['open_data', 'open_code'],
    status: 'completed',
    upvotes: 11,
    yes: 5,
    no: 5,
    nominator: 'demo_user_02',
    metadata: {
      title: 'Growth in a Time of Debt',
      authors: ['Reinhart, C. M.', 'Rogoff, K. S.'],
      journal: 'American Economic Review',
      publication_date: '2010',
    },
    justification:
      'Influential on austerity policy; a widely discussed reproduction found a spreadsheet error. Re-running the analysis on the original data is valuable for the record.',
    dataLocation: 'https://example.org/reinhart-rogoff-data',
    robustnessChecks: 'Re-estimate excluding the coding error and with alternative country weightings.',
  },
  {
    doi: '10.1371/journal.pmed.0020124',
    discipline: 'Medicine',
    verificationType: 'reproduction',
    availability: ['open_access'],
    status: 'published',
    upvotes: 12,
    yes: 3,
    no: 8,
    nominator: 'demo_user_03',
    metadata: {
      title: 'Why Most Published Research Findings Are False',
      authors: ['Ioannidis, J. P. A.'],
      journal: 'PLoS Medicine',
      publication_date: '2005',
    },
    justification:
      'A foundational meta-scientific argument. Reproducing its modelling assumptions and extending them to modern fields would strengthen or temper its claims.',
    robustnessChecks: 'Vary the pre-study odds and bias parameters across disciplines.',
  },
  {
    doi: '10.1037/0022-3514.74.5.1252',
    discipline: 'Psychology',
    verificationType: 'replication',
    availability: ['open_materials'],
    status: 'in_progress',
    upvotes: 9,
    yes: 4,
    no: 5,
    nominator: 'demo_user_04',
    metadata: {
      title: 'Ego Depletion: Is the Active Self a Limited Resource?',
      authors: ['Baumeister, R. F.', 'Bratslavsky, E.', 'Muraven, M.', 'Tice, D. M.'],
      journal: 'Journal of Personality and Social Psychology',
      publication_date: '1998',
    },
    justification:
      'The origin of the ego-depletion literature; large multi-lab efforts have reported mixed results. A fresh, pre-registered replication would help.',
    designDeviations: 'Use the pre-registered RRR protocol and a larger, more diverse sample.',
    contributors: [{ uid: 'demo_user_05', message: 'Two labs available, targeting N ≈ 300 in the autumn.' }],
  },
  {
    doi: '10.1037/0022-3514.54.5.768',
    discipline: 'Psychology',
    verificationType: 'replication',
    availability: ['open_materials'],
    status: 'approved',
    upvotes: 10,
    yes: 3,
    no: 6,
    nominator: 'demo_user_06',
    metadata: {
      title: 'Inhibiting and Facilitating Conditions of the Human Smile (Facial Feedback)',
      authors: ['Strack, F.', 'Martin, L. L.', 'Stepper, S.'],
      journal: 'Journal of Personality and Social Psychology',
      publication_date: '1988',
    },
    justification:
      'The classic pen-in-mouth facial-feedback study; a Registered Replication Report did not reproduce the effect. Further careful replications remain informative.',
  },
  {
    doi: '10.1038/483531a',
    discipline: 'Biology',
    verificationType: 'reproduction',
    availability: ['open_data'],
    status: 'approved',
    upvotes: 7,
    yes: 2,
    no: 4,
    nominator: 'demo_user_07',
    metadata: {
      title: 'Drug Development: Raise Standards for Preclinical Cancer Research',
      authors: ['Begley, C. G.', 'Ellis, L. M.'],
      journal: 'Nature',
      publication_date: '2012',
    },
    justification:
      'Reported that most landmark preclinical cancer findings could not be reproduced. Systematic reproductions of the underlying studies are high value.',
    dataLocation: 'https://example.org/preclinical-repro',
  },
  {
    doi: '10.1126/science.aaf0918',
    discipline: 'Economics',
    verificationType: 'replication',
    availability: ['open_data', 'open_code', 'open_access'],
    status: 'in_progress',
    upvotes: 6,
    yes: 4,
    no: 1,
    nominator: 'demo_user_08',
    metadata: {
      title: 'Evaluating Replicability of Laboratory Experiments in Economics',
      authors: ['Camerer, C. F.', 'et al.'],
      journal: 'Science',
      publication_date: '2016',
    },
    justification:
      'A systematic replication project in experimental economics. Extending it to newer studies keeps the replicability estimate current.',
    contributors: [{ uid: 'demo_user_09', message: 'Happy to run two of the online experiments.' }],
  },
  {
    doi: '10.1111/j.1539-6053.2009.01038.x',
    discipline: 'Education',
    verificationType: 'reproduction',
    availability: [],
    status: 'approved',
    upvotes: 8,
    yes: 1,
    no: 6,
    nominator: 'demo_user_09',
    metadata: {
      title: 'Learning Styles: Concepts and Evidence',
      authors: ['Pashler, H.', 'McDaniel, M.', 'Rohrer, D.', 'Bjork, R.'],
      journal: 'Psychological Science in the Public Interest',
      publication_date: '2008',
    },
    justification:
      'Widely applied in classrooms despite weak evidence. Reproducing the review and any underlying tests informs teaching practice.',
  },
  {
    doi: '10.1038/s41562-023-01749-9',
    discipline: 'Sociology',
    verificationType: 'both',
    availability: ['open_data', 'preregistration'],
    status: 'pending',
    upvotes: 2,
    yes: 1,
    no: 0,
    nominator: 'demo_user_10',
    metadata: {
      title: 'A Recent Large-Scale Study of Online Social Influence',
      authors: ['Nguyen, T.', 'Okoro, C.'],
      journal: 'Nature Human Behaviour',
      publication_date: '2023',
    },
    justification:
      'Freshly nominated and awaiting review — a highly shared recent finding that would benefit from an independent second look.',
  },
]

async function seed() {
  // Ensure demo users exist (never overwrite existing rows).
  await db
    .insert(schema.user)
    .values(
      DEMO_USERS.map((u) => ({
        id: u.id,
        name: u.name ?? `Researcher-${u.id.slice(-6)}`,
        email: `${u.id}@demo.invalid`,
        emailVerified: true,
        role: 'user',
        links: u.links ?? {},
      })),
    )
    .onConflictDoNothing()

  let added = 0
  for (const nom of NOMS) {
    const existing = await db
      .select({ id: schema.nominations.id })
      .from(schema.nominations)
      .where(eq(schema.nominations.doi, nom.doi))
      .limit(1)
    if (existing[0]) continue

    const [ins] = await db
      .insert(schema.nominations)
      .values({
        doi: nom.doi,
        metadata: nom.metadata,
        discipline: nom.discipline,
        verificationType: nom.verificationType,
        availability: nom.availability,
        justification: nom.justification,
        dataLocation: nom.dataLocation ?? '',
        robustnessChecks: nom.robustnessChecks ?? '',
        designDeviations: nom.designDeviations ?? '',
        nominatorUid: nom.nominator,
        status: nom.status,
        lastMilestone: milestoneFor(nom.upvotes),
      })
      .returning({ id: schema.nominations.id })

    const voters = IDS.slice(0, nom.upvotes)
    if (voters.length) {
      await db
        .insert(schema.votes)
        .values(voters.map((u) => ({ nominationId: ins.id, userUid: u })))
        .onConflictDoNothing()
    }

    const yesUsers = IDS.slice(0, nom.yes)
    const noUsers = IDS.slice(nom.yes, nom.yes + nom.no)
    const preds = [
      ...yesUsers.map((u) => ({ nominationId: ins.id, userUid: u, willReplicate: true })),
      ...noUsers.map((u) => ({ nominationId: ins.id, userUid: u, willReplicate: false })),
    ]
    if (preds.length) await db.insert(schema.predictions).values(preds).onConflictDoNothing()

    if (nom.contributors?.length) {
      await db
        .insert(schema.contributions)
        .values(
          nom.contributors.map((ct) => ({
            nominationId: ins.id,
            contributorUid: ct.uid,
            message: ct.message,
          })),
        )
        .onConflictDoNothing()
    }

    added++
  }

  console.log(`Demo data ready: ${added} new nomination(s) added (${NOMS.length - added} already present).`)
  await pool.end()
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
