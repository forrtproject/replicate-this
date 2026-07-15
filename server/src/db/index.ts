import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { config } from '@/lib/env'
import * as schema from './schema'

export const pool = new Pool({ connectionString: config.databaseUrl })

export const db = drizzle(pool, { schema })

export { schema }
