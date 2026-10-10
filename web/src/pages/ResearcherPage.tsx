import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { AvatarBubble } from '@/features/profile/AvatarEditor'
import { LinkIcon } from '@/features/profile/LinkIcon'
import { NominationCard } from '@/features/nominations/NominationCard'
import { StatusBadge } from '@/features/nominations/StatusBadge'
import { PROFILE_LINKS, type NominationStatus, type NominationSummary, type ProfileLinks } from '@/types'

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

  if (isLoading) {
    return <p className="py-20 text-center text-sm text-muted-foreground">Loading…</p>
  }
  if (isError || !r) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-sm text-muted-foreground">Researcher not found.</p>
        <Link to="/nominations" className="mt-2 inline-block text-sm text-green underline">
          Back to nominations
        </Link>
      </div>
    )
  }

  const links = PROFILE_LINKS.filter((l) => r.links[l.key])

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-4">
        <AvatarBubble image={r.image} name={r.name} />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Researcher</p>
          <h1 className="font-display text-3xl font-semibold leading-tight">{r.name}</h1>
          <p className="text-xs text-muted-foreground">
            Joined {new Date(r.joinedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </p>
        </div>
        {r.isSelf && (
          <Link to="/profile" className="text-sm text-green hover:underline">
            Edit your profile →
          </Link>
        )}
      </div>

      {links.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2">
          {links.map((l) => (
            <li key={l.key}>
              <a
                href={r.links[l.key]}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1 text-sm hover:border-green"
              >
                <LinkIcon kind={l.key} />
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Nominations ({r.nominations.length})
        </h2>
        {r.nominations.length === 0 ? (
          <Empty>No public nominations yet.</Empty>
        ) : (
          <div className="grid gap-3">
            {r.nominations.map((n) => (
              <NominationCard key={n.id} nomination={n} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Contributing to ({r.contributions.length})
        </h2>
        {r.contributions.length === 0 ? (
          <Empty>Not contributing to any studies yet.</Empty>
        ) : (
          <div className="space-y-2">
            {r.contributions.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-md border border-line bg-card px-3 py-2"
              >
                <Link to={`/nominations/${c.id}`} className="truncate text-sm hover:text-green">
                  {c.title || c.doi}
                </Link>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-line px-3 py-4 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}
