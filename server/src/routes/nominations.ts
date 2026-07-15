import { Hono } from 'hono'
import { and, eq, ne, desc } from 'drizzle-orm'
import { db, schema } from '@/db'
import {
  DISCIPLINES,
  VERIFICATION_TYPES,
  AVAILABILITY_KEYS,
  type NominationMetadata,
} from '@/types'
import { fetchDoiMetadata, normalizeDoi, DoiLookupError } from '@/lib/crossref'
import { notify, notifyMaintainers } from '@/lib/notify'
import {
  listPublicNominations,
  getNominationDetail,
  PUBLIC_STATUSES,
} from '@/db/queries'
import { requireUser, HttpError, type AppEnv } from '@/middleware/auth'

export const nominationsRouter = new Hono<AppEnv>()

// Public registry list.
nominationsRouter.get('/', async (c) => {
  const viewer = c.get('user')?.id ?? null
  return c.json({ nominations: await listPublicNominations(viewer) })
})

// Current user's own nominations (any status). Must precede '/:id'.
nominationsRouter.get('/mine', async (c) => {
  const user = requireUser(c)
  const rows = await db
    .select()
    .from(schema.nominations)
    .where(eq(schema.nominations.nominatorUid, user.id))
    .orderBy(desc(schema.nominations.createdAt))
  return c.json({ nominations: rows })
})

function isValidMetadata(m: unknown): m is NominationMetadata {
  if (!m || typeof m !== 'object') return false
  const v = m as Record<string, unknown>
  return typeof v.title === 'string' && v.title.trim().length > 0
}

/**
 * Parses and validates the nomination fields shared by submit (POST) and
 * edit (PATCH). Throws HttpError(400) on invalid input.
 */
function parseNominationFields(body: Record<string, unknown>) {
  const discipline = String(body.discipline ?? '')
  const verificationType = String(body.verificationType ?? 'replication')
  const justification = String(body.justification ?? '').trim()
  const journalOverride = String(body.journal ?? '').trim()
  const dataLocation = String(body.dataLocation ?? '').trim()
  const robustnessChecks = String(body.robustnessChecks ?? '').trim()
  const designDeviations = String(body.designDeviations ?? '').trim()
  const replicationGames = body.replicationGames === true
  const availability = Array.isArray(body.availability)
    ? [...new Set(body.availability.map(String))].filter((a) =>
        AVAILABILITY_KEYS.includes(a as never),
      )
    : []

  // Optional URL per available item; keep only valid http(s) links for chosen keys.
  const rawLinks = (body.availabilityLinks ?? {}) as Record<string, unknown>
  const availabilityLinks: Record<string, string> = {}
  for (const key of availability as string[]) {
    const url = String(rawLinks[key] ?? '').trim()
    if (!url) continue
    if (!/^https?:\/\/.+/i.test(url)) {
      throw new HttpError(400, `The link for “${key}” must be a full http(s) URL.`)
    }
    availabilityLinks[key] = url
  }

  if (!DISCIPLINES.includes(discipline as never)) {
    throw new HttpError(400, 'Please choose a valid discipline.')
  }
  if (!VERIFICATION_TYPES.includes(verificationType as never)) {
    throw new HttpError(400, 'Please choose replication, reproduction, or both.')
  }
  if (justification.length < 20) {
    throw new HttpError(400, 'Justification must be at least 20 characters.')
  }

  return {
    discipline,
    verificationType,
    justification,
    journalOverride,
    dataLocation,
    robustnessChecks,
    designDeviations,
    replicationGames,
    availability,
    availabilityLinks,
  }
}

// Submit a nomination.
nominationsRouter.post('/', async (c) => {
  const user = requireUser(c)
  const body = await c.req.json().catch(() => ({}))

  const rawDoi = String(body.doi ?? '').trim()
  const manual = body.metadata as NominationMetadata | undefined
  const {
    discipline,
    verificationType,
    justification,
    journalOverride,
    dataLocation,
    robustnessChecks,
    designDeviations,
    replicationGames,
    availability,
    availabilityLinks,
  } = parseNominationFields(body)

  if (!rawDoi) throw new HttpError(400, 'DOI is required.')

  const doi = normalizeDoi(rawDoi)

  // Reject duplicates unless the prior nomination was itself rejected.
  const existing = await db
    .select({ id: schema.nominations.id })
    .from(schema.nominations)
    .where(and(eq(schema.nominations.doi, doi), ne(schema.nominations.status, 'rejected')))
    .limit(1)
  if (existing[0]) {
    return c.json(
      { error: 'This study has already been nominated.', existingId: existing[0].id },
      409,
    )
  }

  // Metadata: manual entry wins; otherwise resolve via Crossref/doi.org.
  let metadata: NominationMetadata
  let metadataManual = false
  if (isValidMetadata(manual)) {
    metadata = {
      title: manual.title.trim(),
      authors: Array.isArray(manual.authors) ? manual.authors : [],
      journal: manual.journal ?? '',
      publication_date: manual.publication_date ?? '',
    }
    metadataManual = true
  } else {
    try {
      metadata = await fetchDoiMetadata(doi)
    } catch (err) {
      if (err instanceof DoiLookupError) {
        return c.json({ error: err.message, allowManual: err.allowManual }, 422)
      }
      throw err
    }
  }

  // An explicit journal entry overrides whatever the lookup returned.
  if (journalOverride) metadata = { ...metadata, journal: journalOverride }

  const [inserted] = await db
    .insert(schema.nominations)
    .values({
      doi,
      metadata,
      metadataManual,
      discipline,
      verificationType,
      availability,
      availabilityLinks,
      justification,
      dataLocation,
      robustnessChecks,
      designDeviations,
      replicationGames,
      nominatorUid: user.id,
      status: 'pending',
    })
    .returning({ id: schema.nominations.id })

  await notifyMaintainers('new_nomination', { nominationId: inserted.id, doi })

  return c.json({ id: inserted.id }, 201)
})

