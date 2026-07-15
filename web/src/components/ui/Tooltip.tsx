import { cn } from '@/lib/utils'

/**
 * Lightweight hover/focus tooltip — no dependencies. The trigger is keyboard
 * focusable so the definition is reachable without a mouse.
 */
export function Tooltip({
  content,
  children,
  className,
}: {
  content: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={cn('group/tt relative inline-flex', className)} tabIndex={0}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-60 -translate-x-1/2 rounded-md bg-foreground px-3 py-2 text-xs leading-snug text-background opacity-0 shadow-lg transition-opacity duration-150 group-hover/tt:opacity-100 group-focus/tt:opacity-100"
      >
        {content}
      </span>
    </span>
  )
}
