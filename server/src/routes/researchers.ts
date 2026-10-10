import { Hono } from 'hono'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { listPublicNominations, PUBLIC_STATUSES } from '@/db/queries'
import { HttpError, type AppEnv } from '@/middleware/auth'
import type { NominationMetadata, ProfileLinks } from '@/types'

export const researchersRouter = new Hono<AppEnv>()

// Public profile, addressed by the 8-character researcher token that already
// appears next to every name — the full user id is never exposed. Shows only
// what is public anyway: name, avatar, opt-in links, public nominations and
// the studies they contribute to.
researchersRouter.get('/:token', async (c) => {
  const token = c.req.param('token')
  if (!/^[A-Za-z0-9_-]{8}$/.test(token)) throw new HttpError(404, 'Researcher not found.')

  const [u] = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      image: schema.user.image,
      links: schema.user.links,
      createdAt: schema.user.createdAt,
    })
    .from(schema.user)
    .where(and(sql`substr(${schema.user.id}, 1, 8) = ${token}`, eq(schema.user.deleted, false)))
    .limit(1)
  if (!u) throw new HttpError(404, 'Researcher not found.')

  const viewer = c.get('user')?.id ?? null
  const contributing = await db
    .select({
      id: schema.nominations.id,
      doi: schema.nominations.doi,
      metadata: schema.nominations.metadata,
      status: schema.nominations.status,
    })
    .from(schema.contributions)
    .innerJoin(schema.nominations, eq(schema.nominations.id, schema.contributions.nominationId))
    .where(
      and(
        eq(schema.contributions.contributorUid, u.id),
        inArray(schema.nominations.status, [...PUBLIC_STATUSES]),
      ),
    )
    .orderBy(desc(schema.contributions.createdAt))

  return c.json({
    token,
    name: u.name,
    image: u.image ?? '',
    links: (u.links ?? {}) as ProfileLinks,
    joinedAt: u.createdAt,
    isSelf: viewer === u.id,
    nominations: await listPublicNominations(viewer, u.id),
    contributions: contributing.map((n) => ({
      id: n.id,
      doi: n.doi,
      title: (n.metadata as NominationMetadata).title,
      status: n.status,
    })),
  })
})
