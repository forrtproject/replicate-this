/**
 * Dev-only: mint signed session cookies for seeded users so tools such as the
 * screenshot harness (web/scripts/screenshots.mjs) can view signed-in pages
 * without going through OAuth. Prints JSON: { role: cookieValue }.
 *
 *   npx tsx src/scripts/dev-sessions.ts > /path/to/sessions.json
 *
 * Roles: `admin` (seed maintainer), `user` (seed researcher with nominations),
 * `newcomer` (a fresh, not-yet-onboarded account, recreated on each run).
 * Refuses to run when NODE_ENV=production.
 */
import { randomBytes, createHmac } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db, schema, pool } from '@/db'

if (process.env.NODE_ENV === 'production') {
  console.error('dev-sessions is a development tool and will not run in production.')
  process.exit(1)
}

const secret = process.env.BETTER_AUTH_SECRET
if (!secret) throw new Error('BETTER_AUTH_SECRET is not set')

const NEWCOMER_ID = 'dev_newcomer_0001'

// Same format as better-call's signCookieValue: `${token}.${base64(hmac)}`, URI-encoded.
function sign(token: string) {
  const sig = createHmac('sha256', secret!).update(token).digest('base64')
  return encodeURIComponent(`${token}.${sig}`)
}

async function mint(userId: string) {
  const token = randomBytes(24).toString('hex')
  await db.insert(schema.session).values({
    id: randomBytes(12).toString('hex'),
    token,
    userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
  })
  return sign(token)
}

async function main() {
  await db.delete(schema.user).where(eq(schema.user.id, NEWCOMER_ID))
  await db.insert(schema.user).values({
    id: NEWCOMER_ID,
    name: 'EagerNeuron24',
    email: `${NEWCOMER_ID}@dev.invalid`,
    emailVerified: true,
    role: 'user',
    onboarded: false,
  })

  const out = {
    cookieName: 'replicate-this.session_token',
    admin: await mint('4f2a9c71e8b3d05a'),
    user: await mint('c81e5d3a90f7b264'),
    newcomer: await mint(NEWCOMER_ID),
  }
  console.log(JSON.stringify(out))
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
