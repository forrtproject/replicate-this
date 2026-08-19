/**
 * Imports the GitHub issue tracker into the registry: one issue = one nomination.
 *
 * Issues are filed with the "Nomination" issue form, whose `### <heading>`
 * sections map onto the nominations table. Maintainer labels carry the state the
 * form does not ask for (`status: …`, `journal: RX/RC`, `type: …`). Anything that
 * is not a nomination form — free-text issues, test issues, entries without a
 * resolvable DOI — is reported and skipped rather than inserted as junk.
 *
 * Re-runnable: existing nominations are matched on DOI and left alone (or
 * refreshed with --update). Reference metadata is resolved through the same
 * Crossref/doi.org path the submit route uses, falling back to a manual
 * reference built from the issue when the lookup fails.
 *
 *   npm run import:issues -- --dry-run
 *   npm run import:issues
 *   npm run import:issues -- --update --repo=forrtproject/replicatethis
 *
 * Set GITHUB_TOKEN to lift the unauthenticated API rate limit.
 */
import { eq } from 'drizzle-orm'
import { db, schema, pool } from '@/db'
import { DISCIPLINES, VERIFICATION_TYPES, type NominationMetadata } from '@/types'
import { NOMINATION_STATUSES } from '@/db/schema'
import { fetchDoiMetadata, normalizeDoi } from '@/lib/crossref'

const DEFAULT_REPO = 'forrtproject/replicatethis'

interface GitHubIssue {
  number: number
  title: string
  body: string | null
  state: string
  created_at: string
  updated_at: string
  html_url: string
  labels: { name: string }[]
  pull_request?: unknown
}

/** One issue mapped onto the nominations table, ready to insert. */
interface ParsedNomination {
  issue: number
  url: string
  doi: string
  journal: string
  discipline: string
  verificationType: string
  justification: string
  dataLocation: string
  robustnessChecks: string
  designDeviations: string
  availability: string[]
  experimentalResearch: boolean
  replicationWorkshop: boolean
  status: string
  createdAt: Date
  lastActivityAt: Date
  fallbackTitle: string
}

/* ------------------------------------------------------------------ *
 * GitHub
 * ------------------------------------------------------------------ */

