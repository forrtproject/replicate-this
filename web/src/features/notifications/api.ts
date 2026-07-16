import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useSession } from '@/lib/auth-client'

export interface AppNotification {
  id: string
  type: string
  data: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

export function useNotifications() {
  const { data: session } = useSession()
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      api.get<{ notifications: AppNotification[]; unread: number }>('/notifications'),
    enabled: !!session,
    refetchInterval: 60_000,
  })
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/notifications/read'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

/** Mark a single notification read — e.g. when the user clicks it. */
export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

const LABELS: Record<string, string> = {
  new_nomination: 'New nomination awaiting review',
  nomination_approved: 'Your nomination was approved',
  nomination_rejected: 'Your nomination was rejected',
  nomination_completed: 'A study you nominated was marked completed',
  nomination_published: 'A study you nominated was published',
  nomination_edited: 'An edited nomination is awaiting review',
  nomination_admin_edited: 'A maintainer edited your nomination',
  watched_comment: 'New comment on a study you subscribe to',
  watched_update: 'New progress update on a study you subscribe to',
  watched_contribution: 'New contributor on a study you subscribe to',
  watched_status: 'Status change on a study you subscribe to',
  completion_requested: 'A team posted an article link — completion approval needed',
  new_contribution: 'Someone is contributing to your nomination',
  team_member_joined: 'Someone joined a replication team you’re on',
  new_inquiry: 'You received a new inquiry',
  moderation_new_inquiry: 'New message posted on a nomination',
  moderation_new_comment: 'New comment posted on a nomination',
  upvote_milestone: 'A nomination reached an upvote milestone',
}

export function notificationLabel(n: AppNotification): string {
  if (n.type === 'upvote_milestone' && typeof n.data.milestone === 'number') {
    return `A nomination reached ${n.data.milestone} upvotes`
  }
  return LABELS[n.type] ?? n.type
}
