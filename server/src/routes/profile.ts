import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import {
  EMAIL_PREF_KEYS,
  resolveEmailPrefs,
  type ProfileLinks,
  type EmailPrefs,
} from '@/types'
import { generateUniquePseudonym, pseudonymTaken, validatePseudonym } from '@/lib/pseudonym'
import { sanitizeLinks, LinkError } from '@/lib/profile-links'
import { requireUser, HttpError, type AppEnv } from '@/middleware/auth'

export const profileRouter = new Hono<AppEnv>()

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
    // Accounts that never touched the settings read as fully opted in.
    emailPrefs: resolveEmailPrefs(row.emailPrefs),
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
      throw new HttpError(400, 'That image is too large. Use one under about 1 MB.')
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

// Email notifications: the address (required) plus per-category preferences.
// Unchecking every category stops the emails; in-app notifications are unaffected.
profileRouter.patch('/email', async (c) => {
  const user = requireUser(c)
  const body = await c.req.json().catch(() => ({}))

  const email = String(body.email ?? '').trim()
  if (!email) throw new HttpError(400, 'A notification email address is required.')
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'Enter a valid email address.')
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
  let links: ProfileLinks
  try {
    links = sanitizeLinks(body.links)
  } catch (err) {
    if (err instanceof LinkError) throw new HttpError(400, err.message)
    throw err
  }
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
    throw new HttpError(409, 'That name is already taken. Try another.')
  }
  try {
    await db
      .update(schema.user)
      .set({ name, updatedAt: new Date() })
      .where(eq(schema.user.id, user.id))
  } catch (err) {
    // Unique-index race: someone claimed the name between check and write.
    if ((err as { code?: string }).code === '23505') {
      throw new HttpError(409, 'That name is already taken. Try another.')
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
