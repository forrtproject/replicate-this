import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { useNominations } from '@/features/nominations/api'
import { NominationCard } from '@/features/nominations/NominationCard'
import { STATUS_LABELS } from '@/features/nominations/status'
import { matchJournalTags, TARGET_JOURNALS } from '@/features/nominations/journal-tags'
import { matchesSearch } from '@/features/nominations/search'
import { useDebounced } from '@/lib/hooks'
import { DISCIPLINES, type NominationStatus, type NominationSummary } from '@/types'
import { usePageTitle } from '@/lib/page-title'

// "Newest" is the default on purpose: ranking by votes first would keep the
// already-popular nominations on top and make them ever more popular (a
// Matthew effect), whatever their merits.
const SORTS = {
  newest: {
    label: 'Newest',
    hint: 'Most recently nominated first.',
    compare: (a: NominationSummary, b: NominationSummary) =>
      Date.parse(b.createdAt) - Date.parse(a.createdAt),
  },
  wanted: {
    label: 'Most wanted',
    hint: 'Most upvotes first.',
    compare: (a: NominationSummary, b: NominationSummary) =>
      b.upvotes - a.upvotes || Date.parse(b.createdAt) - Date.parse(a.createdAt),
  },
  active: {
    label: 'Most active',
    hint: 'Latest comment, progress update or edit first.',
    compare: (a: NominationSummary, b: NominationSummary) =>
      Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt),
  },
} as const
type SortKey = keyof typeof SORTS

// The public lifecycle, in order. Rejected nominations are never listed.
const STATUSES: NominationStatus[] = ['pending', 'approved', 'in_progress', 'completed', 'published']

export function RegistryPage() {
  usePageTitle('Nominations')
  const { data: nominations, isLoading, isError, error } = useNominations()
  // Search, filters and sort live in the URL, so they survive opening a
  // nomination and coming back, and a filtered view can be shared as a link.
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const discipline = params.get('discipline') ?? ''
  const status = params.get('status') ?? ''
  const journal = params.get('journal') ?? ''
  const sortParam = params.get('sort') ?? ''
  const sort: SortKey = sortParam in SORTS ? (sortParam as SortKey) : 'newest'
  const filtering = Boolean(query || discipline || status || journal)

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
        for (const k of ['q', 'discipline', 'status', 'journal']) next.delete(k)
        return next
      },
      { replace: true, preventScrollReset: true },
    )
  }

  const filtered = useMemo(() => {
    return (nominations ?? [])
      .filter((n) => matchesSearch(n, query))
      .filter((n) => !discipline || n.discipline === discipline)
      .filter((n) => !status || n.status === status)
      .filter((n) => !journal || matchJournalTags(n).some((t) => t.key === journal))
      .sort(SORTS[sort].compare)
  }, [nominations, query, discipline, status, journal, sort])

  // Screen readers hear the new count once typing or clicking settles, not on
  // every keystroke.
  const resultText = `${filtered.length} ${filtered.length === 1 ? 'nomination' : 'nominations'}`
  const announced = useDebounced(isLoading ? '' : resultText, 600)

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
            A community registry of papers researchers would like to see checked through{' '}
            <span className="font-medium text-ink">replication</span> or{' '}
            <span className="font-medium text-ink">reproduction</span>. Nominate a study,
            upvote others you’d like revisited, and organise a team to do the work.
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
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">The registry</p>
            <h2 className="mt-1 font-display text-2xl font-semibold">Nominations</h2>
          </div>
          <span className="text-sm text-muted-foreground" aria-hidden>
            {resultText}
          </span>
          <span role="status" aria-live="polite" className="sr-only">
            {announced}
          </span>
        </div>

        <div className="mb-6 space-y-3 border-y border-line py-4">
          {/* Search first: the guidelines ask nominators to check for an existing entry. */}
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Search</span>
            <span className="relative block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setParam('q', e.target.value)}
                placeholder="Title, author, journal or DOI"
                className="input pl-9!"
              />
            </span>
          </label>

          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <fieldset className="flex min-w-0 flex-wrap items-end gap-2">
              <legend className="mb-1 text-sm font-medium">Filter</legend>
              <Select label="Discipline" value={discipline} onChange={(v) => setParam('discipline', v)}>
                <option value="">All disciplines</option>
                {DISCIPLINES.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
              <Select label="Status" value={status} onChange={(v) => setParam('status', v)}>
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
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
                  className="mb-1.5 inline-flex items-center gap-1 rounded text-sm text-muted-foreground hover:text-ink focus-visible:outline-2 focus-visible:outline-green"
                >
                  <X className="h-3.5 w-3.5" aria-hidden /> Clear search and filters
                </button>
              )}
            </fieldset>

            {/* Native radios: arrow keys move the selection and the group is a
                single Tab stop, as screen-reader and keyboard users expect. */}
            <fieldset>
              <legend className="mb-1 text-sm font-medium">Sort by</legend>
              <div className="inline-flex rounded-md border border-line bg-card p-0.5">
                {(Object.keys(SORTS) as SortKey[]).map((key) => (
                  <label
                    key={key}
                    className="cursor-pointer rounded px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:text-ink has-checked:bg-green-tint has-checked:font-medium has-checked:text-forest has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-green"
                  >
                    <input
                      type="radio"
                      name="sort"
                      value={key}
                      checked={sort === key}
                      onChange={() => setParam('sort', key === 'newest' ? '' : key)}
                      className="sr-only"
                    />
                    {SORTS[key].label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <p className="text-xs text-muted-foreground">{SORTS[sort].hint}</p>
        </div>

        {isLoading && <Placeholder>Loading nominations…</Placeholder>}
        {isError && (
          <Placeholder>{(error as Error)?.message ?? 'Could not load nominations.'}</Placeholder>
        )}
        {!isLoading && !isError && filtered.length === 0 && (
          <Placeholder>
            {query ? (
              <>
                Nothing matches “{query}”{discipline || status || journal ? ' with these filters' : ''}.
                Try fewer words or the DOI. If the paper isn’t listed yet,{' '}
                <Link to="/nominate" className="font-medium text-green underline">
                  nominate it
                </Link>
                .
              </>
            ) : (
              'No nominations match these filters.'
            )}
          </Placeholder>
        )}

        <div className="grid grid-cols-1 gap-3">
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
    <label className="min-w-0 max-w-full text-xs">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`max-w-full rounded-md border bg-card px-2.5 py-1.5 text-base text-ink sm:text-sm ${
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
    <p className="rounded-lg border border-dashed border-line px-4 py-12 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}
