import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { nominationKeys } from '@/features/nominations/api'
import type { NominationDetail, NominationSummary } from '@/types'

interface MyContribution {
  nominationId: string
  message: string
  createdAt: string
  nomination: NominationSummary
}

export interface Contributor {
  token: string
  name: string | null
  links: import('@/types').ProfileLinks
  message: string
  createdAt: string
}

export function useContributors(nominationId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['contributors', nominationId],
    queryFn: () =>
      api.get<{ contributors: Contributor[] }>(
        `/nominations/${nominationId}/contributors`,
      ),
    select: (d) => d.contributors,
    enabled,
  })
}

export function useMyContributions() {
  return useQuery({
    queryKey: ['contributions', 'mine'],
    queryFn: () => api.get<{ contributions: MyContribution[] }>('/contributions/mine'),
    select: (d) => d.contributions,
  })
}

export function useContribute(nominationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (message: string) =>
      api.post<{ userContributed: boolean; contributions: number }>(
        `/contributions/${nominationId}`,
        { message },
      ),
    onSuccess: (res) => {
      qc.setQueryData<{ nomination: NominationDetail }>(
        nominationKeys.detail(nominationId),
        (prev) =>
          prev
            ? {
                nomination: {
                  ...prev.nomination,
                  userContributed: res.userContributed,
                  contributions: res.contributions,
                },
              }
            : prev,
      )
      qc.invalidateQueries({ queryKey: ['contributions', 'mine'] })
      qc.invalidateQueries({ queryKey: ['contributors', nominationId] })
    },
  })
}

export function useWithdrawContribution(nominationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.delete<{ userContributed: boolean; contributions: number }>(
        `/contributions/${nominationId}`,
      ),
    onSuccess: (res) => {
      qc.setQueryData<{ nomination: NominationDetail }>(
        nominationKeys.detail(nominationId),
        (prev) =>
          prev
            ? {
                nomination: {
                  ...prev.nomination,
                  userContributed: res.userContributed,
                  contributions: res.contributions,
                },
              }
            : prev,
      )
      qc.invalidateQueries({ queryKey: ['contributions', 'mine'] })
      qc.invalidateQueries({ queryKey: ['contributors', nominationId] })
    },
  })
}

export function useSendInquiry(nominationId: string) {
  return useMutation({
    mutationFn: (content: string) =>
      api.post<{ ok: true }>(`/inquiries/${nominationId}`, { content }),
  })
}

export interface SlackJoinResponse {
  result: 'invited' | 'already_in_channel' | 'not_in_workspace'
  channelName?: string
  inviteUrl?: string
}

/**
 * Ask to be invited into the team's locked Slack channel. The email is the
 * one on the user's Slack account — used once server-side, never stored.
 */
export function useJoinSlackChannel(nominationId: string) {
  return useMutation({
    mutationFn: (email: string) =>
      api.post<SlackJoinResponse>(`/slack/nominations/${nominationId}/join`, { email }),
  })
}
