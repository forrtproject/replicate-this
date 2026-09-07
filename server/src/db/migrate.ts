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
  const { hostname, port, pathname, username } = new URL(config.databaseUrl)
  const target = `${hostname}:${port || '5432'}`
  const database = pathname.slice(1)
  const hints: Record<string, string> = {
    ECONNREFUSED: `nothing is listening at ${target} — is PostgreSQL running?`,
    '28P01': `password rejected at ${target}`,
    '3D000': `database "${database}" does not exist at ${target}`,
    // Migrations create the drizzle schema and then tables in public, so the
    // role needs to own the database, not merely connect to it.
    '42501': `role "${username}" may connect to "${database}" but not create in it — make it the owner (see docs/DEPLOYMENT.md)`,
  }
  const hint = code ? hints[code] : undefined

  if (hint === undefined) throw error
  console.error(`Migration failed: ${hint}\nCheck DATABASE_URL in .env.`)

  // A privilege error where the grants look right usually means this connection
  // is not reaching the cluster you granted on. Ask it who it actually is.
  if (code === '42501') {
    try {
      const { rows } = await pool.query(
        `select current_user, current_database(), inet_server_addr() as host,
                inet_server_port() as port,
                has_database_privilege(current_user, current_database(), 'CREATE') as can_create_schema,
                has_schema_privilege(current_user, 'public', 'CREATE') as can_create_tables`,
      )
      console.error('This connection reports:', rows[0])
    } catch (probe) {
      console.error('Could not query the connection for details:', probe)
    }
  }

  process.exit(1)
}
