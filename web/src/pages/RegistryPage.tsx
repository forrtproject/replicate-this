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
import { useSession } from '@/lib/auth-client'

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
  const { data: session } = useSession()
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

  // The introduction is for first-time, signed-out visitors browsing the whole
  // list. Signed in, or mid-search, the results come first.
  const showIntro = !session && !filtering

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      {showIntro ? (
        <section className="border-b border-line pb-10 pt-14 sm:pt-20">
          <h1 className="max-w-3xl font-display text-[2.5rem] font-medium leading-[1.05] tracking-[-0.02em] text-ink sm:text-[3.5rem]">
            Studies worth checking twice
          </h1>
          <p className="mt-5 max-w-2xl text-[1.0625rem] leading-relaxed text-ink/80">
            A community registry of published findings that researchers want to see
            replicated with new data or reproduced from the original data. Nominate a
            study, back the ones you want checked, and form a team to do the work.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              to="/nominate"
              className="rounded-md bg-green px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-forest"
            >
              Nominate a study
            </Link>
            <Link to="/guidelines" className="text-sm font-medium text-forest underline-offset-4 hover:underline">
              How nominations work
            </Link>
          </div>
        </section>
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-4 pb-6 pt-10">
          <div>
            <h1 className="font-display text-[2rem] font-semibold leading-tight">Nominations</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Published findings the community wants replicated or reproduced.
            </p>
          </div>
          {session && (
            <Link
              to="/nominate"
              className="rounded-md bg-green px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-forest"
            >
              Nominate a study
            </Link>
          )}
        </div>
      )}

      {/* Registry list */}
      <section id="registry" aria-label="Registry" className={showIntro ? 'pt-8' : ''}>
        <div className="mb-4 space-y-3">
          {/* Search first: the guidelines ask nominators to check for an existing entry. */}
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <label className="relative block min-w-0 flex-1">
              <span className="sr-only">Search nominations</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setParam('q', e.target.value)}
                placeholder="Search by title, author, journal or DOI"
                className="input pl-9!"
              />
            </label>
            <fieldset className="grid min-w-0 grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <legend className="sr-only">Filter</legend>
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
            </fieldset>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
              <span aria-hidden>
                <span className="data font-medium text-ink">{isLoading ? '–' : filtered.length}</span>{' '}
                {filtered.length === 1 ? 'nomination' : 'nominations'}
                {filtering && nominations ? ` of ${nominations.length}` : ''}
              </span>
              <span role="status" aria-live="polite" className="sr-only">
                {announced}
              </span>
              {filtering && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 rounded text-sm font-medium text-forest hover:underline focus-visible:outline-2 focus-visible:outline-green"
                >
                  <X className="h-3.5 w-3.5" aria-hidden /> Clear search and filters
                </button>
              )}
            </p>

            {/* Native radios: arrow keys move the selection and the group is a
                single Tab stop, as screen-reader and keyboard users expect. */}
            <fieldset className="flex items-center gap-2">
              <legend className="sr-only">Sort by</legend>
              <span className="text-sm text-muted-foreground" aria-hidden>
                Sort
              </span>
              <div className="inline-flex rounded-md border border-line bg-card p-0.5">
                {(Object.keys(SORTS) as SortKey[]).map((key) => (
                  <label
                    key={key}
                    title={SORTS[key].hint}
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

        {filtered.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card">
            {filtered.map((n) => (
              <li key={n.id}>
                <NominationCard nomination={n} />
              </li>
            ))}
          </ul>
        )}
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
    <label className="min-w-0 flex-1 text-xs sm:flex-none">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`max-w-full rounded-md border bg-card py-2 pl-2.5 pr-8 text-base text-ink w-full sm:w-44 sm:text-sm ${
          value ? 'border-green' : 'border-input'
        }`}
      >
        {children}
      </select>
    </label>
  )
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-line bg-card px-6 py-12 text-center text-sm leading-relaxed text-muted-foreground">
      {children}
    </p>
  )
}
