import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { nominationKeys } from '@/features/nominations/api'
import type { NominationMetadata, NominationStatus } from '@/types'

export interface AdminNomination {
  id: string
  doi: string
  metadata: NominationMetadata
  metadataManual: boolean
  discipline: string
  verificationType: 'replication' | 'reproduction' | 'both'
  availability: import('@/types').AvailabilityKey[]
  availabilityLinks: Partial<Record<import('@/types').AvailabilityKey, string>>
  justification: string
  dataLocation: string
  robustnessChecks: string
  designDeviations: string
  nominatorUid: string | null
  status: NominationStatus
  createdAt: string
}

type Tab = 'pending' | 'archived'

export function useAdminNominations(tab: Tab) {
  return useQuery({
    queryKey: ['admin', 'nominations', tab],
    queryFn: () =>
      api.get<{ nominations: AdminNomination[] }>(`/admin/nominations?tab=${tab}`),
    select: (d) => d.nominations,
  })
}

function useAdminMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] })
      qc.invalidateQueries({ queryKey: nominationKeys.all })
    },
  })
}

export const useApprove = () =>
  useAdminMutation((id: string) => api.post(`/admin/nominations/${id}/approve`))

export const useReject = () =>
  useAdminMutation(({ id, reason }: { id: string; reason: string }) =>
    api.post(`/admin/nominations/${id}/reject`, { reason }),
  )

export const useUndoReject = () =>
  useAdminMutation((id: string) => api.post(`/admin/nominations/${id}/undo-reject`))

export const useSetStatus = () =>
  useAdminMutation(({ id, status }: { id: string; status: string }) =>
    api.post(`/admin/nominations/${id}/status`, { status }),
  )

/* ---- User management ---- */

export interface AdminUser {
  id: string
  token: string
  role: 'user' | 'maintainer'
  name: string
  links: import('@/types').ProfileLinks
  createdAt: string
  nominations: number
  contributions: number
  providers: string[]
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get<{ users: AdminUser[] }>('/admin/users'),
    select: (d) => d.users,
  })
}

export function useSetUserRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'user' | 'maintainer' }) =>
      api.patch<{ ok: true }>(`/admin/users/${id}/role`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

/* ---- Comment moderation ---- */

export interface AdminComment {
  id: string
  nominationId: string
  nominationTitle: string
  content: string
  hidden: boolean
  createdAt: string
  authorToken: string
  authorName: string | null
}

export function useAdminComments() {
  return useQuery({
    queryKey: ['admin', 'comments'],
    queryFn: () => api.get<{ comments: AdminComment[] }>('/admin/comments'),
    select: (d) => d.comments,
  })
}

export function useHideComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) =>
      api.post<{ ok: true }>(`/admin/comments/${id}/hide`, { hidden }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'comments'] })
      qc.invalidateQueries({ queryKey: ['comments'] })
      qc.invalidateQueries({ queryKey: nominationKeys.all })
    },
  })
}