// Editing is allowed until replication work starts; edits always go back
// under review ('pending'), so approved nominations re-enter the queue.
const EDITABLE_STATUSES = ['pending', 'approved'] as const

// Edit a nomination (nominator or maintainer). The DOI and fetched reference
// are immutable — a different paper should be a new nomination.
nominationsRouter.patch('/:id', async (c) => {
  const user = requireUser(c)
  const id = c.req.param('id')

  const [existing] = await db
    .select()
    .from(schema.nominations)
    .where(eq(schema.nominations.id, id))
    .limit(1)
  if (!existing) throw new HttpError(404, 'Nomination not found.')

  const isAdmin = user.role === 'maintainer'
  const isNominator = existing.nominatorUid === user.id
  if (!isAdmin && !isNominator) {
    throw new HttpError(403, 'Only the nominator or a maintainer can edit this nomination.')
  }
  if (!EDITABLE_STATUSES.includes(existing.status as never)) {
    throw new HttpError(409, 'This nomination can no longer be edited — replication work has started or it was rejected.')
  }

  const body = await c.req.json().catch(() => ({}))
  const fields = parseNominationFields(body)

  const metadata = existing.metadata as NominationMetadata
  await db
    .update(schema.nominations)
    .set({
      discipline: fields.discipline,
      verificationType: fields.verificationType,
      availability: fields.availability,
      availabilityLinks: fields.availabilityLinks,
      justification: fields.justification,
      dataLocation: fields.dataLocation,
      robustnessChecks: fields.robustnessChecks,
      designDeviations: fields.designDeviations,
      replicationGames: fields.replicationGames,
      metadata: fields.journalOverride
        ? { ...metadata, journal: fields.journalOverride }
        : metadata,
      status: 'pending',
      lastActivityAt: new Date(),
    })
    .where(eq(schema.nominations.id, id))

  if (isAdmin && !isNominator) {
    await db.insert(schema.moderationLogs).values({
      adminUid: user.id,
      nominationId: id,
      action: 'edited',
    })
    if (existing.nominatorUid) {
      await notify([
        {
          userUid: existing.nominatorUid,
          type: 'nomination_admin_edited',
          data: { nominationId: id },
        },
      ])
    }
  } else {
    await notifyMaintainers('nomination_edited', { nominationId: id, doi: existing.doi })
  }

  return c.json({ ok: true })
})

// Single nomination detail.
nominationsRouter.get('/:id', async (c) => {
  const viewer = c.get('user')?.id ?? null
  const nomination = await getNominationDetail(c.req.param('id'), viewer)
  if (!nomination) throw new HttpError(404, 'Nomination not found.')

  // Hide non-public nominations from non-owners/non-admins.
  const user = c.get('user')
  const isPublic = PUBLIC_STATUSES.includes(nomination.status as never)
  const isAdmin = user?.role === 'maintainer'
  if (!isPublic && !nomination.viewerIsNominator && !isAdmin) {
    throw new HttpError(404, 'Nomination not found.')
  }

  return c.json({ nomination })
})

// The replication team: pseudonymous tokens of everyone contributing.
nominationsRouter.get('/:id/contributors', async (c) => {
  const id = c.req.param('id')
  const [n] = await db
    .select({ status: schema.nominations.status })
    .from(schema.nominations)
    .where(eq(schema.nominations.id, id))
    .limit(1)
  if (!n || !PUBLIC_STATUSES.includes(n.status as never)) {
    throw new HttpError(404, 'Nomination not found.')
  }

  const rows = await db
    .select({
      contributorUid: schema.contributions.contributorUid,
      name: schema.user.name,
      links: schema.user.links,
      message: schema.contributions.message,
      createdAt: schema.contributions.createdAt,
    })
    .from(schema.contributions)
    .innerJoin(schema.user, eq(schema.user.id, schema.contributions.contributorUid))
    .where(eq(schema.contributions.nominationId, id))
    .orderBy(schema.contributions.createdAt)

  return c.json({
    contributors: rows.map((r) => ({
      token: r.contributorUid.slice(0, 8),
      name: r.name,
      links: (r.links ?? {}) as Record<string, string>,
      message: r.message,
      createdAt: r.createdAt,
    })),
  })
})
