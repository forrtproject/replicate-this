import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from '@/lib/auth-client'

/** Client-side route guard. Authorization for data still enforced server-side. */
export function RequireAuth({
  children,
  role,
}: {
  children: React.ReactNode
  role?: 'maintainer'
}) {
  const { data: session, isPending } = useSession()
  const location = useLocation()

  if (isPending) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
  }

  if (!session) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/sign-in?redirect=${redirect}`} replace />
  }

  if (role && (session.user as { role?: string }).role !== role) {
    return <Navigate to="/registry" replace />
  }

  return <>{children}</>
}
