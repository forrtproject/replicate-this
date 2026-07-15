# Replicate This v2 — Plan 2: Registry & Moderation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public nominations registry with voting, the nomination submission pipeline with Crossref integration, and the admin moderation dashboard.

**Architecture:** Public registry uses Supabase RLS for data access (BaaS-first). Nomination submission and voting use Next.js Server Actions with explicit permission checks. Admin dashboard uses Supabase Realtime for live queue updates.

**Tech Stack:** Next.js 15 Server Actions, shadcn/ui, Supabase Realtime, Crossref API, Vitest + React Testing Library

**Prerequisite:** Plan 1 must be completed and deployed.

---

## File Map

```
src/
├── app/
│   ├── registry/
│   │   └── page.tsx                         # Public nominations list
│   ├── nominations/
│   │   └── [id]/
│   │       └── page.tsx                     # Single nomination detail
│   ├── nominate/
│   │   └── page.tsx                         # Nomination submission form
│   ├── sign-in/
│   │   └── page.tsx                         # OAuth sign-in page
│   ├── admin/
│   │   ├── layout.tsx                       # Admin layout (role check)
│   │   └── page.tsx                         # Moderation dashboard
│   └── dashboard/
│       ├── layout.tsx                       # Protected user layout
│       └── page.tsx                         # User dashboard shell
├── components/
│   ├── ui/                                  # shadcn/ui primitives
│   ├── nominations/
│   │   ├── status-badge.tsx                 # Status → display label + colour
│   │   ├── nomination-card.tsx              # Registry list card
│   │   ├── nomination-list.tsx              # Filter + sort + list
│   │   └── vote-button.tsx                 # Upvote/downvote optimistic UI
│   └── admin/
│       ├── moderation-queue.tsx             # Pending nominations table
│       └── moderation-row.tsx               # Single row: approve/reject actions
├── actions/
│   ├── nominations.ts                       # submitNomination Server Action
│   └── votes.ts                             # toggleVote Server Action
├── lib/
│   └── crossref.ts                          # Crossref API client
└── tests/
    ├── lib/
    │   └── crossref.test.ts
    └── components/
        ├── status-badge.test.tsx
        ├── vote-button.test.tsx
        └── nomination-card.test.tsx
```

---

### Task 1: shadcn/ui Setup

**Files:**
- Modifies: project root config files
- Creates: `src/components/ui/` primitives

- [ ] **Step 1: Initialise shadcn/ui**

```bash
npx shadcn@latest init
```
When prompted: style = Default, base colour = Slate, CSS variables = Yes.

- [ ] **Step 2: Install required components**

```bash
npx shadcn@latest add badge button card dialog form input label select textarea toast
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/ components.json tailwind.config.ts
git commit -m "feat: install shadcn/ui component library"
```

---

### Task 2: Status Badge Component

**Files:**
- Create: `src/components/nominations/status-badge.tsx`
- Create: `src/tests/components/status-badge.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/tests/components/status-badge.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '@/components/nominations/status-badge'
import type { NominationStatus } from '@/types'

describe('StatusBadge', () => {
  it('renders "Approved" for approved status', () => {
    render(<StatusBadge status="approved" />)
    expect(screen.getByText('Approved')).toBeInTheDocument()
  })

  it('renders "Claimed / In Progress" for in_progress status', () => {
    render(<StatusBadge status="in_progress" />)
    expect(screen.getByText('Claimed / In Progress')).toBeInTheDocument()
  })

  it('renders "Pending Review" for pending status', () => {
    render(<StatusBadge status="pending" />)
    expect(screen.getByText('Pending Review')).toBeInTheDocument()
  })

  it('renders "Rejected" for rejected status', () => {
    render(<StatusBadge status="rejected" />)
    expect(screen.getByText('Rejected')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test src/tests/components/status-badge.test.tsx
```
Expected: FAIL — `Cannot find module '@/components/nominations/status-badge'`

- [ ] **Step 3: Implement component**

