import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { ToastContext, type Toast } from '@/lib/toast'

// Long enough to read a sentence and reach Undo; paused while the pointer or
// keyboard focus is on the toast, so it never disappears mid-reach.
const VISIBLE_MS = 6000

/**
 * One confirmation at a time, announced politely without moving focus (the
 * region is always in the page, so screen readers pick up what appears in it).
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<(Toast & { id: number }) | null>(null)
  const [paused, setPaused] = useState(false)
  const nextId = useRef(0)

  const show = useCallback((t: Toast) => {
    nextId.current += 1
    setToast({ ...t, id: nextId.current })
  }, [])

  useEffect(() => {
    if (!toast || paused) return
    const timer = window.setTimeout(() => setToast(null), VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [toast, paused])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
      >
        {toast && (
          <div
            key={toast.id}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            className="pointer-events-auto flex max-w-md items-center gap-3 rounded-lg bg-ink py-2 pl-4 pr-2 text-sm text-paper shadow-lg"
          >
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action!.onAction()
                  setToast(null)
                  setPaused(false)
                }}
                className="rounded-md px-2 py-1.5 font-semibold text-green-tint underline underline-offset-2 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setToast(null)
                setPaused(false)
              }}
              aria-label="Dismiss"
              className="rounded-md p-1.5 text-paper/70 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
