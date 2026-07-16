import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { nominationKeys } from '@/features/nominations/api'
import type { EmailPrefs, ProfileLinks } from '@/types'

interface Profile {
  name: string
  image: string
  links: ProfileLinks
  notificationEmail: string
  emailPrefs: EmailPrefs
  onboarded: boolean
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

/** Set or clear the profile avatar (emoji or inline image data URL; '' clears it). */
export function useUpdateAvatar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (image: string) => api.patch<{ image: string }>('/profile/avatar', { image }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      qc.invalidateQueries({ queryKey: nominationKeys.all })
    },
  })
}

/** Mark the post-signup walkthrough finished (or skipped). */
export function useCompleteOnboarding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ ok: true }>('/profile/onboarded'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
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