async function fetchIssues(repo: string): Promise<GitHubIssue[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ReplicateThis-importer',
  }
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  const issues: GitHubIssue[] = []
  for (let page = 1; ; page++) {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/issues?state=all&per_page=100&page=${page}`,
      { headers },
    )
    if (!res.ok) {
      throw new Error(`GitHub API ${res.status} ${res.statusText} for ${repo} (page ${page})`)
    }
    const batch = (await res.json()) as GitHubIssue[]
    issues.push(...batch)
    if (batch.length < 100) break
  }
  // Pull requests come back from the issues endpoint too.
  return issues.filter((i) => !i.pull_request).sort((a, b) => a.number - b.number)
}

/* ------------------------------------------------------------------ *
 * Issue-form parsing
 * ------------------------------------------------------------------ */

/** Split an issue-form body into { heading: value }. Empty answers are ''. */
function parseSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {}
  const parts = body.replace(/\r\n/g, '\n').split(/^### +(.+?) *$/m)
  // parts[0] is any preamble before the first heading; then [heading, value, …].
  for (let i = 1; i < parts.length; i += 2) {
    const value = (parts[i + 1] ?? '').trim()
    // GitHub writes this placeholder for skipped optional fields.
    sections[parts[i].trim().toLowerCase()] = value === '_No response_' ? '' : value
  }
  return sections
}

/** Keyword fallback for disciplines the form allows but our enum does not list. */
const DISCIPLINE_KEYWORDS: [RegExp, string][] = [
  [/psycholog|cognit/i, 'Psychology'],
  [/econom|finance/i, 'Economics'],
  [/medic|clinical|health|epidemiolog/i, 'Medicine'],
  [/biolog|genetic|ecolog/i, 'Biology'],
  [/physic|chemistry|astronom/i, 'Physics'],
  [/sociolog|social science|anthropolog/i, 'Sociology'],
  [/educat|pedagog/i, 'Education'],
  [/linguist|language/i, 'Linguistics'],
  [/marketing|consumer|business|management/i, 'Marketing'],
  [/neuro|brain/i, 'Neuroscience'],
]

function mapDiscipline(raw: string): string {
  const value = raw.trim()
  const exact = DISCIPLINES.find((d) => d.toLowerCase() === value.toLowerCase())
  if (exact) return exact
  for (const [pattern, discipline] of DISCIPLINE_KEYWORDS) {
    if (pattern.test(value)) return discipline
  }
  return 'Other'
}

/** A DOI we can actually resolve — anything else is a test/placeholder entry. */
function isResolvableDoi(doi: string): boolean {
  return /^10\.\d{4,9}\/\S+$/.test(doi)
}

/**
 * Reads what the issue form does not ask for off the maintainer labels:
 * moderation status, and the flags behind the derived RX / RC journal tags.
 */
function readLabels(labels: { name: string }[]) {
  const names = labels.map((l) => l.name.trim().toLowerCase())

  const statusLabel = names.find((n) => n.startsWith('status:'))?.slice('status:'.length).trim()
  const status = NOMINATION_STATUSES.includes(statusLabel as never) ? statusLabel! : 'pending'

  const typeLabel = names.find(
    (n) => n.startsWith('type:') && VERIFICATION_TYPES.includes(n.slice('type:'.length).trim() as never),
  )
  const verificationType = typeLabel?.slice('type:'.length).trim() ?? ''

  return {
    status,
    verificationType,
    // "journal: RX" is only awarded to studies flagged as experimental research.
    experimentalResearch: names.includes('journal: rx'),
    // "journal: RC" (ReScience C) is gated on the study sharing open code.
    hasOpenCode: names.includes('journal: rc'),
    replicationWorkshop: names.includes('replication workshop') || names.includes('replication games'),
  }
}

/** Map one issue to a nomination, or explain why it is not one. */
function parseIssue(issue: GitHubIssue): ParsedNomination | { skip: string } {
  const body = issue.body ?? ''
  const s = parseSections(body)

  if (!('doi' in s)) return { skip: 'not a nomination form (no "### DOI" section)' }

  const doi = normalizeDoi(s.doi ?? '')
  if (!doi) return { skip: 'nomination form with an empty DOI' }
  if (!isResolvableDoi(doi)) return { skip: `not a real DOI ("${s.doi}") — test or placeholder entry` }

  const justification = s['scientific justification'] ?? ''
  if (justification.length < 20) return { skip: 'justification missing or shorter than 20 characters' }

  const labels = readLabels(issue.labels)
  const formType = (s['replication vs reproduction'] ?? '').trim().toLowerCase()
  const verificationType = VERIFICATION_TYPES.includes(formType as never)
    ? formType
    : labels.verificationType || 'replication'

  return {
    issue: issue.number,
    url: issue.html_url,
    doi,
    journal: s.journal ?? '',
    discipline: mapDiscipline(s.discipline ?? ''),
    verificationType,
    justification,
    dataLocation: s['data location (if reproduction)'] ?? '',
    robustnessChecks: s['suggested robustness checks'] ?? '',
    designDeviations: s['suggested deviations from original design'] ?? '',
    availability: labels.hasOpenCode ? ['open_code'] : [],
    experimentalResearch: labels.experimentalResearch,
    replicationWorkshop: labels.replicationWorkshop,
    status: labels.status,
    createdAt: new Date(issue.created_at),
    lastActivityAt: new Date(issue.updated_at),
    // Used when the DOI lookup fails and we fall back to a manual reference.
    fallbackTitle: issue.title.replace(/^\[Nomination\]:\s*/i, '').trim(),
  }
}

/* ------------------------------------------------------------------ *
 * Reference metadata
 * ------------------------------------------------------------------ */

/**
 * Resolve the paper's reference the same way the submit route does. The issue's
 * "Journal" answer overrides whatever the lookup returns, and a failed lookup
 * degrades to a manual reference built from the issue itself.
 */
async function resolveMetadata(
  n: ParsedNomination,
): Promise<{ metadata: NominationMetadata; metadataManual: boolean }> {
  try {
    const metadata = await fetchDoiMetadata(n.doi)
    return {
      metadata: n.journal ? { ...metadata, journal: n.journal } : metadata,
      metadataManual: false,
    }
  } catch {
    return {
      metadata: {
        title: n.fallbackTitle,
        authors: [],
        journal: n.journal,
        publication_date: '',
      },
      metadataManual: true,
    }
  }
}

/* ------------------------------------------------------------------ *
 * Import
 * ------------------------------------------------------------------ */

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const update = args.includes('--update')
  const repo = args.find((a) => a.startsWith('--repo='))?.split('=')[1] ?? DEFAULT_REPO

  console.log(`Fetching issues from ${repo}…`)
  const issues = await fetchIssues(repo)
  console.log(`${issues.length} issue(s) found.\n`)

  const skipped: string[] = []
  const parsed: ParsedNomination[] = []
  for (const issue of issues) {
    const result = parseIssue(issue)
    if ('skip' in result) {
      skipped.push(`#${issue.number} "${issue.title}" — ${result.skip}`)
    } else {
      parsed.push(result)
    }
  }

  let added = 0
  let updated = 0
  let unchanged = 0

  for (const n of parsed) {
    const [existing] = await db
      .select({ id: schema.nominations.id })
      .from(schema.nominations)
      .where(eq(schema.nominations.doi, n.doi))
      .limit(1)

    if (existing && !update) {
      unchanged++
      console.log(`= #${n.issue} ${n.doi} — already in the registry`)
      continue
    }

    const { metadata, metadataManual } = await resolveMetadata(n)
    const values = {
      doi: n.doi,
      metadata,
      metadataManual,
      discipline: n.discipline,
      verificationType: n.verificationType,
      availability: n.availability,
      justification: n.justification,
      dataLocation: n.dataLocation,
      robustnessChecks: n.robustnessChecks,
      designDeviations: n.designDeviations,
      replicationWorkshop: n.replicationWorkshop,
      experimentalResearch: n.experimentalResearch,
      status: n.status,
      lastActivityAt: n.lastActivityAt,
    }

    const label = `#${n.issue} ${n.doi} [${n.discipline}/${n.verificationType}/${n.status}] ${metadata.title || n.fallbackTitle}`
    if (dryRun) {
      console.log(`${existing ? '~' : '+'} ${label}${metadataManual ? ' (manual reference)' : ''}`)
      if (existing) updated++
      else added++
      continue
    }

    if (existing) {
      await db.update(schema.nominations).set(values).where(eq(schema.nominations.id, existing.id))
      updated++
      console.log(`~ ${label}`)
    } else {
      await db.insert(schema.nominations).values({
        ...values,
        // The tracker's nominators have no account here, and the platform is
        // pseudonymous by design — imported rows carry no nominator.
        nominatorUid: null,
        createdAt: n.createdAt,
      })
      added++
      console.log(`+ ${label}`)
    }
  }

  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length} issue(s) that are not nominations:`)
    for (const line of skipped) console.log(`  - ${line}`)
  }

  console.log(
    `\n${dryRun ? '[dry run] ' : ''}${added} added, ${updated} updated, ${unchanged} already present, ${skipped.length} skipped.`,
  )
  await pool.end()
}

main().catch(async (err) => {
  console.error(err)
  await pool.end().catch(() => {})
  process.exit(1)
})
