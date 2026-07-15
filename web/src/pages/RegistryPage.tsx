import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useNominations } from '@/features/nominations/api'
import { NominationCard } from '@/features/nominations/NominationCard'
import { DISCIPLINES, type NominationStatus } from '@/types'

type SortKey = 'top' | 'recent'

const PROCESS = ['Nominate', 'Collaborate', 'Replicate']

export function RegistryPage() {
  const { data: nominations, isLoading, isError, error } = useNominations()
  const [discipline, setDiscipline] = useState('All')
  const [status, setStatus] = useState<NominationStatus | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('top')

  const filtered = useMemo(() => {
    return (nominations ?? [])
      .filter((n) => discipline === 'All' || n.discipline === discipline)
      .filter((n) => status === 'all' || n.status === status)
      .sort((a, b) =>
        sort === 'top'
          ? b.upvotes - a.upvotes
          : new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime(),
      )
  }, [nominations, discipline, status, sort])

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-line bg-green-tint">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:py-16">
          <p className="eyebrow">FORRT · Replication Journal Federation</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-[1.1] text-ink sm:text-5xl">
            The studies worth <span className="italic text-green">checking twice.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            A community registry for the papers researchers would most like to see revisited
            — through <span className="font-medium text-ink">replication</span> or{' '}
            <span className="font-medium text-ink">reproduction</span>. Nominate a study,
            add your voice, coordinate the work.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              to="/nominate"
              className="rounded-md bg-green px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-forest"
            >
              Nominate a study
            </Link>
            <a
              href="#registry"
              className="rounded-md border border-line bg-card px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-green"
            >
              Browse the registry
            </a>
            {typeof nominations?.length === 'number' && (
              <span className="ml-1 text-sm text-muted-foreground">
                {nominations.length} studies nominated
              </span>
            )}
          </div>
        </div>

        {/* How it works — a short, ordered process */}
        <div className="border-t border-green/10">
          <ol className="mx-auto flex max-w-5xl flex-wrap gap-x-8 gap-y-2 px-4 py-3.5 text-sm text-muted-foreground">
            {PROCESS.map((step, i) => (
              <li key={step} className="flex items-center gap-2">
                <span className="font-medium text-green">{i + 1}.</span>
                <span>{step}</span>
                {i < PROCESS.length - 1 && <span className="text-green/30">→</span>}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Registry list */}
      <section id="registry" className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">The registry</p>
            <h2 className="mt-1 font-display text-2xl font-semibold">Open nominations</h2>
          </div>
          <span className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
          </span>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <Filter label="Discipline" value={discipline} onChange={setDiscipline}>
            <option value="All">All disciplines</option>
            {DISCIPLINES.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Filter>
          <Filter
            label="Status"
            value={status}
            onChange={(v) => setStatus(v as NominationStatus | 'all')}
          >
            <option value="all">All statuses</option>
            <option value="pending">Under Review</option>
            <option value="approved">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="published">Published</option>
          </Filter>
          <Filter label="Sort" value={sort} onChange={(v) => setSort(v as SortKey)}>
            <option value="top">Most wanted</option>
            <option value="recent">Most active</option>
          </Filter>
        </div>

        {isLoading && <Placeholder>Loading nominations…</Placeholder>}
        {isError && (
          <Placeholder>{(error as Error)?.message ?? 'Could not load nominations.'}</Placeholder>
        )}
        {!isLoading && !isError && filtered.length === 0 && (
          <Placeholder>No nominations match your filters yet.</Placeholder>
        )}

        <div className="grid gap-3">
          {filtered.map((n) => (
            <NominationCard key={n.id} nomination={n} />
          ))}
        </div>
      </section>
    </div>
  )
}

function Filter({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <label className="text-xs">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-line bg-card px-2.5 py-1.5 text-sm text-ink"
      >
        {children}
      </select>
    </label>
  )
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-line py-12 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}
