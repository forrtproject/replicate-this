import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { NominationDetail, NominationMetadata, NominationSummary } from '@/types'

export const nominationKeys = {
  all: ['nominations'] as const,
  list: () => [...nominationKeys.all, 'list'] as const,
  mine: () => [...nominationKeys.all, 'mine'] as const,
  detail: (id: string) => [...nominationKeys.all, 'detail', id] as const,
}

export function useNominations() {
  return useQuery({
    queryKey: nominationKeys.list(),
    queryFn: () => api.get<{ nominations: NominationSummary[] }>('/nominations'),
    select: (d) => d.nominations,
  })
}

export function useNomination(id: string) {
  return useQuery({
    queryKey: nominationKeys.detail(id),
    queryFn: () => api.get<{ nomination: NominationDetail }>(`/nominations/${id}`),
    select: (d) => d.nomination,
  })
}

export interface SubmitNominationInput {
  doi?: string
  // True for a paper without a DOI; `metadata` then carries the reference.
  noDoi?: boolean
  discipline: string
  disciplineOther?: string
  verificationType: string
  availability: string[]
  availabilityLinks: Record<string, string>
  justification: string
  dataLocation?: string
  robustnessChecks?: string
  designDeviations?: string
  replicationWorkshop?: boolean
  experimentalResearch?: boolean
  metadata?: NominationMetadata
}

export function useSubmitNomination() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SubmitNominationInput) =>
      api.post<{ id: string }>('/nominations', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: nominationKeys.all }),
  })
}

// Everything editable after submission — the DOI and fetched reference are fixed.
export type UpdateNominationInput = Omit<SubmitNominationInput, 'doi' | 'noDoi' | 'metadata'>

/** Looks like a DOI worth resolving: "10.<registrant>/<suffix>", any common prefix stripped. */
export function doiCandidate(raw: string): string | null {
  const doi = raw
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
  return /^10\.\d{4,9}\/\S+$/.test(doi) ? doi : null
}

export interface DoiLookup {
  doi: string
  metadata: NominationMetadata
  existingId: string | null
}

/**
 * Resolves a DOI as it is typed so the form can show the paper's title (proof
 * the DOI is right) and flag an existing nomination before submitting. Errors
 * are ApiErrors whose `data` may carry `allowManual` / `existingId`.
 */
export function useDoiLookup(raw: string) {
  const doi = doiCandidate(raw)
  return useQuery({
    queryKey: ['doi-lookup', doi?.toLowerCase()],
    queryFn: () => api.get<DoiLookup>(`/nominations/lookup?doi=${encodeURIComponent(doi!)}`),
    enabled: !!doi,
    retry: false,
    staleTime: 10 * 60_000,
  })
}

export function useUpdateNomination(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateNominationInput) =>
      api.patch<{ ok: boolean }>(`/nominations/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: nominationKeys.all }),
  })
}

function patchAggregate(
  qc: QueryClient,
  id: string,
  patch: Partial<NominationSummary>,
) {
  qc.setQueryData<{ nominations: NominationSummary[] }>(nominationKeys.list(), (prev) =>
    prev
      ? { nominations: prev.nominations.map((n) => (n.id === id ? { ...n, ...patch } : n)) }
      : prev,
  )
  qc.setQueryData<{ nomination: NominationDetail }>(nominationKeys.detail(id), (prev) =>
    prev ? { nomination: { ...prev.nomination, ...patch } } : prev,
  )
}

export function useToggleVote(nominationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.post<{ upvoted: boolean; upvotes: number }>(
        `/votes/${nominationId}/toggle`,
      ),
    onSuccess: (res) =>
      patchAggregate(qc, nominationId, {
        userUpvoted: res.upvoted,
        upvotes: res.upvotes,
      }),
  })
}

export function useToggleSubscription(nominationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.post<{ subscribed: boolean; subscribers: number }>(
        `/subscriptions/${nominationId}/toggle`,
      ),
    onSuccess: (res) =>
      patchAggregate(qc, nominationId, {
        userSubscribed: res.subscribed,
        subscribers: res.subscribers,
      }),
  })
}

export function useSetPrediction(nominationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (willReplicate: boolean | null) =>
      api.put<{ prediction: boolean | null; predictYes: number; predictNo: number }>(
        `/predictions/${nominationId}`,
        { willReplicate },
      ),
    onSuccess: (res) =>
      patchAggregate(qc, nominationId, {
        userPrediction: res.prediction,
        predictYes: res.predictYes,
        predictNo: res.predictNo,
      }),
  })
}
