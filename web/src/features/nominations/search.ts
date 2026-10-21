import type { NominationSummary } from '@/types'

/** Lower-cases a DOI or DOI URL and drops its doi.org / doi: prefix. */
function normalizeDoi(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
    .replace(/^doi:\s*/, '')
}

/** Accent- and case-insensitive form, so "Muller" finds "Müller". */
function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/**
 * Whether a nomination matches a registry search. A DOI or DOI URL is compared
 * as a DOI; anything else must appear, word by word, somewhere in the title,
 * authors, journal or DOI. Every word has to match, so "ioannidis false"
 * finds the one paper rather than everything by Ioannidis.
 */
export function matchesSearch(n: NominationSummary, query: string): boolean {
  const q = query.trim()
  if (!q) return true

  const doiQuery = normalizeDoi(q)
  if (/^10\.\d{4,9}\//.test(doiQuery)) return (n.doi ?? '').startsWith(doiQuery)

  const haystack = fold(
    [n.metadata.title, n.metadata.authors.join(' '), n.metadata.journal, n.doi ?? '']
      .filter(Boolean)
      .join(' '),
  )
  return fold(q)
    .split(/\s+/)
    .every((word) => haystack.includes(word))
}
