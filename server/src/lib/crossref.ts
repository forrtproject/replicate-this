import { config } from '@/lib/env'
import type { NominationMetadata } from '@/types'

export class DoiLookupError extends Error {
  /** When true, the UI should offer manual reference entry. */
  allowManual: boolean
  constructor(message: string, allowManual = false) {
    super(message)
    this.name = 'DoiLookupError'
    this.allowManual = allowManual
  }
}

/** Lower-case, trim, strip a trailing slash, and remove a doi.org/ prefix. */
export function normalizeDoi(doi: string): string {
  return doi
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
    .replace(/^doi:/, '')
    .replace(/\/$/, '')
}

const POLITE_UA = `ReplicateThis/2.0 (mailto:${config.adminEmail})`

async function fetchWithTimeout(url: string, headers: Record<string, string>, ms = 5000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { headers, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function datePartsToString(parts: number[] | undefined): string {
  if (!parts || parts.length === 0) return ''
  return parts.map((p, i) => (i === 0 ? String(p) : String(p).padStart(2, '0'))).join('-')
}

/** Map a Crossref/CSL-JSON `message` object to our metadata shape. */
function mapCslJson(msg: Record<string, unknown>): NominationMetadata {
  const authors = (msg.author as { family?: string; given?: string }[] | undefined ?? []).map(
    (a) => [a.family, a.given].filter(Boolean).join(', '),
  )
  const title = Array.isArray(msg.title) ? (msg.title[0] as string) : (msg.title as string)
  const journal = Array.isArray(msg['container-title'])
    ? (msg['container-title'][0] as string)
    : (msg['container-title'] as string)
  const published = (msg.published ?? msg['published-print'] ?? msg['published-online']) as
    | { 'date-parts'?: number[][] }
    | undefined

  return {
    title: (title ?? '').trim(),
    authors,
    journal: (journal ?? '').trim(),
    publication_date: datePartsToString(published?.['date-parts']?.[0]),
  }
}

/**
 * Resolve DOI metadata. Tries Crossref first (polite pool), then falls back to
 * doi.org content negotiation (covers DataCite, mEDRA, etc.). If both fail, the
 * thrown error has `allowManual = true` so the caller can prompt for manual entry.
 */
export async function fetchDoiMetadata(doi: string): Promise<NominationMetadata> {
  // 1) Crossref
  try {
    const res = await fetchWithTimeout(
      `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
      { 'User-Agent': POLITE_UA, Accept: 'application/json' },
    )
    if (res.ok) {
      const data = (await res.json()) as { message?: Record<string, unknown> }
      if (data.message) return mapCslJson(data.message)
    } else if (res.status !== 404) {
      // transient (5xx/429): fall through to doi.org
    }
  } catch {
    // timeout / network: fall through to doi.org
  }

  // 2) doi.org content negotiation (resolves non-Crossref registration agencies)
  try {
    const res = await fetchWithTimeout(`https://doi.org/${encodeURIComponent(doi)}`, {
      'User-Agent': POLITE_UA,
      Accept: 'application/vnd.citationstyles.csl+json',
    })
    if (res.ok) {
      const msg = (await res.json()) as Record<string, unknown>
      return mapCslJson(msg)
    }
    if (res.status === 404) {
      throw new DoiLookupError(
        'No record found for this DOI. Double-check it, or enter the reference manually.',
        true,
      )
    }
  } catch (err) {
    if (err instanceof DoiLookupError) throw err
  }

  throw new DoiLookupError(
    'Could not resolve this DOI automatically. You can enter the reference manually.',
    true,
  )
}
