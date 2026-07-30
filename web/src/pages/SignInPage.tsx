import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { signIn, authClient } from '@/lib/auth-client'
import { api } from '@/lib/api'

interface EnabledProviders {
  google: boolean
  github: boolean
  orcid: boolean
}

export function SignInPage() {
  const [params] = useSearchParams()
  // Absolute URL on the web origin: Better Auth runs on a different port (:8787),
  // so a relative path would otherwise resolve against the auth server.
  const callbackURL = `${window.location.origin}${params.get('redirect') ?? '/dashboard'}`

  const { data: providers, isLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => api.get<EnabledProviders>('/providers'),
  })

  const anyEnabled = providers && (providers.google || providers.github || providers.orcid)

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-center font-display text-3xl font-bold">Sign in</h1>
      <p className="mb-8 mt-2 text-center text-sm text-muted-foreground">
        You appear across the site under a pseudonym, never your provider name. We use your
        sign-in address for notifications — you choose which ones in your profile.
      </p>

      {isLoading && <p className="text-center text-sm text-muted-foreground">Loading…</p>}

      {providers && !anyEnabled && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-800">
          No sign-in providers are configured yet. Add OAuth credentials to the server
          <code className="mx-1">.env</code> to enable sign-in.
        </p>
      )}

      <div className="space-y-3">
        {providers?.google && (
          <ProviderButton onClick={() => signIn.social({ provider: 'google', callbackURL })}>
            Continue with Google
          </ProviderButton>
        )}
        {providers?.github && (
          <ProviderButton onClick={() => signIn.social({ provider: 'github', callbackURL })}>
            Continue with GitHub
          </ProviderButton>
        )}
        {providers?.orcid && (
          <ProviderButton
            onClick={() => authClient.signIn.oauth2({ providerId: 'orcid', callbackURL })}
          >
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
