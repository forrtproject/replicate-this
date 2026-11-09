import { PageBand } from '@/components/layout/PageBand'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { AvatarBubble } from '@/features/profile/AvatarEditor'
import { LinkIcon } from '@/features/profile/LinkIcon'
import { NominationCard } from '@/features/nominations/NominationCard'
import { StatusBadge } from '@/features/nominations/StatusBadge'
import { PROFILE_LINKS, type NominationStatus, type NominationSummary, type ProfileLinks } from '@/types'
import { usePageTitle } from '@/lib/page-title'
import { formatMonthYear } from '@/lib/dates'

interface Researcher {
  token: string
  name: string
  image: string
  links: ProfileLinks
  joinedAt: string
  isSelf: boolean
  nominations: NominationSummary[]
  contributions: { id: string; doi: string | null; title: string; status: NominationStatus }[]
}

/** Public profile: who someone is and what they've nominated or are working on. */
export function ResearcherPage() {
  const { token = '' } = useParams()
  const { data: r, isLoading, isError } = useQuery({
    queryKey: ['researchers', token],
    queryFn: () => api.get<Researcher>(`/researchers/${token}`),
  })

  usePageTitle(isLoading ? undefined : (r?.name ?? 'Researcher not found'))

  if (isLoading) {
    return <p className="py-20 text-center text-sm text-muted-foreground">Loading…</p>
  }
  if (isError || !r) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20">
        <h1 className="font-display text-[2rem] font-semibold">Researcher not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">The account may have been deleted, or the link is incomplete.</p>
        <Link to="/nominations" className="mt-4 inline-block text-sm font-medium text-brand-deep underline">
          Back to nominations
        </Link>
      </div>
    )
  }

  const links = PROFILE_LINKS.filter((l) => r.links[l.key])

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <PageBand bleed>
      <div className="flex flex-wrap items-center gap-5">
        <AvatarBubble image={r.image} name={r.name} className="h-16 w-16 text-2xl" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[2rem] font-semibold leading-tight">{r.name}</h1>
          <p className="meta mt-1 text-sm text-band-ink/80">
            <span>
              {r.nominations.length} {r.nominations.length === 1 ? 'nomination' : 'nominations'}
            </span>
            <span>
              {r.contributions.length} {r.contributions.length === 1 ? 'study team' : 'study teams'}
            </span>
            <span>Joined {formatMonthYear(r.joinedAt)}</span>
          </p>
          {r.isSelf && (
            <p className="mt-0.5 text-sm">
              <Link to="/profile" className="text-brand-deep underline-offset-2 hover:underline">
                Edit your profile
              </Link>
            </p>
          )}
        </div>
      </div>

      {links.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
          {links.map((l) => (
            <li key={l.key}>
              <a
                href={r.links[l.key]}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 text-sm text-ink hover:text-brand-deep hover:underline"
                title={l.label}
              >
                <LinkIcon kind={l.key} mono={l.key !== 'orcid'} className="h-4 w-4 text-muted-foreground" />
                <span className="sr-only">{l.label}: </span>
                {linkText(r.links[l.key]!)}
              </a>
            </li>
          ))}
        </ul>
      )}
      </PageBand>

      <section className="mt-12" aria-labelledby="nominated">
        <h2 id="nominated" className="section-title mb-3">
          Nominations
          {r.nominations.length > 0 && (
            <span className="data ml-2 font-sans text-base font-normal text-muted-foreground">{r.nominations.length}</span>
          )}
        </h2>
        {r.nominations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No public nominations yet.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card">
            {r.nominations.map((n) => (
              <li key={n.id}>
                <NominationCard nomination={n} showNominator={false} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12" aria-labelledby="teams">
        <h2 id="teams" className="section-title mb-3">
          Study teams
          {r.contributions.length > 0 && (
            <span className="data ml-2 font-sans text-base font-normal text-muted-foreground">{r.contributions.length}</span>
          )}
        </h2>
        {r.contributions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not on any study team yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-card">
            {r.contributions.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/nominations/${c.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[#f6f5ef]"
                >
                  <span className="truncate font-display text-[1.0625rem] font-semibold">{c.title || c.doi}</span>
                  <StatusBadge status={c.status} className="shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** "https://orcid.org/0000-…" → "orcid.org/0000-…": the address, minus the scheme. */
function linkText(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
}
