import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import {
  PROFILE_LINK_KEYS,
  EMAIL_PREF_KEYS,
  type ProfileLinks,
  type EmailPrefs,
} from '@/types'
import { generateUniquePseudonym, pseudonymTaken, validatePseudonym } from '@/lib/pseudonym'
import { requireUser, HttpError, type AppEnv } from '@/middleware/auth'

export const profileRouter = new Hono<AppEnv>()

/** ISO 7064 MOD 11-2 checksum over the first 15 digits of an ORCID iD. */
function orcidChecksumValid(id16: string): boolean {
  let total = 0
  for (let i = 0; i < 15; i++) total = (total + Number(id16[i])) * 2
  const result = (12 - (total % 11)) % 11
  return (result === 10 ? 'X' : String(result)) === id16[15]
}

/**
 * Accepts an ORCID iD in any common form (bare iD, with/without dashes, or an
 * orcid.org URL) and returns the canonical `https://orcid.org/0000-…` URL.
 */
function normalizeOrcid(raw: string): string {
  const compact = raw
    .trim()
    .replace(/^https?:\/\/(sandbox\.)?orcid\.org\//i, '')
    .replace(/[\s-]/g, '')
    .toUpperCase()
  if (!/^\d{15}[\dX]$/.test(compact)) {
    throw new HttpError(400, 'Enter a valid ORCID iD, e.g. 0000-0002-1825-0097.')
  }
  if (!orcidChecksumValid(compact)) {
    throw new HttpError(400, 'That ORCID iD looks mistyped — its checksum is invalid.')
  }
  const dashed = compact.replace(/(.{4})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4')
  return `https://orcid.org/${dashed}`
}

/** Keep only known keys; ORCID is validated as an iD, the rest as http(s) URLs. */
function sanitizeLinks(input: unknown): ProfileLinks {
  const out: ProfileLinks = {}
  if (!input || typeof input !== 'object') return out
  for (const key of PROFILE_LINK_KEYS) {
    const raw = (input as Record<string, unknown>)[key]
    if (typeof raw !== 'string') continue
    const value = raw.trim()
    if (!value) continue
    if (value.length > 300) throw new HttpError(400, 'Links must be under 300 characters.')
    if (key === 'orcid') {
      out.orcid = normalizeOrcid(value)
    } else if (/^https?:\/\/.+/i.test(value)) {
      out[key] = value
    } else {
      throw new HttpError(400, `The ${key} link must be a full http(s) URL.`)
    }
  }
  return out
}

// Current user's editable profile.
profileRouter.get('/', async (c) => {
  const user = requireUser(c)
  const [row] = await db
    .select({
      name: schema.user.name,
      image: schema.user.image,
      links: schema.user.links,
      notificationEmail: schema.user.notificationEmail,
      emailPrefs: schema.user.emailPrefs,
      onboarded: schema.user.onboarded,
    })
    .from(schema.user)
    .where(eq(schema.user.id, user.id))
    .limit(1)
  if (!row) throw new HttpError(404, 'Profile not found.')
  return c.json({
    name: row.name,
    image: row.image ?? '',
    links: (row.links ?? {}) as ProfileLinks,
    notificationEmail: row.notificationEmail,
    emailPrefs: (row.emailPrefs ?? {}) as EmailPrefs,
    onboarded: row.onboarded,
  })
})

/**
 * A profile avatar is either a short emoji or a small inline image data URL.
 * We store it inline in `user.image` (no blob store) — hence the size cap.
 */
const AVATAR_MAX_BYTES = 1_500_000 // ~1 MB image once base64-encoded
function validateAvatar(image: string): void {
  if (image.startsWith('data:image/')) {
    if (!/^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(image)) {
      throw new HttpError(400, 'Only PNG, JPEG, GIF, or WEBP images are supported.')
    }
    if (image.length > AVATAR_MAX_BYTES) {
      throw new HttpError(400, 'That image is too large — please use one under ~1 MB.')
    }
    return
  }
  // Otherwise it's an emoji (or a couple of them); keep it short.
  if ([...image].length > 8) {
    throw new HttpError(400, 'Choose a single emoji or upload an image.')
  }
}

// Set or clear the profile avatar (emoji or inline image). Send image: '' or null to clear.
profileRouter.patch('/avatar', async (c) => {
  const user = requireUser(c)
  const body = await c.req.json().catch(() => ({}))
  const image = body.image == null ? '' : String(body.image).trim()
  if (image) validateAvatar(image)
  await db
    .update(schema.user)
    .set({ image: image || null, updatedAt: new Date() })
    .where(eq(schema.user.id, user.id))
  return c.json({ image })
})

// Mark the post-signup walkthrough finished (or skipped) so we stop redirecting.
profileRouter.post('/onboarded', async (c) => {
  const user = requireUser(c)
  await db
    .update(schema.user)
    .set({ onboarded: true, updatedAt: new Date() })
    .where(eq(schema.user.id, user.id))
  return c.json({ ok: true })
})

// Opt-in email notifications: an address plus per-category preferences.
// Clearing the address turns all email off; in-app notifications are unaffected.
profileRouter.patch('/email', async (c) => {
  const user = requireUser(c)
  const body = await c.req.json().catch(() => ({}))

  const email = String(body.email ?? '').trim()
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new HttpError(400, 'Enter a valid email address (or leave it empty to opt out).')
  }

  const rawPrefs = (body.prefs ?? {}) as Record<string, unknown>
  const prefs: EmailPrefs = {}
  for (const key of EMAIL_PREF_KEYS) prefs[key] = rawPrefs[key] === true

  await db
    .update(schema.user)
    .set({ notificationEmail: email, emailPrefs: prefs, updatedAt: new Date() })
    .where(eq(schema.user.id, user.id))
  return c.json({ notificationEmail: email, emailPrefs: prefs })
})

// Update contact links (opt-in, self-entered).
profileRouter.patch('/', async (c) => {
  const user = requireUser(c)
  const body = await c.req.json().catch(() => ({}))
  const links = sanitizeLinks(body.links)
  await db
    .update(schema.user)
    .set({ links, updatedAt: new Date() })
    .where(eq(schema.user.id, user.id))
  return c.json({ links })
})

// Change the pseudonym. Must be unique (case-insensitive) across live accounts.
profileRouter.patch('/name', async (c) => {
  const user = requireUser(c)
  const body = await c.req.json().catch(() => ({}))
  const { name, error } = validatePseudonym(String(body.name ?? ''))
  if (error || !name) throw new HttpError(400, error ?? 'Invalid pseudonym.')
  if (await pseudonymTaken(name, user.id)) {
    throw new HttpError(409, 'That pseudonym is already taken — try another.')
  }
  try {
    await db
      .update(schema.user)
      .set({ name, updatedAt: new Date() })
      .where(eq(schema.user.id, user.id))
  } catch (err) {
    // Unique-index race: someone claimed the name between check and write.
    if ((err as { code?: string }).code === '23505') {
      throw new HttpError(409, 'That pseudonym is already taken — try another.')
    }
    throw err
  }
  return c.json({ name })
})

// Suggest a fresh random pseudonym (reddit-style). Nothing is saved — the
// client fills the input and the user must save explicitly.
profileRouter.get('/name/suggestion', async (c) => {
  requireUser(c)
  return c.json({ name: await generateUniquePseudonym() })
})

// Right to erasure via soft delete (tombstone). We sever the login and clear
// all personal data, but KEEP the pseudonymous row so the user's nominations,
// votes, contributions and messages stay intact — now shown as "Deleted account".
profileRouter.delete('/', async (c) => {
  const user = requireUser(c)

  // Remove the identifying linkage: OAuth accounts (provider ids) and sessions.
  await db.delete(schema.session).where(eq(schema.session.userId, user.id))
  await db.delete(schema.account).where(eq(schema.account.userId, user.id))

  // Anonymise the row: no name, no links, a random unlinkable email.
  await db
    .update(schema.user)
    .set({
      name: 'Deleted account',
      email: `${randomUUID()}@deleted.invalid`,
      image: null,
      links: {},
      notificationEmail: '',
      emailPrefs: {},
      role: 'user',
      deleted: true,
      updatedAt: new Date(),
    })
    .where(eq(schema.user.id, user.id))

  return c.json({ ok: true })
})