Create `src/components/nominations/status-badge.tsx`:
```typescript
import { Badge } from '@/components/ui/badge'
import type { NominationStatus } from '@/types'

const STATUS_CONFIG: Record<NominationStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  approved: { label: 'Approved', variant: 'default' },
  in_progress: { label: 'Claimed / In Progress', variant: 'secondary' },
  pending: { label: 'Pending Review', variant: 'outline' },
  rejected: { label: 'Rejected', variant: 'destructive' },
}

export function StatusBadge({ status }: { status: NominationStatus }) {
  const { label, variant } = STATUS_CONFIG[status]
  return <Badge variant={variant}>{label}</Badge>
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
npm test src/tests/components/status-badge.test.tsx
```
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/nominations/status-badge.tsx src/tests/components/status-badge.test.tsx
git commit -m "feat: add StatusBadge component with correct in_progress label"
```

---

### Task 3: Nomination Card Component

**Files:**
- Create: `src/components/nominations/nomination-card.tsx`
- Create: `src/tests/components/nomination-card.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/tests/components/nomination-card.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NominationCard } from '@/components/nominations/nomination-card'
import type { NominationWithScore } from '@/types'

const nomination: NominationWithScore = {
  id: 'abc-123',
  doi: '10.1000/test',
  metadata: {
    title: 'Power posing and testosterone levels',
    authors: ['Carney, D.', 'Cuddy, A.'],
    journal: 'Psychological Science',
    publication_date: '2010-09-21',
  },
  discipline: 'Psychology',
  justification: 'High citation count, controversial results.',
  nominator_uid: 'user-hash',
  status: 'approved',
  last_activity_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  score: 84,
}

