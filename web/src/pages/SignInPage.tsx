import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { signIn, authClient, usePopupSignIn } from '@/lib/auth-client'
import { signInWithPopup } from '@/lib/popup-sign-in'
import { api } from '@/lib/api'
import { withBase } from '@/lib/config'
import { armPendingAction, disarmPendingAction } from '@/lib/pending-action'
import { usePageTitle } from '@/lib/page-title'

interface EnabledProviders {
  google: boolean
  github: boolean
  orcid: boolean
}

export function SignInPage() {
  usePageTitle('Sign in or register')
  const [params] = useSearchParams()
  // Absolute URL on the web origin: Better Auth runs on another origin, so a
  // relative path would otherwise resolve against the auth server. React Router
  // strips the base path from the redirect, so put it back.
  const callbackURL = `${window.location.origin}${withBase(params.get('redirect') ?? '/dashboard')}`

  const [error, setError] = useState<string | null>(null)
  const target = params.get('redirect') ?? '/dashboard'

  /**
   * Cross-origin the session cookie never reaches the SPA, so sign-in runs in a
   * popup that returns a token. Same-origin keeps the plain redirect flow.
   */
  async function start(provider: { provider: string } | { providerId: string }) {
    // A vote or forecast clicked while signed out may now be finished on return.
    armPendingAction()
    if (!usePopupSignIn) {
      if ('provider' in provider) {
        await signIn.social({ provider: provider.provider, callbackURL })
      } else {
        await authClient.signIn.oauth2({ providerId: provider.providerId, callbackURL })
      }
      return
    }
    setError(null)
    const failure = await signInWithPopup(provider, callbackURL)
    if (failure) {
      disarmPendingAction()
      setError(failure)
      return
    }
    // Full navigation rather than a client-side one: the session hook has
    // already cached "signed out", and a reload refetches it with the token.
    window.location.assign(`${window.location.origin}${withBase(target)}`)
  }

  const { data: providers, isLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => api.get<EnabledProviders>('/providers'),
  })

  const anyEnabled = providers && (providers.google || providers.github || providers.orcid)

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-center font-display text-3xl font-bold">Sign in or register</h1>
      <p className="mb-8 mt-2 text-center text-sm text-muted-foreground">
        New here? Signing in for the first time creates your account, so there’s no separate
        sign-up. We start you off with the name from your provider (you can change it, or
        pick a pseudonym, in your profile) and use your sign-in address only for the
        notifications you choose.
      </p>

      {isLoading && <p className="text-center text-sm text-muted-foreground">Loading…</p>}

      {providers && !anyEnabled && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-800">
          No sign-in providers are configured yet. Add OAuth credentials to the server
          <code className="mx-1">.env</code> to enable sign-in.
        </p>
      )}

      {error && (
        <p className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-center text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {providers?.google && (
          <ProviderButton onClick={() => start({ provider: 'google' })}>
            Continue with Google
          </ProviderButton>
        )}
        {providers?.github && (
          <ProviderButton onClick={() => start({ provider: 'github' })}>
            Continue with GitHub
          </ProviderButton>
        )}
        {providers?.orcid && (
          <ProviderButton onClick={() => start({ providerId: 'orcid' })}>
            Continue with ORCID
          </ProviderButton>
        )}
      </div>
    </div>
  )
}

function ProviderButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
    >
      {children}
    </button>
  )
}
