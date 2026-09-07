import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db, pool } from '@/db'

// Production ships without dev dependencies, so drizzle-kit isn't there to run
// `db:migrate`. drizzle-orm's own migrator reads the same drizzle/ folder and
// the same __drizzle_migrations journal, so the two are interchangeable.
// Resolved against this file so it works from both src/ and dist/.
const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url))

await migrate(db, { migrationsFolder })
await pool.end()
