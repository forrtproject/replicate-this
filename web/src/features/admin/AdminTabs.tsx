import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { PageBand } from '@/components/layout/PageBand'

const tab = ({ isActive }: { isActive: boolean }) =>
  cn(
    'text-sm transition-colors',
    // Same current-page mark as the main navigation: the word itself.
    isActive
      ? 'font-medium text-ink underline decoration-current decoration-[1.5px] underline-offset-[6px]'
      : 'text-band-ink/75 hover:text-ink',
  )

/** Shared frame for the maintainer pages: one title, section tabs, and a short brief. */
export function AdminPageHeader({ intro }: { intro: React.ReactNode }) {
  return (
    <div className="mb-8">
      <PageBand bleed inner="pb-6" className="mb-0!">
      <h1 className="font-display text-[2rem] font-semibold leading-tight">Maintainer tools</h1>
      <nav aria-label="Maintainer tools" className="mt-5 flex gap-6">
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
      </PageBand>
      <p className="mt-6 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">{intro}</p>
    </div>
  )
}
