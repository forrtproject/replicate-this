import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface ProgressUpdate {
  id: string
  token: string
  name: string | null
  content: string
  articleUrl: string
  createdAt: string
}

export function useUpdates(nominationId: string) {
  return useQuery({
    queryKey: ['updates', nominationId],
    queryFn: () => api.get<{ updates: ProgressUpdate[] }>(`/updates/${nominationId}`),
    select: (d) => d.updates,
  })
}

export function usePostUpdate(nominationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ content, articleUrl }: { content: string; articleUrl?: string }) =>
      api.post<{ id: string }>(`/updates/${nominationId}`, { content, articleUrl }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['updates', nominationId] }),
  })
}
