import type { NominationMetadata } from '@/types'

export function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return 'Unknown author'
  if (authors.length <= 2) return authors.join(', ')
  return `${authors[0]} et al.`
}

export function formatYear(publicationDate: string): string {
  return publicationDate?.slice(0, 4) ?? ''
}

/** A researcher's chosen display name, or their pseudonymous token. */
export function researcherLabel(
  name: string | null | undefined,
  token: string | null | undefined,
): string {
  if (name && name !== 'Anonymous Researcher') return name
  return token ? `Researcher #${token.slice(0, 6)}` : 'Anonymous Researcher'
}

export function formatReference(m: NominationMetadata): string {
  const year = formatYear(m.publication_date)
  return [formatAuthors(m.authors), m.journal, year && `(${year})`]
    .filter(Boolean)
    .join(' · ')
}
