import { cn } from '@/lib/utils'

/**
 * Reticle / crosshair mark — the recurring ornament. Borrowed from scientific
 * plots and measurement instruments: a small target that reads as "verify this".
 */
export function Reticle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      className={cn('h-4 w-4', className)}
    >
      <circle cx="12" cy="12" r="6" />
      <path d="M12 1v5M12 18v5M1 12h5M18 12h5" strokeLinecap="round" />
    </svg>
  )
}