describe('NominationCard', () => {
  it('renders the paper title', () => {
    render(<NominationCard nomination={nomination} />)
    expect(screen.getByText('Power posing and testosterone levels')).toBeInTheDocument()
  })

  it('renders the vote score', () => {
    render(<NominationCard nomination={nomination} />)
    expect(screen.getByText('84')).toBeInTheDocument()
  })

  it('renders the discipline tag', () => {
    render(<NominationCard nomination={nomination} />)
    expect(screen.getByText('Psychology')).toBeInTheDocument()
  })

  it('renders the journal from metadata', () => {
    render(<NominationCard nomination={nomination} />)
    expect(screen.getByText(/Psychological Science/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test src/tests/components/nomination-card.test.tsx
```
Expected: FAIL — `Cannot find module '@/components/nominations/nomination-card'`

- [ ] **Step 3: Implement component**

Create `src/components/nominations/nomination-card.tsx`:
```typescript
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from './status-badge'
import type { NominationWithScore } from '@/types'

interface Props {
  nomination: NominationWithScore
}

export function NominationCard({ nomination }: Props) {
  const { metadata, score, status, discipline, id } = nomination
  const year = metadata.publication_date?.slice(0, 4)

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <Link
            href={`/nominations/${id}`}
            className="text-sm font-semibold leading-snug hover:text-emerald-700 transition-colors line-clamp-2"
          >
            {metadata.title}
          </Link>
          <span className="flex-shrink-0 text-lg font-bold text-emerald-600">{score}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground mb-3">
          {metadata.authors.slice(0, 2).join(', ')}
          {metadata.authors.length > 2 ? ' et al.' : ''} ·{' '}
          {metadata.journal} {year && `(${year})`}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">{discipline}</Badge>
          <StatusBadge status={status} />
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
npm test src/tests/components/nomination-card.test.tsx
```
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/nominations/nomination-card.tsx src/tests/components/nomination-card.test.tsx
git commit -m "feat: add NominationCard component"
```

---

### Task 4: Public Registry Page

**Files:**
- Create: `src/components/nominations/nomination-list.tsx`
- Create: `src/app/registry/page.tsx`

- [ ] **Step 1: Create nomination list component**

Create `src/components/nominations/nomination-list.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { NominationCard } from './nomination-card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { NominationWithScore, NominationStatus } from '@/types'

const DISCIPLINES = [
  'All',
  'Psychology',
  'Medicine',
  'Economics',
  'Biology',
  'Physics',
  'Sociology',
  'Education',
  'Other',
]

type SortKey = 'score' | 'recent'

interface Props {
  nominations: NominationWithScore[]
}

export function NominationList({ nominations }: Props) {
  const [discipline, setDiscipline] = useState('All')
  const [sort, setSort] = useState<SortKey>('score')
  const [statusFilter, setStatusFilter] = useState<NominationStatus | 'all'>('all')

  const filtered = nominations
    .filter((n) => discipline === 'All' || n.discipline === discipline)
    .filter((n) => statusFilter === 'all' || n.status === statusFilter)
    .sort((a, b) =>
      sort === 'score'
        ? b.score - a.score
        : new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()
    )

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <Select value={discipline} onValueChange={setDiscipline}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Discipline" />
          </SelectTrigger>
          <SelectContent>
            {DISCIPLINES.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as NominationStatus | 'all')}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="in_progress">Claimed / In Progress</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score">Top Voted</SelectItem>
            <SelectItem value="recent">Most Active</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && (
        <p className="text-muted-foreground text-sm py-8 text-center">No nominations match your filters.</p>
      )}

      <div className="grid gap-3">
        {filtered.map((n) => (
          <NominationCard key={n.id} nomination={n} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create registry page**

Create `src/app/registry/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { NominationList } from '@/components/nominations/nomination-list'
import type { NominationWithScore } from '@/types'

export const revalidate = 60

export default async function RegistryPage() {
  const supabase = await createClient()

  const { data: nominations, error } = await supabase
    .from('nominations')
    .select(`
      *,
      nomination_vote_totals (score)
    `)
    .in('status', ['approved', 'in_progress'])
    .order('last_activity_at', { ascending: false })

  if (error) throw error

  const withScores: NominationWithScore[] = (nominations ?? []).map((n) => ({
    ...n,
    score: (n.nomination_vote_totals as { score: number } | null)?.score ?? 0,
  }))

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Replication Registry</h1>
        <p className="text-muted-foreground text-sm">
          Studies nominated by the research community for independent verification.
        </p>
      </div>
      <NominationList nominations={withScores} />
    </main>
  )
}
```

- [ ] **Step 3: Verify page renders in browser**

```bash
npm run dev
```
Navigate to http://localhost:3000/registry. Expected: registry page renders with filter controls (empty list is fine if no data yet).

- [ ] **Step 4: Commit**

```bash
git add src/components/nominations/nomination-list.tsx src/app/registry/
git commit -m "feat: add public registry page with filter and sort"
```

---

### Task 5: Crossref API Client

**Files:**
- Create: `src/lib/crossref.ts`
- Create: `src/tests/lib/crossref.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/tests/lib/crossref.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchDoiMetadata, normalizeDoi, CrossrefError } from '@/lib/crossref'

describe('normalizeDoi', () => {
  it('lowercases the DOI', () => {
    expect(normalizeDoi('10.1000/ABC')).toBe('10.1000/abc')
  })

  it('trims whitespace', () => {
    expect(normalizeDoi('  10.1000/abc  ')).toBe('10.1000/abc')
  })

  it('strips trailing slash', () => {
    expect(normalizeDoi('10.1000/abc/')).toBe('10.1000/abc')
  })
})

describe('fetchDoiMetadata', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns structured metadata on success', async () => {
    const mockResponse = {
      message: {
        title: ['Power posing and testosterone'],
        author: [{ family: 'Carney', given: 'D.' }],
        'container-title': ['Psychological Science'],
        published: { 'date-parts': [[2010, 9, 21]] },
      },
    }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const result = await fetchDoiMetadata('10.1037/test')
    expect(result.title).toBe('Power posing and testosterone')
    expect(result.authors).toEqual(['Carney, D.'])
    expect(result.journal).toBe('Psychological Science')
    expect(result.publication_date).toBe('2010-09-21')
  })

  it('throws CrossrefError on timeout', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))
    await expect(fetchDoiMetadata('10.1037/test')).rejects.toThrow(CrossrefError)
  })

  it('throws CrossrefError when DOI not found', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 404 } as Response)
    await expect(fetchDoiMetadata('10.1037/bad')).rejects.toThrow(CrossrefError)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test src/tests/lib/crossref.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/crossref'`

- [ ] **Step 3: Implement Crossref client**

