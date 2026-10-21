import { createContext, useContext } from 'react'

export interface Toast {
  message: string
  /** Optional single action, e.g. Undo. */
  action?: { label: string; onAction: () => void }
}

export const ToastContext = createContext<(toast: Toast) => void>(() => {})

/** Show a short confirmation at the bottom of the screen (see Toaster). */
export function useToast() {
  return useContext(ToastContext)
}
