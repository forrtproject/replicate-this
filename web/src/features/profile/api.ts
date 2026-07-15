import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { nominationKeys } from '@/features/nominations/api'
import type { EmailPrefs, ProfileLinks } from '@/types'

interface Profile {
  name: string
  links: ProfileLinks
  notificationEmail: string
  emailPrefs: EmailPrefs
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<Profile>('/profile'),
  })
}

export function useUpdateLinks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (links: ProfileLinks) => api.patch<{ links: ProfileLinks }>('/profile', { links }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      qc.invalidateQueries({ queryKey: nominationKeys.all })
    },
  })
}

export function useUpdateName() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.patch<{ name: string }>('/profile/name', { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      qc.invalidateQueries({ queryKey: nominationKeys.all })
    },
  })
}

export function useUpdateEmailPrefs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { email: string; prefs: EmailPrefs }) =>
      api.patch<{ notificationEmail: string; emailPrefs: EmailPrefs }>('/profile/email', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })
}

/** Fetches a random pseudonym suggestion — nothing is saved until the user saves. */
export function useNameSuggestion() {
  return useMutation({
    mutationFn: () => api.get<{ name: string }>('/profile/name/suggestion'),
  })
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => api.delete<{ ok: true }>('/profile'),
  })
}
