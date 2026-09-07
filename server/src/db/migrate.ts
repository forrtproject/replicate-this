import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db, pool } from '@/db'
import { config } from '@/lib/env'

// Production ships without dev dependencies, so drizzle-kit isn't there to run
// `db:migrate`. drizzle-orm's own migrator reads the same drizzle/ folder and
// the same __drizzle_migrations journal, so the two are interchangeable.
// Resolved against this file so it works from both src/ and dist/.
const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url))

try {
  await migrate(db, { migrationsFolder })
  await pool.end()
} catch (error) {
  // This runs mid-deploy and is read in CI logs, where a driver stack trace
  // buries the one line that says what to fix.
  const { code } = (error as { cause?: { code?: string } }).cause ?? {}
  const { hostname, port, pathname } = new URL(config.databaseUrl)
  const target = `${hostname}:${port || '5432'}`
  const hint =
    code === 'ECONNREFUSED'
      ? `nothing is listening at ${target} — is PostgreSQL running?`
      : code === '28P01'
        ? `password rejected at ${target}`
        : code === '3D000'
          ? `database "${pathname.slice(1)}" does not exist at ${target}`
          : null

  if (hint === null) throw error
  console.error(`Migration failed: ${hint}\nCheck DATABASE_URL in .env.`)
  process.exit(1)
}
