import { defineConfig } from 'drizzle-kit'
import { config } from './src/lib/env'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: config.databaseUrl },
  casing: 'snake_case',
})
