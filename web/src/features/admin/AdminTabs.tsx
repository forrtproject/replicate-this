import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const tab = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
    isActive ? 'bg-green text-white' : 'text-muted-foreground hover:text-ink',
  )

export function AdminTabs() {
  return (
    <div className="mb-6 flex gap-1 border-b border-line pb-3">
      <NavLink to="/admin" end className={tab}>
        Moderation
      </NavLink>
      <NavLink to="/admin/comments" className={tab}>
        Comments
      </NavLink>
      <NavLink to="/admin/users" className={tab}>
        Users
      </NavLink>
    </div>
  )
}
