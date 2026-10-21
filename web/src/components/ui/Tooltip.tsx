import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const EDGE = 8 // px kept clear of the viewport edge

/**
 * Lightweight hover/focus tooltip with no dependencies. The trigger is keyboard
 * focusable so the definition is reachable without a mouse. The bubble is
 * centred on its trigger, then shifted sideways when that would push it off a
 * narrow screen.
 */
export function Tooltip({
  content,
  children,
  className,
  focusable = true,
}: {
  content: React.ReactNode
  children: React.ReactNode
  className?: string
  /**
   * False where the same information is a click away (e.g. chips on a
   * registry card, repeated on the study page), so lists don't gain a Tab stop
   * per chip. The text stays available to screen readers either way.
   */
  focusable?: boolean
}) {
  const bubble = useRef<HTMLSpanElement>(null)
  const [shift, setShift] = useState(0)

  function place() {
    const el = bubble.current
    if (!el) return
    // Measure where the bubble sits when centred (current shift removed).
    const r = el.getBoundingClientRect()
    const left = r.left - shift
    const right = r.right - shift
    const vw = document.documentElement.clientWidth
    if (left < EDGE) setShift(EDGE - left)
    else if (right > vw - EDGE) setShift(vw - EDGE - right)
    else setShift(0)
  }

  return (
    <span
      className={cn('group/tt relative inline-flex', className)}
      tabIndex={focusable ? 0 : undefined}
      onMouseEnter={place}
      onFocus={place}
    >
      {children}
      <span
        ref={bubble}
        role="tooltip"
        style={{ transform: `translateX(calc(-50% + ${shift}px))` }}
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-60 max-w-[calc(100vw-1rem)] rounded-md bg-foreground px-3 py-2 text-xs leading-snug text-background opacity-0 shadow-lg transition-opacity duration-150 group-hover/tt:opacity-100 group-focus/tt:opacity-100"
      >
        {content}
      </span>
    </span>
  )
}
