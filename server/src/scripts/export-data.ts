/**
 * Weekly data export for the GitHub repository (not served by the website):
 *   exports/nominations.json — full public registry data (machine-readable)
 *   exports/STATS.md         — summary stats table (human-readable Markdown)
 *
 * Run with `npm run export:data` (needs DATABASE_URL). A scheduled GitHub
 * Action runs this weekly and commits the result.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { sql } from 'drizzle-orm'
import { db, pool } from '@/db'
import { listPublicNominations } from '@/db/queries'

const OUT_DIR = process.env.EXPORT_DIR ?? path.resolve(process.cwd(), '..', 'exports')

interface CountRow extends Record<string, unknown> {
  key: string
  n: number
}

async function countBy(query: ReturnType<typeof sql>): Promise<CountRow[]> {
  const res = await db.execute<CountRow>(query)
  return res.rows
}

async function scalar(query: ReturnType<typeof sql>): Promise<number> {
  const res = await db.execute<{ n: number }>(query)
  return res.rows[0]?.n ?? 0
}

function mdTable(header: [string, string], rows: [string, number | string][]): string {
  return [
    `| ${header[0]} | ${header[1]} |`,
    '| --- | ---: |',
    ...rows.map(([k, v]) => `| ${k} | ${v} |`),
  ].join('\n')
}

async function main() {
  const generatedAt = new Date().toISOString()

  // Machine-readable dump of everything the public registry shows.
  const nominations = await listPublicNominations(null)

  const byStatus = await countBy(
    sql`select status as key, count(*)::int as n from nominations group by status order by n desc`,
  )
  const byDiscipline = await countBy(
    sql`select discipline as key, count(*)::int as n from nominations group by discipline order by n desc`,
  )
  const totals: [string, number][] = [
    ['Nominations', await scalar(sql`select count(*)::int as n from nominations`)],
    ['Registered researchers', await scalar(sql`select count(*)::int as n from "user" where deleted = false`)],
    ['Upvotes', await scalar(sql`select count(*)::int as n from votes`)],
    ['Predictions', await scalar(sql`select count(*)::int as n from predictions`)],
    ['Contributions', await scalar(sql`select count(*)::int as n from contributions`)],
    ['Comments', await scalar(sql`select count(*)::int as n from comments where hidden = false`)],
    ['Progress updates', await scalar(sql`select count(*)::int as n from nomination_updates`)],
    ['Subscriptions', await scalar(sql`select count(*)::int as n from subscriptions`)],
  ]

  const stats = `# ReplicateThis — weekly stats

_Generated ${generatedAt}. This export lives in the repository only; the website does not serve it._

## Totals

${mdTable(['Metric', 'Count'], totals)}

## Nominations by status

${mdTable(['Status', 'Count'], byStatus.map((r) => [r.key, r.n]))}

## Nominations by discipline

${mdTable(['Discipline', 'Count'], byDiscipline.map((r) => [r.key, r.n]))}
`

  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(
    path.join(OUT_DIR, 'nominations.json'),
    JSON.stringify({ generatedAt, nominations }, null, 2),
  )
  await writeFile(path.join(OUT_DIR, 'STATS.md'), stats)

  console.log(`Exported ${nominations.length} nominations to ${OUT_DIR}`)
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
