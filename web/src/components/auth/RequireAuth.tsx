import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from '@/lib/auth-client'
import { useProfile } from '@/features/profile/api'

/** Client-side route guard. Authorization for data still enforced server-side. */
export function RequireAuth({
  children,
  role,
}: {
  children: React.ReactNode
  role?: 'maintainer'
}) {
  const { data: session, isPending } = useSession()
  // Drives the one-time post-signup walkthrough. Read from the profile query (not
  // the session) so completing onboarding — which invalidates it — lifts the gate.
  const { data: profile } = useProfile()
  const location = useLocation()

  if (isPending) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
  }

  if (!session) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/sign-in?redirect=${redirect}`} replace />
  }

  // New users are sent through the walkthrough once before anything else.
  if (profile && !profile.onboarded && location.pathname !== '/welcome') {
    return <Navigate to="/welcome" replace />
  }

  if (role && (session.user as { role?: string }).role !== role) {
    return <Navigate to="/registry" replace />
  }

  return <>{children}</>
}
