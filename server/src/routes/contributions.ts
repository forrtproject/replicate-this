import { Hono } from 'hono'
import { and, eq, sql, desc } from 'drizzle-orm'
import { db, schema } from '@/db'
import { notify, notifySubscribers } from '@/lib/notify'
import { PUBLIC_STATUSES } from '@/db/queries'
import { requireUser, HttpError, type AppEnv } from '@/middleware/auth'

export const contributionsRouter = new Hono<AppEnv>()

async function getNomination(id: string) {
  const [n] = await db
    .select({
      id: schema.nominations.id,
      status: schema.nominations.status,
      nominatorUid: schema.nominations.nominatorUid,
    })
    .from(schema.nominations)
    .where(eq(schema.nominations.id, id))
    .limit(1)
  if (!n) throw new HttpError(404, 'Nomination not found.')
  return n
}

async function count(nominationId: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.contributions)
    .where(eq(schema.contributions.nominationId, nominationId))
  return n
}

/** UIDs of everyone contributing to a nomination. */
async function contributorUids(nominationId: string): Promise<string[]> {
  const rows = await db
    .select({ uid: schema.contributions.contributorUid })
    .from(schema.contributions)
    .where(eq(schema.contributions.nominationId, nominationId))
  return rows.map((r) => r.uid)
}

/** Everyone on the team: the nominator plus all contributors (may include dupes). */
async function teamMemberUids(
  nominationId: string,
  nominatorUid: string | null,
): Promise<string[]> {
  const uids = new Set(await contributorUids(nominationId))
  if (nominatorUid) uids.add(nominatorUid)
  return [...uids]
}

async function isContributor(nominationId: string, uid: string): Promise<boolean> {
  const [row] = await db
    .select({ x: sql`1` })
    .from(schema.contributions)
    .where(
      and(
        eq(schema.contributions.nominationId, nominationId),
        eq(schema.contributions.contributorUid, uid),
      ),
    )
    .limit(1)
  return Boolean(row)
}

// Current user's contributions, with the nomination they joined.
contributionsRouter.get('/mine', async (c) => {
  const user = requireUser(c)
  const rows = await db
    .select({
      nominationId: schema.contributions.nominationId,
      message: schema.contributions.message,
      createdAt: schema.contributions.createdAt,
      nomination: schema.nominations,
    })
    .from(schema.contributions)
    .innerJoin(
      schema.nominations,
      eq(schema.nominations.id, schema.contributions.nominationId),
    )
    .where(eq(schema.contributions.contributorUid, user.id))
    .orderBy(desc(schema.contributions.createdAt))
  return c.json({ contributions: rows })
})

// Signal intent to replicate. Auto-accepted — no handshake.
contributionsRouter.post('/:nominationId', async (c) => {
  const user = requireUser(c)
  const nominationId = c.req.param('nominationId')
  const body = await c.req.json().catch(() => ({}))
  const message = String(body.message ?? '').trim()

  const nomination = await getNomination(nominationId)
  if (!PUBLIC_STATUSES.includes(nomination.status as never)) {
    throw new HttpError(400, 'This nomination is not open for contributions.')
  }
  if (nomination.nominatorUid === user.id) {
    throw new HttpError(400, 'You nominated this study — you are already involved.')
  }

  // A genuine join vs. re-saving the pitch message: only a first join fans out
  // notifications, subscribes the user, and advances the lifecycle.
  const isNewJoin = !(await isContributor(nominationId, user.id))

  await db
    .insert(schema.contributions)
    .values({ nominationId, contributorUid: user.id, message })
    .onConflictDoUpdate({
      target: [schema.contributions.nominationId, schema.contributions.contributorUid],
      set: { message },
    })

  if (nomination.nominatorUid) {
    await notify([
      {
        userUid: nomination.nominatorUid,
        type: 'new_contribution',
        data: { nominationId, contributorToken: user.id.slice(0, 8) },
      },
    ])
  }
  await notifySubscribers(nominationId, 'watched_contribution', {}, user.id)

  if (isNewJoin) {
    // Auto-subscribe the new member to the study they just joined.
    await db
      .insert(schema.subscriptions)
      .values({ nominationId, userUid: user.id })
      .onConflictDoNothing()

    // Tell the rest of the team (contributors, minus the joiner and the
    // nominator who already got `new_contribution`) that someone joined.
    const others = (await contributorUids(nominationId)).filter(
      (uid) => uid !== user.id && uid !== nomination.nominatorUid,
    )
    await notify(
      others.map((uid) => ({
        userUid: uid,
        type: 'team_member_joined',
        data: { nominationId, contributorToken: user.id.slice(0, 8) },
      })),
    )

    // First contributor moves an open (approved) study into progress.
    if (nomination.status === 'approved') {
      await db
        .update(schema.nominations)
        .set({ status: 'in_progress', lastActivityAt: new Date() })
        .where(eq(schema.nominations.id, nominationId))
      await notifySubscribers(nominationId, 'watched_status', { status: 'in_progress' }, user.id)
    }
  }

  return c.json({ userContributed: true, contributions: await count(nominationId) }, 201)
})

