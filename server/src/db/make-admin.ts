/**
 * Promote a user to maintainer. Dev bootstrap helper.
 *
 *   npm run make-admin           # promotes the most recently created user
 *   npm run make-admin a1b2c3    # promotes the user whose id starts with a1b2c3
 */
import { desc, eq } from 'drizzle-orm'
import { db, schema, pool } from '@/db'

async function main() {
  const token = process.argv[2]?.toLowerCase()

  let target: { id: string; role: string } | undefined
  if (token) {
    const rows = await db
      .select({ id: schema.user.id, role: schema.user.role })
      .from(schema.user)
      .where(eq(schema.user.deleted, false))
    target = rows.find((u) => u.id.toLowerCase().startsWith(token))
  } else {
    ;[target] = await db
      .select({ id: schema.user.id, role: schema.user.role })
      .from(schema.user)
      .where(eq(schema.user.deleted, false))
      .orderBy(desc(schema.user.createdAt))
      .limit(1)
  }

  if (!target) {
    console.error(token ? `No user found starting with #${token}` : 'No users exist yet.')
    process.exit(1)
  }

  await db
    .update(schema.user)
    .set({ role: 'maintainer', updatedAt: new Date() })
    .where(eq(schema.user.id, target.id))

  console.log(`Promoted #${target.id.slice(0, 8)} to maintainer.`)
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
