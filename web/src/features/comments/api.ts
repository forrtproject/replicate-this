import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ProfileLinks } from '@/types'

export interface Comment {
  id: string
  parentId: string | null
  token: string
  name: string | null
  links: ProfileLinks
  content: string
  hidden: boolean
  createdAt: string
}

export function useComments(nominationId: string) {
  return useQuery({
    queryKey: ['comments', nominationId],
    queryFn: () => api.get<{ comments: Comment[] }>(`/comments/${nominationId}`),
    select: (d) => d.comments,
  })
}

export function usePostComment(nominationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ content, parentId }: { content: string; parentId?: string }) =>
      api.post<{ id: string }>(`/comments/${nominationId}`, { content, parentId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', nominationId] }),
  })
}
