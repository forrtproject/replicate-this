import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { researcherLabel } from '@/features/nominations/format'

/**
 * A researcher's display name, linked to their public profile. Deleted
 * accounts (and rows with no token) render as plain text — there is no
 * profile to visit.
 */
export function ResearcherLink({
  name,
  token,
  className,
}: {
  name: string | null | undefined
  token: string | null | undefined
  className?: string
}) {
  const label = researcherLabel(name, token)
  if (!token || name === 'Deleted account') {
    return <span className={cn('text-muted-foreground', className)}>{label}</span>
  }
  return (
    <Link
      to={`/researchers/${token}`}
      className={cn('relative z-10 hover:text-green hover:underline', className)}
    >
      {label}
    </Link>
  )
}
