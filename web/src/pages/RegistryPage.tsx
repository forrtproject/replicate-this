import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDownUp, SlidersHorizontal, X } from 'lucide-react'
import { useNominations } from '@/features/nominations/api'
import { NominationCard } from '@/features/nominations/NominationCard'
import { matchJournalTags, TARGET_JOURNALS } from '@/features/nominations/journal-tags'
import { DISCIPLINES, type NominationSummary } from '@/types'

// "Newest" is the default on purpose: ranking by votes first would keep the
// already-popular nominations on top and make them ever more popular (a
// Matthew effect), whatever their merits.
const SORTS = {
  newest: {
    label: 'Newest',
    compare: (a: NominationSummary, b: NominationSummary) =>
      Date.parse(b.createdAt) - Date.parse(a.createdAt),
  },
  wanted: {
    label: 'Most wanted',
    compare: (a: NominationSummary, b: NominationSummary) =>
      b.upvotes - a.upvotes || Date.parse(b.createdAt) - Date.parse(a.createdAt),
  },
  active: {
    label: 'Most active',
    compare: (a: NominationSummary, b: NominationSummary) =>
      Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt),
  },
} as const
type SortKey = keyof typeof SORTS

const STATUSES = [
  ['pending', 'Under Review'],
  ['approved', 'Open'],
  ['in_progress', 'In Progress'],
  ['completed', 'Completed'],
  ['published', 'Published'],
] as const

export function RegistryPage() {
  const { data: nominations, isLoading, isError, error } = useNominations()
  // Filters and sort live in the URL, so they survive opening a nomination and
  // coming back, and a filtered view can be shared as a link.
  const [params, setParams] = useSearchParams()
  const discipline = params.get('discipline') ?? ''
  const status = params.get('status') ?? ''
  const journal = params.get('journal') ?? ''
  const sortParam = params.get('sort') ?? ''
  const sort: SortKey = sortParam in SORTS ? (sortParam as SortKey) : 'newest'
  const filtering = Boolean(discipline || status || journal)

  function setParam(key: string, value: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true, preventScrollReset: true },
    )
  }

  function clearFilters() {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const k of ['discipline', 'status', 'journal']) next.delete(k)
        return next
      },
      { replace: true, preventScrollReset: true },
    )
  }

  const filtered = useMemo(() => {
    return (nominations ?? [])
      .filter((n) => !discipline || n.discipline === discipline)
      .filter((n) => !status || n.status === status)
      .filter((n) => !journal || matchJournalTags(n).some((t) => t.key === journal))
      .sort(SORTS[sort].compare)
  }, [nominations, discipline, status, journal, sort])

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
              Browse nominations
            </a>
            {typeof nominations?.length === 'number' && (
              <span className="ml-1 text-sm text-muted-foreground">
                {nominations.length} studies nominated
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Registry list */}
      <section id="registry" className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">The registry</p>
            <h2 className="mt-1 font-display text-2xl font-semibold">Nominations</h2>
          </div>
          <span className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
          </span>
        </div>

        {/* Filters (narrow the list) and sort (order it) are separate groups. */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-y border-line py-3">
          <div className="flex flex-wrap items-end gap-2">
            <span className="mb-1.5 inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Filter
            </span>
            <Select label="Discipline" value={discipline} onChange={(v) => setParam('discipline', v)}>
              <option value="">All disciplines</option>
              {DISCIPLINES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
            <Select label="Status" value={status} onChange={(v) => setParam('status', v)}>
              <option value="">All statuses</option>
              {STATUSES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select label="Target journal" value={journal} onChange={(v) => setParam('journal', v)}>
              <option value="">Any target journal</option>
              {TARGET_JOURNALS.map((j) => (
                <option key={j.key} value={j.key}>
                  {j.name}
                </option>
              ))}
            </Select>
            {filtering && (
              <button
                onClick={clearFilters}
                className="mb-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-ink"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>

          <div className="flex items-end gap-2">
            <span className="mb-1.5 inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <ArrowDownUp className="h-3.5 w-3.5" /> Sort
            </span>
            <div role="radiogroup" aria-label="Sort by" className="inline-flex rounded-md border border-line bg-card p-0.5">
              {(Object.keys(SORTS) as SortKey[]).map((key) => (
                <button
                  key={key}
                  role="radio"
                  aria-checked={sort === key}
                  onClick={() => setParam('sort', key === 'newest' ? '' : key)}
                  className={`rounded px-2.5 py-1 text-sm transition-colors ${
                    sort === key
                      ? 'bg-green-tint font-medium text-forest'
                      : 'text-muted-foreground hover:text-ink'
                  }`}
                >
                  {SORTS[key].label}
                </button>
              ))}
            </div>
          </div>
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

function Select({
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
        className={`rounded-md border bg-card px-2.5 py-1.5 text-sm text-ink ${
          value ? 'border-green' : 'border-line'
        }`}
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