Create `src/lib/crossref.ts`:
```typescript
import type { NominationMetadata } from '@/types'

export class CrossrefError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CrossrefError'
  }
}

export function normalizeDoi(doi: string): string {
  return doi.toLowerCase().trim().replace(/\/$/, '')
}

export async function fetchDoiMetadata(doi: string): Promise<NominationMetadata> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  let response: Response
  try {
    response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': `ReplicateThis/2.0 (mailto:${process.env.ADMIN_EMAIL ?? 'admin@forrt.org'})`,
      },
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new CrossrefError(
        'Crossref is currently slow. Please try again in a moment.'
      )
    }
    throw new CrossrefError('Failed to reach Crossref API.')
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new CrossrefError('No paper found for this DOI. Please check and try again.')
    }
    throw new CrossrefError(`Crossref returned an error (${response.status}).`)
  }

  const data = await response.json()
  const msg = data.message

  const authors: string[] = (msg.author ?? []).map(
    (a: { family?: string; given?: string }) =>
      [a.family, a.given].filter(Boolean).join(', ')
  )

  const dateParts: number[] | undefined = msg.published?.['date-parts']?.[0]
  const publication_date = dateParts
    ? dateParts.map((p) => String(p).padStart(2, '0')).join('-')
    : ''

  return {
    title: (msg.title?.[0] ?? '').trim(),
    authors,
    journal: (msg['container-title']?.[0] ?? '').trim(),
    publication_date,
  }
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
npm test src/tests/lib/crossref.test.ts
```
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/crossref.ts src/tests/lib/crossref.test.ts
git commit -m "feat: add Crossref API client with 5s timeout and Polite Pool header"
```

---

### Task 6: Nomination Submission

**Files:**
- Create: `src/actions/nominations.ts`
- Create: `src/app/nominate/page.tsx`

- [ ] **Step 1: Write Server Action**

Create `src/actions/nominations.ts`:
```typescript
'use server'

import { auth } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { fetchDoiMetadata, normalizeDoi, CrossrefError } from '@/lib/crossref'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

const DISCIPLINES = [
  'Psychology', 'Medicine', 'Economics', 'Biology',
  'Physics', 'Sociology', 'Education', 'Other',
]

export type NominateResult =
  | { success: true; nominationId: string }
  | { success: false; error: string; existingId?: string }

export async function submitNomination(formData: FormData): Promise<NominateResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { success: false, error: 'You must be signed in to nominate.' }

  const rawDoi = formData.get('doi')?.toString() ?? ''
  const discipline = formData.get('discipline')?.toString() ?? ''
  const justification = formData.get('justification')?.toString().trim() ?? ''

  if (!rawDoi) return { success: false, error: 'DOI is required.' }
  if (!DISCIPLINES.includes(discipline)) return { success: false, error: 'Invalid discipline.' }
  if (justification.length < 20) return { success: false, error: 'Justification must be at least 20 characters.' }

  const doi = normalizeDoi(rawDoi)

  // Check for duplicate (non-rejected)
  const { data: existing } = await adminClient
    .from('nominations')
    .select('id, status')
    .eq('doi', doi)
    .neq('status', 'rejected')
    .maybeSingle()

  if (existing) {
    return {
      success: false,
      error: 'This study has already been nominated.',
      existingId: existing.id,
    }
  }

  // Fetch Crossref metadata
  let metadata
  try {
    metadata = await fetchDoiMetadata(doi)
  } catch (err) {
    if (err instanceof CrossrefError) return { success: false, error: err.message }
    return { success: false, error: 'An unexpected error occurred.' }
  }

  // Insert nomination
  const { data: nomination, error } = await adminClient
    .from('nominations')
    .insert({
      doi,
      metadata,
      discipline,
      justification,
      nominator_uid: session.user.id,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error || !nomination) {
    return { success: false, error: 'Failed to save nomination.' }
  }

  // Notify all maintainers
  const { data: maintainers } = await adminClient
    .from('users')
    .select('id')
    .eq("raw_user_meta_data->>'role'", 'maintainer')

  if (maintainers?.length) {
    await adminClient.from('in_app_notifications').insert(
      maintainers.map((m) => ({
        user_uid: m.id,
        type: 'new_nomination',
        data: { nomination_id: nomination.id, doi },
      }))
    )
  }

  revalidatePath('/registry')
  return { success: true, nominationId: nomination.id }
}
```

- [ ] **Step 2: Create nomination form page**

Create `src/app/nominate/page.tsx`:
```typescript
'use client'

import { useActionState } from 'react'
import { submitNomination, type NominateResult } from '@/actions/nominations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'

const DISCIPLINES = [
  'Psychology', 'Medicine', 'Economics', 'Biology',
  'Physics', 'Sociology', 'Education', 'Other',
]

const initialState: NominateResult | null = null

