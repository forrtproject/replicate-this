import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const tab = ({ isActive }: { isActive: boolean }) =>
  cn(
    '-mb-px border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors',
    isActive ? 'border-green text-ink' : 'border-transparent text-muted-foreground hover:text-ink',
  )

/** Shared frame for the maintainer pages: one title, section tabs, and a short brief. */
export function AdminPageHeader({ intro }: { intro: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-[2rem] font-semibold leading-tight">Maintainer tools</h1>
      <nav aria-label="Maintainer tools" className="mt-5 flex gap-6 border-b border-line">
        <NavLink to="/admin" end className={tab}>
          Nominations
        </NavLink>
        <NavLink to="/admin/comments" className={tab}>
          Comments
        </NavLink>
        <NavLink to="/admin/users" className={tab}>
          Users
        </NavLink>
      </nav>
      <p className="mt-4 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">{intro}</p>
    </div>
  )
}
