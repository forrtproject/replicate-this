import { serve } from '@hono/node-server'
import { createApp } from '@/app'
import { config } from '@/lib/env'

const app = createApp()

serve({ fetch: app.fetch, port: config.port }, ({ port }) => {
  console.log(`Replicate This API listening on http://localhost:${port}`)
})
