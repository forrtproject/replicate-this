import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useSession, signOut } from '@/lib/auth-client'
import { useNotifications } from '@/features/notifications/api'
import { cn } from '@/lib/utils'

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'text-sm transition-colors hover:text-green',
          isActive ? 'font-medium text-ink' : 'text-muted-foreground',
        )
      }
    >
      {children}
    </NavLink>
  )
}

function NotificationBell() {
  const navigate = useNavigate()
  const { data } = useNotifications()
  const unread = data?.unread ?? 0
  return (
    <button
      onClick={() => navigate('/dashboard')}
      aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
      className="relative text-muted-foreground transition-colors hover:text-green"
    >
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-green px-1 text-[10px] font-bold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  )
}

export function RootLayout() {
  const { data: session } = useSession()
  const isMaintainer = (session?.user as { role?: string } | undefined)?.role === 'maintainer'

  return (
    <div className="flex min-h-full flex-col overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-6 px-4">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-display text-xl font-semibold tracking-tight">
              Replicate&nbsp;This
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              a replication registry
            </span>
          </Link>
          <nav className="flex items-center gap-5">
            <NavItem to="/registry">Registry</NavItem>
            {session ? (
              <>
                <NavItem to="/nominate">Nominate</NavItem>
                <NavItem to="/dashboard">Dashboard</NavItem>
                <NavItem to="/profile">Profile</NavItem>
                {isMaintainer && <NavItem to="/admin">Admin</NavItem>}
                <NotificationBell />
                <button
                  onClick={() => signOut()}
                  className="text-sm text-muted-foreground transition-colors hover:text-amber"
                >
                  Sign out
                </button>
              </>
            ) : (
              <NavItem to="/sign-in">Sign in</NavItem>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-paper">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground">
          <span>FORRT · Replication Journal Federation</span>
          <nav className="flex items-center gap-4">
            <Link to="/guidelines" className="hover:text-green">
              Guidelines
            </Link>
            <Link to="/code-of-conduct" className="hover:text-green">
              Code of Conduct
            </Link>
            <span>No personal data is stored.</span>
          </nav>
        </div>
      </footer>
    </div>
  )
}