// Withdraw a contribution.
contributionsRouter.delete('/:nominationId', async (c) => {
  const user = requireUser(c)
  const nominationId = c.req.param('nominationId')

  const [removed] = await db
    .delete(schema.contributions)
    .where(
      and(
        eq(schema.contributions.nominationId, nominationId),
        eq(schema.contributions.contributorUid, user.id),
      ),
    )
    .returning({ id: schema.contributions.id })

  if (removed) {
    // Drop any email shares this member made or received on the nomination.
    await db
      .delete(schema.teamEmailShares)
      .where(
        and(
          eq(schema.teamEmailShares.nominationId, nominationId),
          sql`(${schema.teamEmailShares.sharerUid} = ${user.id} or ${schema.teamEmailShares.recipientUid} = ${user.id})`,
        ),
      )

    // When the last contributor leaves, an in-progress study reverts to open.
    if ((await count(nominationId)) === 0) {
      const [n] = await db
        .select({ status: schema.nominations.status })
        .from(schema.nominations)
        .where(eq(schema.nominations.id, nominationId))
        .limit(1)
      if (n?.status === 'in_progress') {
        await db
          .update(schema.nominations)
          .set({ status: 'approved', lastActivityAt: new Date() })
          .where(eq(schema.nominations.id, nominationId))
        await notifySubscribers(nominationId, 'watched_status', { status: 'approved' }, user.id)
      }
    }
  }

  return c.json({ userContributed: false, contributions: await count(nominationId) })
})

// Share your notification email with teammates on this nomination. Body:
//   { all: true }            → share with everyone currently on the team, or
//   { recipientUid: "..." }  → share with one specific teammate.
// Directional: it grants that person visibility of your email; it doesn't reveal
// theirs. There is no revoke — withdrawing from the nomination clears the shares.
contributionsRouter.post('/:nominationId/share-email', async (c) => {
  const user = requireUser(c)
  const nominationId = c.req.param('nominationId')
  const body = await c.req.json().catch(() => ({}))

  const nomination = await getNomination(nominationId)
  const onTeam =
    nomination.nominatorUid === user.id || (await isContributor(nominationId, user.id))
  if (!onTeam) throw new HttpError(403, 'Only team members can share their email.')

  const members = new Set(await teamMemberUids(nominationId, nomination.nominatorUid))
  members.delete(user.id)

  let recipients: string[]
  if (body.all === true) {
    recipients = [...members]
  } else {
    const recipientUid = String(body.recipientUid ?? '')
    if (!recipientUid) throw new HttpError(400, 'recipientUid or all is required.')
    if (!members.has(recipientUid)) {
      throw new HttpError(400, 'That person is not on this team.')
    }
    recipients = [recipientUid]
  }

  if (recipients.length > 0) {
    await db
      .insert(schema.teamEmailShares)
      .values(recipients.map((uid) => ({ nominationId, sharerUid: user.id, recipientUid: uid })))
      .onConflictDoNothing()
  }
  return c.json({ ok: true, shared: recipients.length })
})
