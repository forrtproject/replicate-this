import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ProfileLinks } from '@/types'

export interface Comment {
  id: string
  parentId: string | null
  token: string
  name: string | null
  image: string
  links: ProfileLinks
  content: string
  hidden: boolean
  createdAt: string
  likes: number
  viewerLiked: boolean
  viewerFlagged: boolean
  isOwn: boolean
}

const commentsKey = (nominationId: string) => ['comments', nominationId] as const

export function useComments(nominationId: string) {
  return useQuery({
    queryKey: commentsKey(nominationId),
    queryFn: () => api.get<{ comments: Comment[] }>(`/comments/${nominationId}`),
    select: (d) => d.comments,
  })
}

export function usePostComment(nominationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ content, parentId }: { content: string; parentId?: string }) =>
      api.post<{ id: string }>(`/comments/${nominationId}`, { content, parentId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: commentsKey(nominationId) }),
  })
}

/** Patch one comment in the cached thread — used for optimistic likes and flags. */
function patchComment(
  qc: ReturnType<typeof useQueryClient>,
  nominationId: string,
  id: string,
  patch: (c: Comment) => Partial<Comment>,
) {
  qc.setQueryData<{ comments: Comment[] }>(commentsKey(nominationId), (old) =>
    old && { comments: old.comments.map((c) => (c.id === id ? { ...c, ...patch(c) } : c)) },
  )
}

/** Like / unlike — optimistic, so the count moves on click. */
export function useToggleCommentLike(nominationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<{ liked: boolean }>(`/comments/${id}/like`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: commentsKey(nominationId) })
      const previous = qc.getQueryData(commentsKey(nominationId))
      patchComment(qc, nominationId, id, (c) => ({
        viewerLiked: !c.viewerLiked,
        likes: c.likes + (c.viewerLiked ? -1 : 1),
      }))
      return { previous }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(commentsKey(nominationId), ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: commentsKey(nominationId) }),
  })
}

/** Report a comment to the maintainers. */
export function useFlagComment(nominationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<{ flagged: true }>(`/comments/${id}/flag`, { reason }),
    onSuccess: (_res, { id }) =>
      patchComment(qc, nominationId, id, () => ({ viewerFlagged: true })),
  })
}
