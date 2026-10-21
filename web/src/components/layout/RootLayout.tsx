import { useRef, useState } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router-dom'
import { Bell, Menu, X } from 'lucide-react'
import { useSession, signOut } from '@/lib/auth-client'
import { useNotifications } from '@/features/notifications/api'
import { cn } from '@/lib/utils'
import { RouteAnnouncer } from './RouteAnnouncer'

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
      className="relative -m-2.5 rounded-md p-2.5 text-muted-foreground transition-colors hover:text-green"
    >
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-green px-1 text-[10px] font-bold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  )
}

export function RootLayout() {
  const { data: session } = useSession()
  const isMaintainer = (session?.user as { role?: string } | undefined)?.role === 'maintainer'
  const location = useLocation()
  // Phone menu: the full link row doesn't fit below the sm breakpoint. It is
  // open only for the page it was opened on, so following a link closes it.
  const [menuOpenOn, setMenuOpenOn] = useState<string | null>(null)
  const menuOpen = menuOpenOn === location.pathname
  const mainRef = useRef<HTMLElement>(null)

  const links = (
    <>
      <NavItem to="/nominations">Nominations</NavItem>
      {session ? (
        <>
          <NavItem to="/nominate">Nominate</NavItem>
          <NavItem to="/dashboard">Dashboard</NavItem>
          <NavItem to="/profile">Profile</NavItem>
          {isMaintainer && <NavItem to="/admin">Admin</NavItem>}
          <button
            onClick={() => signOut()}
            className="text-left text-sm text-muted-foreground transition-colors hover:text-amber"
          >
            Sign out
          </button>
        </>
      ) : (
        <NavItem to="/sign-in">Sign in / Register</NavItem>
      )}
    </>
  )

  return (
    // overflow-x-clip, not -hidden: "hidden" makes this div a scroll container,
    // which stops the sticky header from sticking.
    <div className="flex min-h-full flex-col overflow-x-clip">
      {/* First stop for keyboard users: jump past the navigation. */}
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          mainRef.current?.focus()
        }}
        className="sr-only rounded-md bg-ink text-sm font-medium text-paper shadow-lg focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-50 focus:px-4 focus:py-2.5"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-6 px-4">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-display text-xl font-semibold tracking-tight">
              Replicate&nbsp;This
            </span>
          </Link>
          <div className="flex items-center gap-5">
            <nav aria-label="Main" className="hidden items-center gap-5 sm:flex">
              {links}
            </nav>
            {session && <NotificationBell />}
            <button
              onClick={() => setMenuOpenOn(menuOpen ? null : location.pathname)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="-m-2.5 rounded-md p-2.5 text-muted-foreground hover:text-green sm:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav
            id="mobile-menu"
            aria-label="Main"
            // Each row is a full-height tap target, not just the line of text.
            className="flex flex-col border-t border-line px-4 py-1 sm:hidden *:py-2.5"
          >
            {links}
          </nav>
        )}
      </header>

      {/* New pages open at the top; Back returns to the earlier scroll position. */}
      <ScrollRestoration />

      <RouteAnnouncer mainRef={mainRef} />

      {/* Focus target after page changes and the skip link; not itself a control. */}
      <main id="main" ref={mainRef} tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-paper">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-muted-foreground">
          <span>FORRT · Replication Journal Federation</span>
          <nav className="flex items-center gap-4">
            <Link to="/guidelines" className="inline-block py-2 hover:text-green">
              Guidelines
            </Link>
            <Link to="/code-of-conduct" className="inline-block py-2 hover:text-green">
              Code of Conduct
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