export default function NominatePage() {
  const [result, action, isPending] = useActionState(
    async (_prev: NominateResult | null, formData: FormData) => submitNomination(formData),
    initialState
  )

  if (result?.success) {
    return (
      <main className="max-w-xl mx-auto px-4 py-12 text-center">
        <h1 className="text-xl font-bold mb-2">Nomination Submitted</h1>
        <p className="text-muted-foreground text-sm mb-4">
          Your nomination is pending review by a maintainer. You'll be notified once it's approved.
        </p>
        <Link href="/registry" className="text-emerald-600 text-sm underline">Back to registry</Link>
      </main>
    )
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Nominate a Study</h1>
      <form action={action} className="space-y-5">
        <div>
          <Label htmlFor="doi">DOI</Label>
          <Input id="doi" name="doi" placeholder="10.1000/example" required className="mt-1" />
          <p className="text-xs text-muted-foreground mt-1">We'll fetch the paper's metadata from Crossref automatically.</p>
        </div>

        <div>
          <Label htmlFor="discipline">Discipline</Label>
          <Select name="discipline" required>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select discipline" />
            </SelectTrigger>
            <SelectContent>
              {DISCIPLINES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="justification">Why does this study need replication?</Label>
          <Textarea
            id="justification"
            name="justification"
            rows={4}
            placeholder="Describe the study's influence, any concerns about the methodology, or why replication would be valuable."
            required
            className="mt-1"
          />
        </div>

        {result && !result.success && (
          <p className="text-sm text-destructive">
            {result.error}
            {result.existingId && (
              <> <Link href={`/nominations/${result.existingId}`} className="underline">View it here.</Link></>
            )}
          </p>
        )}

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? 'Submitting…' : 'Submit Nomination'}
        </Button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: Test the form in browser**

```bash
npm run dev
```
Navigate to http://localhost:3000/nominate (sign in first). Try submitting a valid DOI (e.g. `10.1177/0956797610379700`). Expected: form submits, Crossref metadata is fetched, success screen shown.

Try submitting the same DOI again. Expected: "This study has already been nominated" with link.

Try submitting with Crossref unreachable (disconnect network briefly). Expected: friendly timeout error.

- [ ] **Step 4: Commit**

```bash
git add src/actions/nominations.ts src/app/nominate/
git commit -m "feat: add nomination submission with Crossref validation and duplicate check"
```

---

### Task 7: Voting Server Action and Optimistic UI

**Files:**
- Create: `src/actions/votes.ts`
- Create: `src/components/nominations/vote-button.tsx`
- Create: `src/tests/components/vote-button.test.tsx`

- [ ] **Step 1: Write Server Action**

Create `src/actions/votes.ts`:
```typescript
'use server'

import { auth } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

export type VoteResult =
  | { success: true; newScore: number }
  | { success: false; error: string }

export async function toggleVote(
  nominationId: string,
  value: 1 | -1
): Promise<VoteResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { success: false, error: 'Sign in to vote.' }

  const userUid = session.user.id
  const createdAt = session.user.createdAt

  // 24-hour gate
  const accountAge = Date.now() - new Date(createdAt).getTime()
  if (accountAge < 24 * 60 * 60 * 1000) {
    return { success: false, error: 'Accounts must be 24 hours old to vote.' }
  }

  // Check existing vote
  const { data: existing } = await adminClient
    .from('votes')
    .select('value')
    .eq('nomination_id', nominationId)
    .eq('user_uid', userUid)
    .maybeSingle()

  if (existing) {
    if (existing.value === value) {
      // Un-vote
      await adminClient.from('votes').delete()
        .eq('nomination_id', nominationId).eq('user_uid', userUid)
    } else {
      // Flip vote
      await adminClient.from('votes').update({ value })
        .eq('nomination_id', nominationId).eq('user_uid', userUid)
    }
  } else {
    await adminClient.from('votes').insert({ nomination_id: nominationId, user_uid: userUid, value })
  }

  // Return new score
  const { data: totals } = await adminClient
    .from('nomination_vote_totals')
    .select('score')
    .eq('nomination_id', nominationId)
    .maybeSingle()

  revalidatePath('/registry')
  return { success: true, newScore: (totals?.score as number) ?? 0 }
}
```

- [ ] **Step 2: Write failing component tests**

Create `src/tests/components/vote-button.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VoteButton } from '@/components/nominations/vote-button'

describe('VoteButton', () => {
  it('displays current score', () => {
    render(
      <VoteButton
        nominationId="abc"
        initialScore={42}
        userVote={null}
        onVote={vi.fn()}
      />
    )
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('calls onVote with +1 when upvote clicked', async () => {
    const onVote = vi.fn().mockResolvedValue(undefined)
    render(
      <VoteButton
        nominationId="abc"
        initialScore={10}
        userVote={null}
        onVote={onVote}
      />
    )
    await userEvent.click(screen.getByLabelText('Upvote'))
    expect(onVote).toHaveBeenCalledWith('abc', 1)
  })

  it('calls onVote with -1 when downvote clicked', async () => {
    const onVote = vi.fn().mockResolvedValue(undefined)
    render(
      <VoteButton
        nominationId="abc"
        initialScore={10}
        userVote={null}
        onVote={onVote}
      />
    )
    await userEvent.click(screen.getByLabelText('Downvote'))
    expect(onVote).toHaveBeenCalledWith('abc', -1)
  })
})
```

- [ ] **Step 3: Run to confirm failure**

```bash
npm test src/tests/components/vote-button.test.tsx
```
Expected: FAIL

- [ ] **Step 4: Implement VoteButton with optimistic UI**

Create `src/components/nominations/vote-button.tsx`:
```typescript
'use client'

import { useOptimistic, useTransition } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  nominationId: string
  initialScore: number
  userVote: 1 | -1 | null
  onVote: (nominationId: string, value: 1 | -1) => Promise<void>
}

export function VoteButton({ nominationId, initialScore, userVote, onVote }: Props) {
  const [optimisticScore, setOptimisticScore] = useOptimistic(initialScore)
  const [optimisticVote, setOptimisticVote] = useOptimistic(userVote)
  const [, startTransition] = useTransition()

  function handleVote(value: 1 | -1) {
    startTransition(async () => {
      const delta = optimisticVote === value ? -value : value - (optimisticVote ?? 0)
      setOptimisticScore(optimisticScore + delta)
      setOptimisticVote(optimisticVote === value ? null : value)
      await onVote(nominationId, value)
    })
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        onClick={() => handleVote(1)}
        aria-label="Upvote"
        className={cn(
          'p-1 rounded hover:text-emerald-600 transition-colors',
          optimisticVote === 1 ? 'text-emerald-600' : 'text-muted-foreground'
        )}
      >
        <ChevronUp className="w-4 h-4" />
      </button>
      <span className="text-sm font-semibold tabular-nums">{optimisticScore}</span>
      <button
        onClick={() => handleVote(-1)}
        aria-label="Downvote"
        className={cn(
          'p-1 rounded hover:text-red-500 transition-colors',
          optimisticVote === -1 ? 'text-red-500' : 'text-muted-foreground'
        )}
      >
        <ChevronDown className="w-4 h-4" />
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Install lucide-react**

```bash
npm install lucide-react
```

- [ ] **Step 6: Run tests to confirm pass**

```bash
npm test src/tests/components/vote-button.test.tsx
```
Expected: PASS — 3 tests

- [ ] **Step 7: Commit**

```bash
git add src/actions/votes.ts src/components/nominations/vote-button.tsx src/tests/components/vote-button.test.tsx
git commit -m "feat: add voting Server Action and optimistic VoteButton"
```

---

### Task 8: Admin Moderation Dashboard

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`
- Create: `src/components/admin/moderation-queue.tsx`
- Create: `src/actions/admin.ts`

- [ ] **Step 1: Create admin layout**

Create `src/app/admin/layout.tsx`:
```typescript
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  const role = session?.user?.role as string | undefined
  if (role !== 'maintainer') notFound()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white px-4 py-3">
        <p className="text-sm font-medium text-muted-foreground">Admin — Moderation Dashboard</p>
      </div>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Write Server Actions for approve/reject/undo**

Create `src/actions/admin.ts`:
```typescript
'use server'

import { auth } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

async function requireMaintainer() {
  const session = await auth.api.getSession({ headers: await headers() })
  const role = session?.user?.role as string | undefined
  if (!session || role !== 'maintainer') throw new Error('Unauthorized')
  return session.user.id
}

export async function approveNomination(nominationId: string): Promise<void> {
  const adminUid = await requireMaintainer()

  await adminClient.from('nominations').update({ status: 'approved' }).eq('id', nominationId)
  await adminClient.from('moderation_logs').insert({
    admin_uid: adminUid,
    nomination_id: nominationId,
    action: 'approved',
  })

  revalidatePath('/admin')
  revalidatePath('/registry')
}

export async function rejectNomination(nominationId: string, reason: string): Promise<void> {
  const adminUid = await requireMaintainer()
  if (!reason.trim()) throw new Error('Rejection reason is required.')

  const { data: nomination } = await adminClient
    .from('nominations')
    .select('nominator_uid')
    .eq('id', nominationId)
    .single()

  await adminClient.from('nominations').update({ status: 'rejected' }).eq('id', nominationId)
  await adminClient.from('moderation_logs').insert({
    admin_uid: adminUid,
    nomination_id: nominationId,
    action: 'rejected',
    reason,
  })

  if (nomination?.nominator_uid) {
    await adminClient.from('in_app_notifications').insert({
      user_uid: nomination.nominator_uid,
      type: 'nomination_rejected',
      data: { nomination_id: nominationId, reason },
    })
  }

  revalidatePath('/admin')
}

export async function undoRejection(nominationId: string): Promise<void> {
  const adminUid = await requireMaintainer()

  await adminClient.from('nominations').update({ status: 'pending' }).eq('id', nominationId)
  await adminClient.from('moderation_logs').insert({
    admin_uid: adminUid,
    nomination_id: nominationId,
    action: 'undo_rejection',
  })

  revalidatePath('/admin')
}
```

- [ ] **Step 3: Create moderation queue component**

Create `src/components/admin/moderation-queue.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { approveNomination, rejectNomination, undoRejection } from '@/actions/admin'
import type { Nomination } from '@/types'

interface Props {
  nominations: Nomination[]
  mode: 'pending' | 'archived'
}

export function ModerationQueue({ nominations, mode }: Props) {
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  if (nominations.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No nominations here.</p>
  }

  return (
    <div className="space-y-3">
      {nominations.map((n) => (
        <div key={n.id} className="bg-white border rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1">
                {n.discipline} · Researcher #{n.nominator_uid?.slice(0, 6) ?? '??????'} · {new Date(n.created_at).toLocaleDateString()}
              </p>
              <p className="font-medium text-sm mb-1 truncate">{(n.metadata as { title?: string })?.title ?? n.doi}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{n.justification}</p>
            </div>

            <div className="flex gap-2 flex-shrink-0">
              {mode === 'pending' ? (
                <>
                  <Button size="sm" onClick={() => approveNomination(n.id)}>Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => { setRejectingId(n.id); setError('') }}>Reject</Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => undoRejection(n.id)}>Undo</Button>
              )}
            </div>
          </div>

          {rejectingId === n.id && (
            <div className="mt-3 space-y-2">
              <Textarea
                placeholder="Reason for rejection (shown to nominator)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    if (!reason.trim()) { setError('Please provide a reason.'); return }
                    await rejectNomination(n.id, reason)
                    setRejectingId(null)
                    setReason('')
                  }}
                >
                  Confirm Reject
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setRejectingId(null); setReason('') }}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create admin page**

Create `src/app/admin/page.tsx`:
```typescript
import { adminClient } from '@/lib/supabase/admin'
import { ModerationQueue } from '@/components/admin/moderation-queue'
import type { Nomination } from '@/types'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const [{ data: pending }, { data: archived }] = await Promise.all([
    adminClient.from('nominations').select('*').eq('status', 'pending').order('created_at', { ascending: true }),
    adminClient.from('nominations').select('*').eq('status', 'rejected').order('created_at', { ascending: false }).limit(50),
  ])

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-6">Moderation Queue</h1>

      <section className="mb-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Pending ({pending?.length ?? 0})
        </h2>
        <ModerationQueue nominations={(pending ?? []) as Nomination[]} mode="pending" />
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Archived / Rejected
        </h2>
        <ModerationQueue nominations={(archived ?? []) as Nomination[]} mode="archived" />
      </section>
    </main>
  )
}
```

- [ ] **Step 5: Test admin workflow in browser**

```bash
npm run dev
```
Sign in with an account that has `role: maintainer` in `raw_user_meta_data`. Navigate to http://localhost:3000/admin. Expected: pending nominations list with approve/reject controls. Reject one — verify reason is required and notification is created. Approve one — verify it appears in /registry.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/ src/components/admin/ src/actions/admin.ts
git commit -m "feat: add admin moderation dashboard with approve, reject, and undo"
```

---

**Plan 2 complete.** After this plan is executed you will have: a public registry with filtering and sorting, optimistic voting, the full nomination submission pipeline with Crossref validation, and the admin moderation dashboard. Proceed to Plan 3.
